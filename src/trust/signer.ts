// The bundle signer. A release binary gets its key only through the compile-time define AIPROF_RELEASE_SIGNING_KEY
// ("<keyId>:<b64u 32-byte seed>"), so the key is never in the repo. Without the define, each run signs with a fresh
// one-time dev key, and its bundles verify as "dev build".
import { unb64u } from "./bytes";
import { TrustError } from "./errors";
import { defaultRand, edFromSeed, edSign, fingerprint, newEdKey, type Rand } from "./keys";
import { isReleaseKeyId } from "./release";

export interface Signer { keyId: string; build: "release" | "dev"; pub: Uint8Array; sign(msg: Uint8Array): Uint8Array }

declare const AIPROF_RELEASE_SIGNING_KEY: string | undefined;
const EMBEDDED = typeof AIPROF_RELEASE_SIGNING_KEY === "string" ? AIPROF_RELEASE_SIGNING_KEY : undefined;

/** A release signer. The seed stays in this closure; the Signer exposes only the public half. */
export function signerFromSeed(keyId: string, seed: Uint8Array): Signer {
  if (!isReleaseKeyId(keyId)) throw new TrustError("bad-key", "the release key id is not ^[a-z][a-z0-9-]{1,31}$ or starts with dev-");
  const key = edFromSeed(seed);
  return { keyId, build: "release", pub: key.pub, sign: (msg) => edSign(key.seed, msg) };
}

function parseEmbedded(embedded: string): Signer {
  const bad = () => new TrustError("bad-key", 'the embedded release signing key is not "<keyId>:<base64url 32-byte seed>"');
  const parts = embedded.split(":");
  if (parts.length !== 2 || !isReleaseKeyId(parts[0])) throw bad();
  let seed: Uint8Array;
  try {
    seed = unb64u(parts[1], { bytes: 32 });
  } catch {
    throw bad();
  }
  return signerFromSeed(parts[0], seed);
}

/** The embedded release key when present (malformed is TrustError "bad-key"), else a one-time dev key. */
export function resolveSigner(o: { embedded?: string; rand?: Rand } = {}): Signer {
  const embedded = o.embedded ?? EMBEDDED;
  if (embedded !== undefined) return parseEmbedded(embedded);
  const key = newEdKey(o.rand ?? defaultRand);
  return { keyId: `dev-${fingerprint(key.pub).slice(0, 8)}`, build: "dev", pub: key.pub, sign: (msg) => edSign(key.seed, msg) };
}
