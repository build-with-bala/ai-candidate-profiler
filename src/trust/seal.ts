// F6: a signed bundle sealed to the company's X25519 key. Sign first, then seal: X25519 with a fresh ephemeral key,
// HKDF-SHA256 to a key and an IV, then AES-256-GCM with the clear header (format, meta, invite, sealed) as the AAD.
// Only format, meta and invite stay in the clear; a sealed file is exactly the JCS bytes of its value (F2).
import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, hkdfSync } from "node:crypto";
import { b64u, unb64u, utf8 } from "./bytes";
import { BUNDLE_READ_MAX, checkMeta, FORMAT, readSigned, type BundleMeta, type SignedBundle } from "./bundle";
import { TrustError } from "./errors";
import { jcsBytes, parseCanonical } from "./jcs";
import { defaultRand, displayFingerprint, fingerprint, newXKey, x25519, type Rand, type XKey } from "./keys";

export const SEAL_ALG = "X25519-HKDF-SHA256-A256GCM";
export const SEAL_INFO = "aiprof/2 seal v1";

export interface SealedBundle { format: "aiprof/2"; meta: BundleMeta; invite: string; sealed: { alg: typeof SEAL_ALG; kid: string; epk: string; ct: string } }
type SealHeader = Omit<SealedBundle["sealed"], "ct">;

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const TOP_KEYS = ["format", "invite", "meta", "sealed"];
const SEALED_KEYS = ["alg", "ct", "epk", "kid"];
/** F6: the signed bundle without format, meta, invite and sealed. */
const INNER_KEYS = ["exclusions", "exhibits", "fingerprints", "integrity", "payload", "signature", "subject", "timestamp"];
const KID = /^[0-9a-f]{16}$/;

/**
 * F6. Seals a signed bundle to `recipientPub`, the invite's `sealTo`. The ephemeral key is drawn from `rand` unless
 * one is given (vectors only). A bundle with no invite is an Error; a low-order or malformed recipient is bad-key.
 */
export function sealBundle(b: SignedBundle, recipientPub: Uint8Array, o: { ephemeral?: XKey; rand?: Rand } = {}): SealedBundle {
  if (b.invite === null) throw new Error("only a bundle bound to an invite can be sealed");
  const e = o.ephemeral ?? newXKey(o.rand ?? defaultRand);
  const { key, iv } = derive(x25519(e.priv, recipientPub), e.pub, recipientPub);
  const header: SealHeader = { alg: SEAL_ALG, kid: fingerprint(recipientPub), epk: b64u(e.pub) };
  const inner = {
    exclusions: b.exclusions, exhibits: b.exhibits, fingerprints: b.fingerprints, integrity: b.integrity,
    payload: b.payload, signature: b.signature, subject: b.subject, timestamp: b.timestamp,
  };
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aadOf(b.format, b.meta, b.invite, header));
  const ct = Buffer.concat([cipher.update(jcsBytes(inner)), cipher.final(), cipher.getAuthTag()]);
  return { format: b.format, meta: b.meta, invite: b.invite, sealed: { ...header, ct: b64u(ct) } };
}

/** The file: exactly the JCS bytes of the sealed bundle. */
export function sealedBytes(s: SealedBundle): Uint8Array {
  return jcsBytes(s);
}

/**
 * Reads a sealed file: canonical JCS of at most BUNDLE_READ_MAX bytes (else too-large, not-json or not-canonical),
 * then the shape of the clear part. Every shape failure is bad-format.
 */
