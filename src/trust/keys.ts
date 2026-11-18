// F3: raw 32-byte Ed25519 and X25519 keys, imported through the RFC 8410 DER prefixes, plus the hashes and
// fingerprints built on them. node:crypto only, and every random byte comes from an injectable Rand.
import { Buffer } from "node:buffer";
import { createHash, createHmac, createPrivateKey, createPublicKey, diffieHellman, randomBytes, sign, verify, type KeyObject } from "node:crypto";
import { utf8 } from "./bytes";
import { TrustError } from "./errors";

export type Rand = (n: number) => Uint8Array;
export const defaultRand: Rand = (n) => new Uint8Array(randomBytes(n));

export interface EdKey { seed: Uint8Array; pub: Uint8Array }
export interface XKey { priv: Uint8Array; pub: Uint8Array }

const KEY_BYTES = 32;
const SIG_BYTES = 64;
// F3: each prefix is followed by the raw 32-byte key.
const ED_PKCS8 = Buffer.from("302e020100300506032b657004220420", "hex");
const ED_SPKI = Buffer.from("302a300506032b6570032100", "hex");
const X_PKCS8 = Buffer.from("302e020100300506032b656e04220420", "hex");
const X_SPKI = Buffer.from("302a300506032b656e032100", "hex");

function need32(b: Uint8Array, what: string): void {
  if (!(b instanceof Uint8Array) || b.length !== KEY_BYTES) throw new TrustError("bad-key", `${what} must be ${KEY_BYTES} bytes`);
}

function importPrivate(prefix: Buffer, raw: Uint8Array): KeyObject {
  return createPrivateKey({ key: Buffer.concat([prefix, raw]), format: "der", type: "pkcs8" });
}

function importPublic(prefix: Buffer, raw: Uint8Array): KeyObject {
  return createPublicKey({ key: Buffer.concat([prefix, raw]), format: "der", type: "spki" });
}

/** A raw public key is the last 32 bytes of its SPKI DER export. */
function rawPublic(key: KeyObject): Uint8Array {
  const der = createPublicKey(key).export({ format: "der", type: "spki" });
  return new Uint8Array(der.subarray(der.length - KEY_BYTES));
}

export function edFromSeed(seed: Uint8Array): EdKey {
  need32(seed, "an Ed25519 seed");
  return { seed: new Uint8Array(seed), pub: rawPublic(importPrivate(ED_PKCS8, seed)) };
}

export function xFromPriv(priv: Uint8Array): XKey {
  need32(priv, "an X25519 private key");
  return { priv: new Uint8Array(priv), pub: rawPublic(importPrivate(X_PKCS8, priv)) };
}

export function newEdKey(rand: Rand = defaultRand): EdKey {
  return edFromSeed(rand(KEY_BYTES));
}

export function newXKey(rand: Rand = defaultRand): XKey {
  return xFromPriv(rand(KEY_BYTES));
}

export function edSign(seed: Uint8Array, msg: Uint8Array): Uint8Array {
  need32(seed, "an Ed25519 seed");
  return new Uint8Array(sign(null, msg, importPrivate(ED_PKCS8, seed)));
}

/** False, never a throw, on a wrong signature or on malformed input. */
export function edVerify(pub: Uint8Array, msg: Uint8Array, sig: Uint8Array): boolean {
  if (!(pub instanceof Uint8Array) || !(msg instanceof Uint8Array) || !(sig instanceof Uint8Array)) return false;
  if (pub.length !== KEY_BYTES || sig.length !== SIG_BYTES) return false;
  try {
    return verify(null, msg, importPublic(ED_SPKI, pub), sig);
  } catch {
    return false;
  }
}

/** The X25519 shared secret. A low-order public key gives an all-zero secret, which is TrustError("bad-key"). */
export function x25519(priv: Uint8Array, pub: Uint8Array): Uint8Array {
  need32(priv, "an X25519 private key");
  need32(pub, "an X25519 public key");
  let shared: Uint8Array;
  try {
    shared = new Uint8Array(diffieHellman({ privateKey: importPrivate(X_PKCS8, priv), publicKey: importPublic(X_SPKI, pub) }));
  } catch {
    // node:crypto may refuse the all-zero result itself rather than return it.
    throw new TrustError("bad-key", "X25519 failed: the public key is of low order");
  }
  if (shared.every((b) => b === 0)) throw new TrustError("bad-key", "X25519 gave an all-zero shared secret");
  return shared;
}

const asBytes = (b: Uint8Array | string): Uint8Array => (typeof b === "string" ? utf8(b) : b);

/** SHA-256 of bytes, or of a string's UTF-8 bytes. */
export function sha256(b: Uint8Array | string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(asBytes(b)).digest());
}

export function sha256Hex(b: Uint8Array | string): string {
  return createHash("sha256").update(asBytes(b)).digest("hex");
}

export function hmac256(key: Uint8Array, msg: Uint8Array | string): Uint8Array {
  return new Uint8Array(createHmac("sha256", key).update(asBytes(msg)).digest());
}

/** F3: the first 16 lower-case hex characters of SHA-256(pub). */
export function fingerprint(pub: Uint8Array): string {
  return sha256Hex(pub).slice(0, 16);
}

/** F3: upper case, groups of four joined by "-" ("21FE-31DF-A154-A261"). */
export function displayFingerprint(fp: string): string {
  const groups: string[] = [];
  for (let i = 0; i < fp.length; i += 4) groups.push(fp.slice(i, i + 4));
  return groups.join("-").toUpperCase();
}
