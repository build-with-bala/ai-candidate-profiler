// F5: the aiprof/2 bundle. A signed file is exactly the JCS bytes of the bundle (F2), and the signature covers the JCS
// bytes of the bundle without `signature` and `timestamp`, so any changed byte fails to read or to verify.
import type { ExportedPayload, ToolId } from "../payload/exported";
import { CORE_PIN, VERSION } from "../version";
import { b64u, unb64u } from "./bytes";
import { isCompanyName } from "./company";
import { TrustError } from "./errors";
import { OPTIONAL_FIELDS, type Invite } from "./invite";
import { jcsBytes, parseCanonical } from "./jcs";
import { edVerify, sha256Hex } from "./keys";
import { filterPayload } from "./sections";
import type { Signer } from "./signer";

export const FORMAT = "aiprof/2";
export const BUNDLE_READ_MAX = 8 * 1024 * 1024;
export const BUNDLE_BUDGET = 400_000;

export interface BundleMeta { profiler: string; core: string; coreSha: string; createdAt: string; keyId: string; build: "release" | "dev"; devKey?: string }
export interface Fingerprint { fp: string; day: string; tool: ToolId; size: "S" | "M" | "L" | "XL" }
export interface ExclusionCounts { tools: number; projects: number; sessions: number }
export interface UnsignedBundle {
  format: "aiprof/2";
  meta: BundleMeta;
  invite: string | null;
  subject: { name: string | null };
  payload: Record<string, unknown>;
  exhibits: Record<string, unknown> | null;
  integrity: Record<string, unknown>;
  fingerprints: Fingerprint[];
  exclusions: ExclusionCounts;
  timestamp: null;
  sealed: null;
}
export interface SignedBundle extends UnsignedBundle { signature: { alg: "Ed25519"; keyId: string; sig: string } }
export interface AssembleInput {
  exported: ExportedPayload;
  invite: Invite | null;
  name: string | null;
  exhibits: Record<string, unknown> | null;
  fingerprints: Fingerprint[];
  exclusions: ExclusionCounts;
  signer: Pick<Signer, "keyId" | "build" | "pub">;
  createdAt: number;
}

const MAX_FINGERPRINTS = 8;
const MAX_NAME = 80;
const UNPINNED_SHA = "0".repeat(40);
const TOP_KEYS = ["exclusions", "exhibits", "fingerprints", "format", "integrity", "invite", "meta", "payload", "sealed", "signature", "subject", "timestamp"];
const META_KEYS = ["build", "core", "coreSha", "createdAt", "keyId", "profiler"];
const FP_KEYS = ["day", "fp", "size", "tool"];
const EXCLUSION_KEYS = ["projects", "sessions", "tools"];
const SIZES: ReadonlySet<string> = new Set(["S", "M", "L", "XL"]);
const VERSION_TEXT = /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.-]{1,32})?$/;
const KEY_ID = /^[a-z][a-z0-9-]{1,31}$/;
const SHA40 = /^[0-9a-f]{40}$/;
const CREATED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const FP = /^[0-9a-f]{32}$/;
/** TODO(1b): check membership in B's ToolId set instead of the id's form. */
const TOOL = /^[a-z][a-z0-9-]{0,31}$/;

/**
 * F5 assembly. `forensics` is lifted out of the payload into `integrity`; the payload is filtered to the invite's
 * fields, or to all of them when unbound. `exhibits` ships when the invite requests them or the run is unbound;
 * `fingerprints` ship only when the invite requests them, since an unbound run has no nonce (pre-flight G9).
 */
export function assemble(i: AssembleInput): UnsignedBundle {
  const { exported } = i;
  if (exported.schema !== FORMAT || !isObject(exported.value)) throw new Error("the export is not an aiprof/2 payload");
  const value = exported.value;
  if (!isObject(value.forensics)) throw new Error("the export has no forensics");
  const fields = i.invite ? i.invite.claims.fields : OPTIONAL_FIELDS;
  const { forensics, ...rest } = value;
  const meta: BundleMeta = {
    profiler: VERSION,
    // TODO(1b): CORE_VERSION. Until the core is pinned, meta.core is the export's own `core` (B's VERSION, the value
    // CORE_VERSION re-exports).
    core: typeof value.core === "string" ? value.core : "",
    coreSha: metaCoreSha(CORE_PIN.sha),
    createdAt: isoSecond(i.createdAt),
    keyId: i.signer.keyId,
    build: i.signer.build,
  };
  if (i.signer.build === "dev") meta.devKey = b64u(i.signer.pub);
  const bundle: UnsignedBundle = {
    format: FORMAT,
    meta,
    invite: i.invite ? i.invite.token : null,
    subject: { name: i.name },
    payload: filterPayload(rest, fields),
    exhibits: i.invite === null || fields.includes("exhibits") ? i.exhibits : null,
    integrity: forensics,
    fingerprints: i.invite !== null && fields.includes("fingerprints") ? i.fingerprints.map((f) => ({ ...f })) : [],
    exclusions: { tools: i.exclusions.tools, projects: i.exclusions.projects, sessions: i.exclusions.sessions },
    timestamp: null,
    sealed: null,
  };
  // The reader's own rules, so assemble never makes a bundle that readSigned would refuse.
  checkUnsigned(bundle as unknown as Record<string, unknown>);
  return bundle;
}

