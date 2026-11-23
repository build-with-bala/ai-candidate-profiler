// F3: raw Ed25519 and X25519 keys, hashes and fingerprints, against the RFC vectors V1–V5.
import { describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { createCipheriv, hkdfSync } from "node:crypto";
import { b64u, equalBytes, utf8 } from "../../src/trust/bytes";
import {
  defaultRand,
  displayFingerprint,
  edFromSeed,
  edSign,
  edVerify,
  fingerprint,
  hmac256,
  newEdKey,
  newXKey,
  sha256,
  sha256Hex,
  x25519,
  xFromPriv,
  type Rand,
} from "../../src/trust/keys";
import { codeOf, VEC } from "../kit/keys";

const hex = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "hex"));
const toHex = (b: Uint8Array | ArrayBuffer): string => Buffer.from(b instanceof ArrayBuffer ? new Uint8Array(b) : b).toString("hex");

describe("Ed25519 (F3)", () => {
  test("edFromSeed derives the vector public keys", () => {
    expect(edFromSeed(VEC.t1.seed)).toEqual(VEC.t1);
    expect(edFromSeed(VEC.t2.seed)).toEqual(VEC.t2);
  });

  test("V1: RFC 8032 TEST 1 signs the empty message", () => {
    const sig = edSign(VEC.t1.seed, new Uint8Array(0));
    expect(toHex(sig)).toBe(
      "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
    );
    expect(edVerify(VEC.t1.pub, new Uint8Array(0), sig)).toBe(true);
  });

  test("V2: RFC 8032 TEST 2 signs the message 72", () => {
    const sig = edSign(VEC.t2.seed, Uint8Array.of(0x72));
    expect(toHex(sig)).toBe(
      "92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00",
    );
    expect(edVerify(VEC.t2.pub, Uint8Array.of(0x72), sig)).toBe(true);
  });

  test("edVerify is false, never a throw, on a wrong or malformed input", () => {
    const msg = Uint8Array.of(0x72);
    const sig = edSign(VEC.t2.seed, msg);
    const flipped = sig.slice();
    flipped[63] ^= 0x01;
    const long = new Uint8Array(65);
    long.set(sig);
    expect(edVerify(VEC.t1.pub, msg, sig)).toBe(false); // another key
    expect(edVerify(VEC.t2.pub, Uint8Array.of(0x73), sig)).toBe(false); // another message
    expect(edVerify(VEC.t2.pub, msg, flipped)).toBe(false);
    for (const wrongLength of [new Uint8Array(0), sig.subarray(0, 63), long]) expect(edVerify(VEC.t2.pub, msg, wrongLength)).toBe(false);
    expect(edVerify(VEC.t2.pub.subarray(0, 31), msg, sig)).toBe(false);
    expect(edVerify(new Uint8Array(32).fill(0xff), msg, sig)).toBe(false); // not a point encoding
    expect(edVerify("not bytes" as unknown as Uint8Array, msg, sig)).toBe(false);
  });
});

describe("X25519 (F3)", () => {
  test("xFromPriv derives the vector public keys", () => {
    expect(xFromPriv(VEC.alice.priv)).toEqual(VEC.alice);
    expect(xFromPriv(VEC.bob.priv)).toEqual(VEC.bob);
  });

  test("V3: RFC 7748 §6.1, X25519(alice priv, bob pub), from both sides", () => {
    const shared = "4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742";
    expect(toHex(x25519(VEC.alice.priv, VEC.bob.pub))).toBe(shared);
    expect(toHex(x25519(VEC.bob.priv, VEC.alice.pub))).toBe(shared);
  });

  test("x25519 throws bad-key on a low-order public key, whose shared secret is all zero", () => {
    const one = new Uint8Array(32);
    one[0] = 1;
    expect(codeOf(() => x25519(VEC.alice.priv, new Uint8Array(32)))).toBe("bad-key");
    expect(codeOf(() => x25519(VEC.alice.priv, one))).toBe("bad-key");
  });
});

