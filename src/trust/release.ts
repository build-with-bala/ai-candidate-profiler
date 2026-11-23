// Release trust anchors: the public keys shipped in release-keys.json, plus any given in AIPROF_RELEASE_PUBKEYS.
// The private release key never reaches the repo (signer.ts). Error messages never repeat the value they reject.
import { unb64u } from "./bytes";
import { fingerprint } from "./keys";
import shipped from "./release-keys.json";

export interface ReleaseKeysFile { v: 1; keys: Array<{ keyId: string; alg: "Ed25519"; pub: string; fingerprint: string; revoked: null | { at: string; reason: string } }> }
export interface TrustedKey { keyId: string; pub: Uint8Array; fingerprint: string; source: "shipped" | "env"; revoked: null | { at: string; reason: string } }

export const SHIPPED: ReleaseKeysFile = shipped as ReleaseKeysFile;

const RELEASE_KEY_ID = /^[a-z][a-z0-9-]{1,31}$/;

/** F3: a release key id matches ^[a-z][a-z0-9-]{1,31}$ and never starts with "dev-". */
export function isReleaseKeyId(id: unknown): id is string {
  return typeof id === "string" && RELEASE_KEY_ID.test(id) && !id.startsWith("dev-");
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const hasExactly = (o: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(o).length === keys.length && keys.every((k) => Object.hasOwn(o, k));

function pub32(v: unknown): Uint8Array | null {
  if (typeof v !== "string") return null;
  try {
    return unb64u(v, { bytes: 32 });
  } catch {
    return null;
  }
}

function isRevocation(v: unknown): v is ReleaseKeysFile["keys"][number]["revoked"] {
  return v === null || (isObject(v) && hasExactly(v, ["at", "reason"]) && typeof v.at === "string" && typeof v.reason === "string");
}

function loadShipped(file: ReleaseKeysFile): Map<string, TrustedKey> | string {
  const keys = new Map<string, TrustedKey>();
  if (!isObject(file) || file.v !== 1 || !Array.isArray(file.keys)) return "release-keys.json is malformed";
  for (const [i, e] of file.keys.entries()) {
    const ok = isObject(e) && hasExactly(e, ["keyId", "alg", "pub", "fingerprint", "revoked"]) && isReleaseKeyId(e.keyId) && e.alg === "Ed25519";
    const pub = ok ? pub32(e.pub) : null;
    if (!ok || pub === null || e.fingerprint !== fingerprint(pub) || !isRevocation(e.revoked) || keys.has(e.keyId)) {
      return `release-keys.json entry ${i + 1} is malformed`;
    }
    keys.set(e.keyId, { keyId: e.keyId, pub, fingerprint: e.fingerprint, source: "shipped", revoked: e.revoked });
  }
  return keys;
}

const ENV_SHAPE = 'a JSON array of { "keyId", "alg": "Ed25519", "pub" }';

/** The env keys, or an error that names the variable and the entry. */
function loadEnv(raw: string, shippedKeys: Map<string, TrustedKey>): TrustedKey[] | string {
  const fail = (why: string) => `AIPROF_RELEASE_PUBKEYS: ${why}`;
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return fail(`not JSON; expected ${ENV_SHAPE}`);
  }
  if (!Array.isArray(list)) return fail(`expected ${ENV_SHAPE}`);
  const out: TrustedKey[] = [];
  for (const [i, e] of list.entries()) {
    const at = `entry ${i + 1}`;
    if (!isObject(e) || !hasExactly(e, ["keyId", "alg", "pub"])) return fail(`${at} must have exactly keyId, alg and pub`);
    if (!isReleaseKeyId(e.keyId)) return fail(`${at} has a keyId that is not a release key id (^[a-z][a-z0-9-]{1,31}$, never dev-)`);
    if (shippedKeys.has(e.keyId)) return fail(`${at} reuses the id of a shipped key`);
    if (out.some((k) => k.keyId === e.keyId)) return fail(`${at} repeats a keyId`);
    if (e.alg !== "Ed25519") return fail(`${at} must have alg "Ed25519"`);
    const pub = pub32(e.pub);
    if (pub === null) return fail(`${at} must have a pub of 32 bytes in base64url`);
    out.push({ keyId: e.keyId, pub, fingerprint: fingerprint(pub), source: "env", revoked: null });
  }
  return out;
}

/**
 * The trusted release keys. Any malformed input sets `error` (callers exit 2 with it); the keys then hold only the
 * shipped list, or nothing when the shipped list itself is malformed.
 */
export function loadTrust(vars: Readonly<Record<string, string | undefined>>, o: { shipped?: ReleaseKeysFile } = {}): { keys: Map<string, TrustedKey>; error: string | null } {
  const base = loadShipped(o.shipped ?? SHIPPED);
  if (typeof base === "string") return { keys: new Map(), error: base };
  const raw = vars.AIPROF_RELEASE_PUBKEYS;
  if (raw === undefined || raw === "") return { keys: base, error: null };
  const env = loadEnv(raw, base);
  if (typeof env === "string") return { keys: base, error: env };
  for (const k of env) base.set(k.keyId, k);
  return { keys: base, error: null };
}