/**
 * meta.coreSha for a corePin sha: the sha itself when it is 40 lower-case hex, and 40 zeros only while the core is
 * not pinned yet (an empty sha). Any other value is a broken pin, which is an Error rather than a silent placeholder.
 */
export function metaCoreSha(pinSha: string): string {
  if (pinSha === "") return UNPINNED_SHA;
  if (!SHA40.test(pinSha)) throw new Error("package.json corePin.sha is not a 40-hex commit sha");
  return pinSha;
}

/** The JCS bytes of the bundle without `signature` and `timestamp`; `"sealed": null` stays in (F5, pre-flight G2). */
export function signingInput(b: UnsignedBundle | SignedBundle): Uint8Array {
  const { signature: _signature, timestamp: _timestamp, ...rest } = b as SignedBundle;
  return jcsBytes(rest);
}

export function signBundle(b: UnsignedBundle, s: Signer): SignedBundle {
  if (b.meta.keyId !== s.keyId) throw new Error("the signer's key id is not the bundle's meta.keyId");
  const sig = s.sign(signingInput(b));
  return { ...b, signature: { alg: "Ed25519", keyId: s.keyId, sig: b64u(sig) } };
}

/** The file: exactly the JCS bytes of the signed bundle. */
export function bundleBytes(b: SignedBundle): Uint8Array {
  return jcsBytes(b);
}

/**
 * Reads a signed file: canonical JCS of at most BUNDLE_READ_MAX bytes (else too-large, not-json or not-canonical),
 * then F5's shape. A non-null timestamp is timestamp-unsupported; every other shape failure is bad-format. The
 * payload's contents are left to the payload reader (Task 8).
 */
export function readSigned(bytes: Uint8Array): SignedBundle {
  const v = parseCanonical(bytes, { maxBytes: BUNDLE_READ_MAX });
  if (!isObject(v) || !hasKeys(v, TOP_KEYS)) throw bad(`a bundle has exactly the keys ${TOP_KEYS.join(", ")}`);
  if (v.format !== FORMAT) throw bad(`format is not ${FORMAT}`);
  if (v.timestamp !== null) throw new TrustError("timestamp-unsupported", "timestamps are not supported in this version");
  if (v.sealed !== null) throw bad("sealed must be null in a signed bundle");
  checkUnsigned(v);
  const sig = v.signature;
  if (!isObject(sig) || !hasKeys(sig, ["alg", "keyId", "sig"])) throw bad("signature has exactly the keys alg, keyId, sig");
  if (sig.alg !== "Ed25519") throw bad("signature.alg is not Ed25519");
  if (sig.keyId !== (v.meta as BundleMeta).keyId) throw bad("signature.keyId is not meta.keyId");
  if (typeof sig.sig !== "string" || !isB64u(sig.sig, 64)) throw bad("signature.sig is not a 64-byte base64url value");
  return v as unknown as SignedBundle;
}

/** False, never a throw, when the signature does not verify under `pub` or is malformed. */
export function checkSignature(b: SignedBundle, pub: Uint8Array): boolean {
  let sig: Uint8Array;
  try {
    sig = unb64u(b.signature.sig, { bytes: 64 });
    return edVerify(pub, signingInput(b), sig);
  } catch {
    return false;
  }
}

/** F8: the SHA-256 hex of the signing input. */
export function payloadHash(b: UnsignedBundle | SignedBundle): string {
  return sha256Hex(signingInput(b));
}

/** F8: the first 8 hex characters of payloadHash, upper-cased, as XXXX-XXXX. */
export function dossierNo(b: UnsignedBundle | SignedBundle): string {
  const h = payloadHash(b).slice(0, 8).toUpperCase();
  return `${h.slice(0, 4)}-${h.slice(4)}`;
}