describe("the seal's primitives, pinned through node:crypto", () => {
  test("V4: HKDF-SHA256, RFC 5869 A.1", () => {
    const okm = hkdfSync("sha256", hex("0b".repeat(22)), hex("000102030405060708090a0b0c"), hex("f0f1f2f3f4f5f6f7f8f9"), 42);
    expect(toHex(okm)).toBe("3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865");
  });

  test("V4b: AES-256-GCM with a zero key and a zero IV", () => {
    const encrypt = (plaintext: Uint8Array) => {
      const cipher = createCipheriv("aes-256-gcm", new Uint8Array(32), new Uint8Array(12));
      const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      return { ct: toHex(ct), tag: toHex(cipher.getAuthTag()) };
    };
    expect(encrypt(new Uint8Array(0))).toEqual({ ct: "", tag: "530f8afbc74536b9a963b4f1c4cb738b" });
    expect(encrypt(new Uint8Array(16))).toEqual({ ct: "cea7403d4d606b6e074ec5d3baf39d18", tag: "d0d1c8a799996bf0265b98b5d48ab919" });
  });
});

describe("fingerprints (F3)", () => {
  test("V5: fingerprint, displayFingerprint and the b64u public key", () => {
    expect(fingerprint(VEC.t1.pub)).toBe("21fe31dfa154a261");
    expect(fingerprint(VEC.t2.pub)).toBe("39f713d0a644253f");
    expect(fingerprint(VEC.bob.pub)).toBe("f35e5616160a30bf");
    expect(displayFingerprint(fingerprint(VEC.t1.pub))).toBe("21FE-31DF-A154-A261");
    expect(b64u(VEC.t1.pub)).toBe("11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo");
  });
});

describe("new keys and their randomness", () => {
  test("newEdKey and newXKey take rand(32) as the private half, so a fixed rand gives a fixed key", () => {
    const asked: number[] = [];
    const rand: Rand = (n) => {
      asked.push(n);
      return Uint8Array.from({ length: n }, (_, i) => i + 1);
    };
    expect(newEdKey(rand)).toEqual(newEdKey(rand));
    expect(newEdKey(rand)).toEqual(edFromSeed(rand(32)));
    expect(newXKey(rand)).toEqual(xFromPriv(rand(32)));
    expect(asked.every((n) => n === 32)).toBe(true);
  });

  test("defaultRand draws fresh bytes, and is the default", () => {
    expect(defaultRand(16)).toHaveLength(16);
    expect(equalBytes(defaultRand(32), defaultRand(32))).toBe(false);
    expect(equalBytes(newEdKey().seed, newEdKey().seed)).toBe(false);
    expect(equalBytes(newXKey().priv, newXKey().priv)).toBe(false);
  });

  test("keys and seeds must be 32 bytes", () => {
    for (const n of [0, 31, 33]) {
      const b = new Uint8Array(n).fill(9);
      expect(codeOf(() => edFromSeed(b))).toBe("bad-key");
      expect(codeOf(() => edSign(b, new Uint8Array(0)))).toBe("bad-key");
      expect(codeOf(() => xFromPriv(b))).toBe("bad-key");
      expect(codeOf(() => x25519(b, VEC.bob.pub))).toBe("bad-key");
      expect(codeOf(() => x25519(VEC.alice.priv, b))).toBe("bad-key");
    }
    expect(codeOf(() => newEdKey(() => new Uint8Array(16)))).toBe("bad-key");
  });
});

describe("hashes", () => {
  test("SHA-256 of bytes, or of text as UTF-8 (FIPS 180-2 'abc')", () => {
    const abc = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    expect(sha256Hex("abc")).toBe(abc);
    expect(toHex(sha256(Uint8Array.of(0x61, 0x62, 0x63)))).toBe(abc);
    expect(sha256Hex("€")).toBe(sha256Hex(Uint8Array.of(0xe2, 0x82, 0xac)));
  });

  test("HMAC-SHA256 (RFC 4231 test case 2)", () => {
    expect(toHex(hmac256(utf8("Jefe"), "what do ya want for nothing?"))).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });
});
