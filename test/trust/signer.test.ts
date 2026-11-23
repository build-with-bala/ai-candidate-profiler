// The signer: a release key from the compile-time define, or a one-time dev key.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { b64u, equalBytes, utf8 } from "../../src/trust/bytes";
import { edVerify, fingerprint, type Rand } from "../../src/trust/keys";
import { resolveSigner, signerFromSeed } from "../../src/trust/signer";
import { codeOf, TEST_KEY_ID, testSigner, VEC } from "../kit/keys";

const msg = utf8("aiprof/2 signing input");

describe("an embedded release key", () => {
  test("test-39f713d0:<b64u(VEC.t2.seed)> gives a release signer whose pub is VEC.t2.pub", () => {
    const s = resolveSigner({ embedded: `${TEST_KEY_ID}:${b64u(VEC.t2.seed)}` });
    expect(s.keyId).toBe(TEST_KEY_ID);
    expect(s.build).toBe("release");
    expect(s.pub).toEqual(VEC.t2.pub);
  });

  test("its sign verifies with edVerify, and matches signerFromSeed and testSigner", () => {
    const s = resolveSigner({ embedded: `${TEST_KEY_ID}:${b64u(VEC.t2.seed)}` });
    const sig = s.sign(msg);
    expect(edVerify(VEC.t2.pub, msg, sig)).toBe(true);
    expect(sig).toEqual(signerFromSeed(TEST_KEY_ID, VEC.t2.seed).sign(msg));
    expect(sig).toEqual(testSigner().sign(msg));
    expect(testSigner()).toMatchObject({ keyId: TEST_KEY_ID, build: "release", pub: VEC.t2.pub });
  });

  test("a malformed value throws bad-key", () => {
    const seed = b64u(VEC.t2.seed);
    for (const embedded of ["x", "", ":", `${TEST_KEY_ID}:`, `:${seed}`, `${TEST_KEY_ID}:${seed}:x`, `${TEST_KEY_ID}:${seed}=`,
      `${TEST_KEY_ID}:${b64u(VEC.t2.seed.subarray(0, 31))}`, `dev-39f713d0:${seed}`, `Test:${seed}`]) {
      expect(codeOf(() => resolveSigner({ embedded }))).toBe("bad-key");
    }
  });

  test("the bad-key message never repeats the value", () => {
    const embedded = `Bad:${b64u(VEC.t2.seed)}`;
    try {
      resolveSigner({ embedded });
      throw new Error("no throw");
    } catch (e) {
      expect((e as Error).message).not.toContain(b64u(VEC.t2.seed));
    }
  });

  test("signerFromSeed refuses a key id that is not a release id", () => {
    expect(codeOf(() => signerFromSeed("dev-39f713d0", VEC.t2.seed))).toBe("bad-key");
  });
});

describe("no embedded key: a one-time dev key", () => {
  test("gives a dev signer with an id dev-<first 8 hex of its fingerprint>", () => {
    const s = resolveSigner();
    expect(s.build).toBe("dev");
    expect(s.keyId).toMatch(/^dev-[0-9a-f]{8}$/);
    expect(s.keyId).toBe("dev-" + fingerprint(s.pub).slice(0, 8));
    expect(edVerify(s.pub, msg, s.sign(msg))).toBe(true);
    expect(resolveSigner({}).build).toBe("dev");
  });

  test("two calls give two keys", () => {
    const a = resolveSigner();
    const b = resolveSigner();
    expect(equalBytes(a.pub, b.pub)).toBe(false);
    expect(a.keyId).not.toBe(b.keyId);
  });

  test("a fixed rand gives a fixed key", () => {
    const rand: Rand = (n) => new Uint8Array(VEC.t1.seed.subarray(0, n));
    const a = resolveSigner({ rand });
    expect(a.pub).toEqual(VEC.t1.pub);
    expect(a.keyId).toBe("dev-21fe31df");
    expect(resolveSigner({ rand })).toMatchObject({ keyId: a.keyId, pub: a.pub, build: "dev" });
  });

  test("the compile-time define is read exactly as pinned", () => {
    const src = readFileSync(join(import.meta.dir, "..", "..", "src", "trust", "signer.ts"), "utf8");
    expect(src).toContain("declare const AIPROF_RELEASE_SIGNING_KEY: string | undefined;");
    expect(src).toContain(
      'const EMBEDDED = typeof AIPROF_RELEASE_SIGNING_KEY === "string" ? AIPROF_RELEASE_SIGNING_KEY : undefined;',
    );
  });
});