const bad = (why: string): TrustError => new TrustError("bad-format", `not an aiprof/2 bundle: ${why}`);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const hasKeys = (o: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(o).sort();
  return own.length === keys.length && own.every((k, i) => k === keys[i]);
};
const isCount = (n: unknown): boolean => Number.isSafeInteger(n) && (n as number) >= 0;

function isB64u(s: string, bytes: number): boolean {
  try {
    unb64u(s, { bytes });
    return true;
  } catch {
    return false;
  }
}

/** A date written as YYYY-MM-DD (and an optional time) that names a real UTC day: 2026-02-30 is refused. */
function realDate(s: string, iso: string): boolean {
  const t = Date.parse(iso);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, s.length) === s;
}

/** "YYYY-MM-DDTHH:MM:SSZ", UTC, to the second. */
function isoSecond(ms: number): string {
  if (!Number.isFinite(ms)) throw new Error("createdAt must be a finite epoch-ms time");
  return new Date(Math.floor(ms / 1000) * 1000).toISOString().replace(/\.000Z$/, "Z");
}

/** F5's shape for everything but `format`, `timestamp`, `sealed` and `signature`. */
function checkUnsigned(v: Record<string, unknown>): void {
  checkMeta(v.meta);
  if (v.invite !== null && (typeof v.invite !== "string" || v.invite === "")) throw bad("invite is a token or null");
  const subject = v.subject;
  if (!isObject(subject) || !hasKeys(subject, ["name"])) throw bad("subject has exactly the key name");
  // The same rule as a company name: 1–80 code points, none of them a control character (so no ANSI escape or newline).
  if (subject.name !== null && !isCompanyName(subject.name)) {
    throw bad(`subject.name is null or 1–${MAX_NAME} characters, with no control characters`);
  }
  if (!isObject(v.payload)) throw bad("payload is an object");
  if (v.exhibits !== null && !isObject(v.exhibits)) throw bad("exhibits is an object or null");
  if (!isObject(v.integrity)) throw bad("integrity is an object");
  checkFingerprints(v.fingerprints);
  const ex = v.exclusions;
  if (!isObject(ex) || !hasKeys(ex, EXCLUSION_KEYS) || !EXCLUSION_KEYS.every((k) => isCount(ex[k]))) {
    throw bad("exclusions holds exactly tools, projects and sessions, each a whole number of at least 0");
  }
}

/** F5's shape of `meta`; a sealed bundle's clear part carries the same meta (F6). */
export function checkMeta(m: unknown): void {
  if (!isObject(m)) throw bad("meta is an object");
  const dev = m.build === "dev";
  if (!dev && m.build !== "release") throw bad("meta.build is release or dev");
  if (!hasKeys(m, dev ? [...META_KEYS, "devKey"].sort() : META_KEYS)) {
    throw bad(`meta has exactly the keys ${META_KEYS.join(", ")}, plus devKey exactly for a dev build`);
  }
  if (typeof m.profiler !== "string" || !VERSION_TEXT.test(m.profiler)) throw bad("meta.profiler is not a version");
  if (typeof m.core !== "string" || !VERSION_TEXT.test(m.core)) throw bad("meta.core is not a version");
  if (typeof m.coreSha !== "string" || !SHA40.test(m.coreSha)) throw bad("meta.coreSha is not 40 lower-case hex characters");
  if (typeof m.createdAt !== "string" || !CREATED_AT.test(m.createdAt) || !realDate(m.createdAt.slice(0, 19), m.createdAt)) {
    throw bad("meta.createdAt is not a UTC time to the second (YYYY-MM-DDTHH:MM:SSZ)");
  }
  if (typeof m.keyId !== "string" || !KEY_ID.test(m.keyId)) throw bad("meta.keyId is not a key id");
  if (dev && (typeof m.devKey !== "string" || !isB64u(m.devKey, 32))) throw bad("meta.devKey is not a 32-byte base64url key");
}

function checkFingerprints(f: unknown): void {
  if (!Array.isArray(f) || f.length > MAX_FINGERPRINTS) throw bad(`fingerprints is a list of at most ${MAX_FINGERPRINTS}`);
  for (const x of f) {
    const ok = isObject(x) && hasKeys(x, FP_KEYS) && typeof x.fp === "string" && FP.test(x.fp) && typeof x.day === "string" && DAY.test(x.day)
      && realDate(x.day, `${x.day}T00:00:00Z`) && typeof x.tool === "string" && TOOL.test(x.tool) && typeof x.size === "string" && SIZES.has(x.size);
    if (!ok) throw bad("each fingerprint is { fp: 32 hex, day: YYYY-MM-DD, tool, size: S, M, L or XL }");
  }
}
