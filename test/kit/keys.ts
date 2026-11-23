// Test keys and fixtures for the trust layer. Every key here is a published RFC test vector; none is ever a trust
// anchor, and release-keys.json may never hold one (test/repo/no-private-keys.test.ts).
import { Buffer } from "node:buffer";
import { join } from "node:path";
import type { Sys } from "../../src/home";
import type { Company } from "../../src/trust/company";
import { TrustError, type TrustCode } from "../../src/trust/errors";
import { fingerprint, type EdKey, type XKey } from "../../src/trust/keys";
import type { TrustedKey } from "../../src/trust/release";
import { signerFromSeed, type Signer } from "../../src/trust/signer";

const hex = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "hex"));

/** The published vector keys (RFC 8032 §7.1 TEST 1 and 2, RFC 7748 §6.1). They are never trust anchors. */
export const VEC: { t1: EdKey; t2: EdKey; alice: XKey; bob: XKey } = {
  t1: {
    seed: hex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60"),
    pub: hex("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"),
  },
  t2: {
    seed: hex("4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb"),
    pub: hex("3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c"),
  },
  alice: {
    priv: hex("77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a"),
    pub: hex("8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a"),
  },
  bob: {
    priv: hex("5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb"),
    pub: hex("de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f"),
  },
};

/** The release key id of the test signer: "test-" plus the first 8 hex characters of VEC.t2's fingerprint. */
export const TEST_KEY_ID = "test-39f713d0";

/** A release signer over VEC.t2, under TEST_KEY_ID. */
export function testSigner(): Signer {
  return signerFromSeed(TEST_KEY_ID, VEC.t2.seed);
}

/** Trust in the test signer's key only, as if it came from AIPROF_RELEASE_PUBKEYS. */
export function testTrust(): Map<string, TrustedKey> {
  const pub = new Uint8Array(VEC.t2.pub);
  return new Map([[TEST_KEY_ID, { keyId: TEST_KEY_ID, pub, fingerprint: fingerprint(pub), source: "env", revoked: null }]]);
}

/** A company whose Ed25519 key is VEC.t1 and whose X25519 key is VEC.bob. */
export function testCompany(name = "Example Co"): Company {
  return {
    name,
    ed: { seed: new Uint8Array(VEC.t1.seed), pub: new Uint8Array(VEC.t1.pub), kid: fingerprint(VEC.t1.pub) },
    x: { priv: new Uint8Array(VEC.bob.priv), pub: new Uint8Array(VEC.bob.pub), kid: fingerprint(VEC.bob.pub) },
  };
}

/** A system rooted in a temp folder: home is <root>/home and AIPROF_HOME is <root>/aiprof, so the real home is never touched. */
export function testSys(root: string, vars: Record<string, string> = {}): Sys {
  return { home: join(root, "home"), vars: { AIPROF_HOME: join(root, "aiprof"), ...vars }, platform: process.platform as Sys["platform"] };
}

/** The code of the TrustError that f throws, or "no throw". Any other throw fails the test. */
export function codeOf(f: () => unknown): TrustCode | "no throw" {
  try {
    f();
  } catch (e) {
    if (e instanceof TrustError) return e.code;
    throw e;
  }
  return "no throw";
}
