// Release trust anchors: the shipped release-keys.json plus AIPROF_RELEASE_PUBKEYS.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { b64u } from "../../src/trust/bytes";
import { fingerprint, newEdKey } from "../../src/trust/keys";
import { isReleaseKeyId, loadTrust, SHIPPED, type ReleaseKeysFile } from "../../src/trust/release";
import { VEC } from "../kit/keys";

const envOf = (entries: unknown) => ({ AIPROF_RELEASE_PUBKEYS: typeof entries === "string" ? entries : JSON.stringify(entries) });

/** A shipped list holding one made-up public key, generated at test time. */
function shippedOne(revoked: ReleaseKeysFile["keys"][number]["revoked"] = null): ReleaseKeysFile {
  const pub = newEdKey().pub;
  return { v: 1, keys: [{ keyId: "v2-2026", alg: "Ed25519", pub: b64u(pub), fingerprint: fingerprint(pub), revoked }] };
}

describe("the shipped list", () => {
  test("release-keys.json is exactly {\"v\":1,\"keys\":[]}", () => {
    const text = readFileSync(join(import.meta.dir, "..", "..", "src", "trust", "release-keys.json"), "utf8");
    expect(text.trim()).toBe('{"v":1,"keys":[]}');
    expect(SHIPPED).toEqual({ v: 1, keys: [] });
  });

  test("with no env, trust is empty and there is no error", () => {
    expect(loadTrust({})).toEqual({ keys: new Map(), error: null });
    expect(loadTrust({ AIPROF_RELEASE_PUBKEYS: "" })).toEqual({ keys: new Map(), error: null });
  });

  test("an injected shipped entry loads, with source shipped", () => {
    const shipped = shippedOne();
    const { keys, error } = loadTrust({}, { shipped });
    expect(error).toBeNull();
    expect(keys.get("v2-2026")).toEqual({
      keyId: "v2-2026",
      pub: expect.any(Uint8Array),
      fingerprint: shipped.keys[0].fingerprint,
      source: "shipped",
      revoked: null,
    });
    expect(b64u(keys.get("v2-2026")!.pub)).toBe(shipped.keys[0].pub);
  });

  test("an injected shipped entry with revoked set loads that revocation", () => {
    const revoked = { at: "2027-01-05T00:00:00Z", reason: "key rotated" };
    expect(loadTrust({}, { shipped: shippedOne(revoked) }).keys.get("v2-2026")?.revoked).toEqual(revoked);
  });

  test("a shipped entry whose fingerprint does not match its pub is an error", () => {
    const shipped = shippedOne();
    shipped.keys[0].fingerprint = "0000000000000000";
    const { keys, error } = loadTrust({}, { shipped });
    expect(error).toMatch(/release-keys\.json/);
    expect(keys.size).toBe(0);
  });
});

describe("AIPROF_RELEASE_PUBKEYS", () => {
  test("a valid entry loads with source env", () => {
    const { keys, error } = loadTrust(envOf([{ keyId: "test-39f713d0", alg: "Ed25519", pub: b64u(VEC.t2.pub) }]));
    expect(error).toBeNull();
    expect(keys).toEqual(
      new Map([["test-39f713d0", { keyId: "test-39f713d0", pub: VEC.t2.pub, fingerprint: "39f713d0a644253f", source: "env", revoked: null }]]),
    );
  });

  test("env keys sit beside the shipped ones", () => {
    const { keys, error } = loadTrust(envOf([{ keyId: "ci-key", alg: "Ed25519", pub: b64u(VEC.t2.pub) }]), { shipped: shippedOne() });
    expect(error).toBeNull();
    expect([...keys.values()].map((k) => [k.keyId, k.source])).toEqual([["v2-2026", "shipped"], ["ci-key", "env"]]);
  });

  const good = { keyId: "ci-key", alg: "Ed25519", pub: b64u(VEC.t2.pub) };
  const BAD: ReadonlyArray<readonly [string, unknown]> = [
    ["malformed JSON", "[{"],
    ["an object, not an array", JSON.stringify(good)],
    ["null", "null"],
    ["an entry that is not an object", [good, "ci-key"]],
    ["a 31-byte pub", [{ ...good, pub: b64u(VEC.t2.pub.subarray(0, 31)) }]],
    ["a 33-byte pub", [{ ...good, pub: b64u(new Uint8Array(33)) }]],
    ["a padded pub", [{ ...good, pub: b64u(VEC.t2.pub) + "=" }]],
    ["a dev- id", [{ ...good, keyId: "dev-39f713d0" }]],
    ["an id against the pattern", [{ ...good, keyId: "Test" }]],
    ["a one-character id", [{ ...good, keyId: "t" }]],
    ["an id of 33 characters", [{ ...good, keyId: "t" + "x".repeat(32) }]],
    ["another alg", [{ ...good, alg: "RS256" }]],
    ["a missing pub", [{ keyId: "ci-key", alg: "Ed25519" }]],
    ["an extra member", [{ ...good, revoked: null }]],
    ["a duplicate id", [good, good]],
  ];
  test.each(BAD)("%s sets error", (_, entries) => {
    const { keys, error } = loadTrust(envOf(entries));
    expect(error).toMatch(/^AIPROF_RELEASE_PUBKEYS/);
    expect(keys.size).toBe(0);
  });

  test("a shipped id sets error", () => {
    const shipped = shippedOne();
    const { keys, error } = loadTrust(envOf([{ ...good, keyId: "v2-2026" }]), { shipped });
    expect(error).toMatch(/^AIPROF_RELEASE_PUBKEYS.*shipped/);
    expect(keys.get("v2-2026")?.source).toBe("shipped"); // the shipped key is never replaced
  });

  test("an error never repeats the value", () => {
    const secretish = "not-json-" + b64u(newEdKey().seed);
    expect(loadTrust(envOf(secretish)).error).not.toContain(secretish.slice(9));
  });
});

test("isReleaseKeyId follows F3", () => {
  for (const id of ["test-39f713d0", "v2", "ci-key", "a" + "b".repeat(31)]) expect(isReleaseKeyId(id)).toBe(true);
  for (const id of ["dev-39f713d0", "a", "2v", "V2", "v2_key", "a" + "b".repeat(32), "", 7]) expect(isReleaseKeyId(id)).toBe(false);
});