export function readSealed(bytes: Uint8Array): SealedBundle {
  const v = parseCanonical(bytes, { maxBytes: BUNDLE_READ_MAX });
  if (!isObject(v) || !hasKeys(v, TOP_KEYS)) throw bad(`a sealed bundle has exactly the keys ${TOP_KEYS.join(", ")}`);
  if (v.format !== FORMAT) throw bad(`format is not ${FORMAT}`);
  checkMeta(v.meta);
  if (typeof v.invite !== "string" || v.invite === "") throw bad("invite is a token");
  const s = v.sealed;
  if (!isObject(s) || !hasKeys(s, SEALED_KEYS)) throw bad(`sealed has exactly the keys ${SEALED_KEYS.join(", ")}`);
  if (s.alg !== SEAL_ALG) throw bad(`sealed.alg is not ${SEAL_ALG}`);
  if (typeof s.kid !== "string" || !KID.test(s.kid)) throw bad("sealed.kid is not a key fingerprint (16 lower-case hex)");
  if (typeof s.epk !== "string" || decodes(s.epk, KEY_BYTES) === null) throw bad("sealed.epk is not a 32-byte base64url key");
  const ct = typeof s.ct === "string" ? decodes(s.ct) : null;
  if (ct === null || ct.length < TAG_BYTES) throw bad(`sealed.ct is not base64url of at least ${TAG_BYTES} bytes`);
  return v as unknown as SealedBundle;
}

/**
 * F6 opening. A kid that is not `key`'s is sealed-other-key, naming both fingerprints. A failed decryption is
 * seal-failed. The plaintext must be canonical JCS (else not-canonical) with exactly the eight inner keys, and the
 * rebuilt bundle must pass readSigned's shape check (else bad-format). The caller still checks the signature.
 */
export function openSealed(s: SealedBundle, key: XKey & { kid: string }): SignedBundle {
  const { ct: ctText, ...header } = s.sealed;
  if (header.kid !== key.kid) {
    throw new TrustError("sealed-other-key", `sealed to ${displayFingerprint(header.kid)}; this machine's key is ${displayFingerprint(key.kid)}`);
  }
  const epk = unb64u(header.epk, { bytes: KEY_BYTES });
  const ct = unb64u(ctText);
  if (ct.length < TAG_BYTES) throw new TrustError("seal-failed", "the sealed data is shorter than its tag");
  const { key: k, iv } = derive(x25519(key.priv, epk), epk, key.pub);
  let plaintext: Uint8Array;
  try {
    const decipher = createDecipheriv("aes-256-gcm", k, iv);
    decipher.setAAD(aadOf(s.format, s.meta, s.invite, header));
    decipher.setAuthTag(ct.subarray(ct.length - TAG_BYTES));
    plaintext = new Uint8Array(Buffer.concat([decipher.update(ct.subarray(0, ct.length - TAG_BYTES)), decipher.final()]));
  } catch {
    throw new TrustError("seal-failed", "the sealed data does not open with this key: it was changed, or sealed to another key");
  }
  const inner = parseCanonical(plaintext, { maxBytes: BUNDLE_READ_MAX });
  if (!isObject(inner) || !hasKeys(inner, INNER_KEYS)) throw bad(`the sealed data holds exactly the keys ${INNER_KEYS.join(", ")}`);
  return readSigned(jcsBytes({ format: s.format, meta: s.meta, invite: s.invite, ...inner, sealed: null }));
}

/** F6 step 3: okm = HKDF-SHA256(shared, salt = E ‖ R, info = SEAL_INFO, 44); key = okm[0..32], iv = okm[32..44]. */
function derive(shared: Uint8Array, e: Uint8Array, r: Uint8Array): { key: Uint8Array; iv: Uint8Array } {
  const okm = new Uint8Array(hkdfSync("sha256", shared, Buffer.concat([e, r]), utf8(SEAL_INFO), KEY_BYTES + IV_BYTES));
  return { key: okm.subarray(0, KEY_BYTES), iv: okm.subarray(KEY_BYTES) };
}

/** F6 step 5: the JCS bytes of the clear part, with the header (no ct) as `sealed`. */
function aadOf(format: string, meta: BundleMeta, invite: string, header: SealHeader): Uint8Array {
  return jcsBytes({ format, meta, invite, sealed: { alg: header.alg, kid: header.kid, epk: header.epk } });
}

function decodes(s: string, bytes?: number): Uint8Array | null {
  try {
    return unb64u(s, bytes === undefined ? {} : { bytes });
  } catch {
    return null;
  }
}

const bad = (why: string): TrustError => new TrustError("bad-format", `not a sealed aiprof/2 bundle: ${why}`);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const hasKeys = (o: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(o).sort();
  return own.length === keys.length && own.every((k, i) => k === keys[i]);
};
