// F6: sealing a signed bundle to the company's X25519 key. The V8 vector, the round trip, the wrong-key and binding
// cases, and the byte-flip tamper suite.
import { describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { createCipheriv, hkdfSync } from "node:crypto";
import { b64u, fromUtf8, unb64u, utf8 } from "../../src/trust/bytes";
import { bundleBytes, checkSignature, readSigned, type SignedBundle } from "../../src/trust/bundle";
import { TrustError } from "../../src/trust/errors";
import { mintInvite } from "../../src/trust/invite";
import { jcs, jcsBytes } from "../../src/trust/jcs";
import { displayFingerprint, fingerprint, newXKey, sha256Hex, x25519, type XKey } from "../../src/trust/keys";
import { openSealed, readSealed, SEAL_ALG, SEAL_INFO, sealBundle, sealedBytes, type SealedBundle } from "../../src/trust/seal";
import { PERSONA_CREATED_AT, personaBundle, sealedPersonaBundle, vectorBundle } from "../kit/bundles";
import { codeOf, testCompany, VEC } from "../kit/keys";

const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");
const bob = (): XKey & { kid: string } => ({ ...VEC.bob, kid: fingerprint(VEC.bob.pub) });
const withKid = (k: XKey): XKey & { kid: string } => ({ ...k, kid: fingerprint(k.pub) });
/** A fresh X25519 key from a seeded byte source, so no private key is ever written in the tree. */
const freshKey = (fill: number): XKey & { kid: string } => withKid(newXKey(() => new Uint8Array(32).fill(fill)));

/** V8: the V7 bundle sealed to VEC.bob with VEC.alice as the ephemeral key. */
const v8 = (): SealedBundle => sealBundle(vectorBundle(), VEC.bob.pub, { ephemeral: VEC.alice });

/** F6 step 3, written out here so the vector checks the derivation independently of seal.ts. */
function derive(e: XKey, r: Uint8Array): { key: Uint8Array; iv: Uint8Array } {
  const okm = new Uint8Array(hkdfSync("sha256", x25519(e.priv, r), Buffer.concat([e.pub, r]), utf8(SEAL_INFO), 44));
  return { key: okm.subarray(0, 32), iv: okm.subarray(32, 44) };
}

/** F6 by hand: seals arbitrary plaintext bytes under the header of `like`, as a forger with the right key would. */
function sealRaw(like: SealedBundle, e: XKey, r: Uint8Array, plaintext: Uint8Array): SealedBundle {
  const { key, iv } = derive(e, r);
  const header: Omit<SealedBundle["sealed"], "ct"> = { alg: SEAL_ALG, kid: fingerprint(r), epk: b64u(e.pub) };
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(jcsBytes({ format: like.format, meta: like.meta, invite: like.invite, sealed: header }));
  const ct = Buffer.concat([c.update(plaintext), c.final(), c.getAuthTag()]);
  return { format: like.format, meta: like.meta, invite: like.invite, sealed: { ...header, ct: b64u(ct) } };
}

/** The sealed file as a mutable JSON tree, changed by `change`, and written back as JCS bytes. */
function edited(s: SealedBundle, change: (o: Record<string, any>) => void): Uint8Array {
  const o = JSON.parse(jcs(s)) as Record<string, any>;
  change(o);
  return jcsBytes(o);
}

/** True when the bytes fail to read, fail to open with bob, or open to a bundle whose signature fails under VEC.t2. */
function rejected(bytes: Uint8Array): boolean {
  let b: SignedBundle;
  try {
    b = openSealed(readSealed(bytes), bob());
  } catch (e) {
    if (e instanceof TrustError) return true;
    throw e;
  }
  return !checkSignature(b, VEC.t2.pub);
}

describe("constants", () => {
  test("match the plan", () => {
    expect(SEAL_ALG).toBe("X25519-HKDF-SHA256-A256GCM");
    expect(SEAL_INFO).toBe("aiprof/2 seal v1");
  });
});

describe("V8", () => {
  const s = v8();
  const bytes = sealedBytes(s);
  const ct = unb64u(s.sealed.ct);

  test("key and iv", () => {
    const { key, iv } = derive(VEC.alice, VEC.bob.pub);
    expect(hex(key)).toBe("085c202071f44d0e247786af1dfbff67affcf39348b36b8d0f90e869fedbb502");
    expect(hex(iv)).toBe("bd7bb02c87539ff7036c044c");
  });

  test("the header, the aad and the plaintext", () => {
    const { ct: _ct, ...header } = s.sealed;
    expect(header).toEqual({ alg: SEAL_ALG, kid: "f35e5616160a30bf", epk: b64u(VEC.alice.pub) });
    expect(s.format).toBe("aiprof/2");
    expect(s.meta).toEqual(vectorBundle().meta);
    expect(s.invite).toBe(vectorBundle().invite!);
    const aad = jcsBytes({ format: s.format, meta: s.meta, invite: s.invite, sealed: header });
    expect(sha256Hex(aad)).toBe("4754459c26a9ce4fbf4d100bfdd406cf5fa74807389b340b7a7051e1290e4c7a");
    const { format: _f, meta: _m, invite: _i, sealed: _s, ...inner } = vectorBundle();
    expect(Object.keys(inner).sort()).toEqual(["exclusions", "exhibits", "fingerprints", "integrity", "payload", "signature", "subject", "timestamp"]);
    const plaintext = jcsBytes(inner);
    expect(plaintext.length).toBe(545);
    expect(sha256Hex(plaintext)).toBe("47bfe8a269abc4156bf99a4f5186c799c5556c2cc9692afff35e6b8439e42792");
  });

  test("ct is 561 bytes (545 + the 16-byte tag), and the tag", () => {
    expect(ct.length).toBe(561);
    expect(hex(ct.subarray(545))).toBe("779b49da1986483d750f0899e4f05228");
  });

  test("the file: 1691 bytes and its SHA-256, holding only format, meta, invite and sealed in the clear", () => {
    expect(bytes.length).toBe(1691);
    expect(sha256Hex(bytes)).toBe("7d339148e66e59b2ce285ff839fff87749b8f373a5efc53eab92013e5816725f");
    expect(Object.keys(JSON.parse(fromUtf8(bytes))).sort()).toEqual(["format", "invite", "meta", "sealed"]);
    expect(Object.keys(JSON.parse(fromUtf8(bytes)).sealed).sort()).toEqual(["alg", "ct", "epk", "kid"]);
  });

  test("readSealed round-trips the file", () => {
    const read = readSealed(bytes);
    expect(read).toEqual(s);
    expect(sealedBytes(read)).toEqual(bytes);
  });
});

describe("round trip", () => {
  test("openSealed with bob gives back the signed bundle, and its signature verifies", () => {
    const opened = openSealed(readSealed(sealedBytes(v8())), bob());
    expect(opened).toEqual(vectorBundle());
    expect(bundleBytes(opened)).toEqual(bundleBytes(vectorBundle()));
    expect(checkSignature(opened, VEC.t2.pub)).toBe(true);
  });

  test("a sealed persona bundle (with a name and every section) opens to the same bundle", () => {
    for (const kind of ["novice", "intermediate", "expert"] as const) {
      const { bundle, sealed, bytes } = sealedPersonaBundle(kind, { name: "Ada" });
      expect(readSealed(bytes)).toEqual(sealed);
      const opened = openSealed(readSealed(bytes), withKid(testCompany().x));
      expect(opened).toEqual(bundle);
      expect(opened.subject.name).toBe("Ada");
      expect(checkSignature(opened, VEC.t2.pub)).toBe(true);
    }
  });

  test("the name and the payload are never in the clear", () => {
    const { bytes } = sealedPersonaBundle("expert", { name: "Ada Lovelace" });
    const text = fromUtf8(bytes);
    for (const s of ["Ada Lovelace", "subject", "payload", "integrity", "fingerprints", "signature"]) expect(text).not.toContain(s);
  });

  test("without an ephemeral key, each seal draws a fresh one from rand, and both open", () => {
    const b = vectorBundle();
    const one = sealBundle(b, VEC.bob.pub, { rand: () => new Uint8Array(32).fill(1) });
    const two = sealBundle(b, VEC.bob.pub);
    expect(one.sealed.epk).toBe(b64u(newXKey(() => new Uint8Array(32).fill(1)).pub));
    expect(two.sealed.epk).not.toBe(one.sealed.epk);
    expect(openSealed(one, bob())).toEqual(b);
    expect(openSealed(two, bob())).toEqual(b);
  });
});

describe("only the company key opens it", () => {
  test("another key is sealed-other-key, naming both display fingerprints (Review Focus 3)", () => {
    const other = freshKey(5);
    let err: unknown;
    try {
      openSealed(v8(), other);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(TrustError);
    expect((err as TrustError).code).toBe("sealed-other-key");
    expect((err as TrustError).message).toContain(displayFingerprint("f35e5616160a30bf"));
    expect((err as TrustError).message).toContain(displayFingerprint(other.kid));
    expect((err as TrustError).message).toBe(`sealed to F35E-5616-160A-30BF; this machine's key is ${displayFingerprint(other.kid)}`);
  });

  test("a header rewritten to the other key's kid and re-serialized is seal-failed", () => {
    const other = freshKey(5);
    const s = readSealed(edited(v8(), (o) => { o.sealed.kid = other.kid; }));
    expect(codeOf(() => openSealed(s, other))).toBe("seal-failed");
  });
});

describe("binding: the clear header is the AAD", () => {
  const s = v8();
  const otherInvite = mintInvite(testCompany(), {
    role: "backend", roleHash: "0".repeat(64), now: PERSONA_CREATED_AT - 86400_000, expiresS: 14 * 86400, fields: ["exhibits", "fingerprints"], seal: true,
  }).token;
  const cases: Record<string, (o: Record<string, any>) => void> = {
    "the invite swapped for another valid token": (o) => { o.invite = otherInvite; },
    "meta.createdAt edited": (o) => { o.meta.createdAt = "2026-11-18T10:42:08Z"; },
    "meta.profiler edited": (o) => { o.meta.profiler = "2.0.1"; },
    "the last 4 characters of ct removed": (o) => { o.sealed.ct = o.sealed.ct.slice(0, -4); },
  };

  test("each change, re-serialized, reads but is seal-failed", () => {
    expect(otherInvite).not.toBe(s.invite);
    for (const [what, change] of Object.entries(cases)) {
      const code = codeOf(() => openSealed(readSealed(edited(s, change)), bob()));
      expect({ what, code }).toEqual({ what, code: "seal-failed" });
    }
  });

  test("a ct shorter than the tag is refused before any decryption", () => {
    expect(codeOf(() => readSealed(edited(s, (o) => { o.sealed.ct = b64u(new Uint8Array(15)); })))).toBe("bad-format");
  });
});

describe("tamper suite (§10)", () => {
  test("XOR 0x01 on every byte of the V8 file fails to read, to open, or to verify", () => {
    const bytes = sealedBytes(v8());
    for (let i = 0; i < bytes.length; i++) {
      const t = new Uint8Array(bytes);
      t[i]! ^= 0x01;
      expect({ i, rejected: rejected(t) }).toEqual({ i, rejected: true });
    }
    expect(rejected(bytes)).toBe(false);
  });
});

describe("readSealed's shape check", () => {
  const s = v8();
  const cases: Record<string, (o: Record<string, any>) => void> = {
    "an extra top-level key": (o) => { o.extra = 1; },
    "a signature in the clear": (o) => { o.signature = null; },
    "a missing invite": (o) => { delete o.invite; },
    "invite null": (o) => { o.invite = null; },
    "format aiprof/1": (o) => { o.format = "aiprof/1"; },
    "sealed null": (o) => { o.sealed = null; },
    "an extra sealed key": (o) => { o.sealed.tag = "x"; },
    "alg A128GCM": (o) => { o.sealed.alg = "X25519-HKDF-SHA256-A128GCM"; },
    "a kid in upper case": (o) => { o.sealed.kid = o.sealed.kid.toUpperCase(); },
    "a 31-byte epk": (o) => { o.sealed.epk = b64u(new Uint8Array(31).fill(9)); },
    "a ct with padding": (o) => { o.sealed.ct += "=="; },
    "a ct that is a number": (o) => { o.sealed.ct = 1; },
    "a missing meta key": (o) => { delete o.meta.coreSha; },
    "an empty top-level object": (o) => { Object.keys(o).forEach((k) => delete o[k]); },
  };

  test("each malformed shape is bad-format", () => {
    for (const [what, change] of Object.entries(cases)) {
      expect({ what, code: codeOf(() => readSealed(edited(s, change))) }).toEqual({ what, code: "bad-format" });
    }
    expect(codeOf(() => readSealed(utf8("[]")))).toBe("bad-format");
  });

  test("a re-indented sealed file is not-canonical", () => {
    expect(codeOf(() => readSealed(utf8(JSON.stringify(s, null, 2))))).toBe("not-canonical");
  });

  test("a signed bundle is not a sealed one", () => {
    expect(codeOf(() => readSealed(bundleBytes(vectorBundle())))).toBe("bad-format");
  });
});

describe("other cases", () => {
  test("a plaintext sealed by hand with 2-space indent is not-canonical", () => {
    const s = v8();
    const { format: _f, meta: _m, invite: _i, sealed: _s, ...inner } = vectorBundle();
    const forged = sealRaw(s, VEC.alice, VEC.bob.pub, utf8(JSON.stringify(JSON.parse(jcs(inner)), null, 2)));
    expect(codeOf(() => openSealed(readSealed(sealedBytes(forged)), bob()))).toBe("not-canonical");
    // The same plaintext written canonically opens, so the indent alone is what fails.
    expect(openSealed(sealRaw(s, VEC.alice, VEC.bob.pub, jcsBytes(inner)), bob())).toEqual(vectorBundle());
  });

  test("a plaintext without exactly the eight inner keys is bad-format", () => {
    const s = v8();
    const { format: _f, meta: _m, invite: _i, sealed: _s, ...inner } = vectorBundle();
    const { subject: _subject, ...seven } = inner;
    expect(codeOf(() => openSealed(sealRaw(s, VEC.alice, VEC.bob.pub, jcsBytes(seven)), bob()))).toBe("bad-format");
    expect(codeOf(() => openSealed(sealRaw(s, VEC.alice, VEC.bob.pub, jcsBytes({ ...inner, sealed: null })), bob()))).toBe("bad-format");
    expect(codeOf(() => openSealed(sealRaw(s, VEC.alice, VEC.bob.pub, jcsBytes({ ...inner, meta: s.meta })), bob()))).toBe("bad-format");
  });

  test("an unbound bundle (invite null) cannot be sealed", () => {
    const { bundle } = personaBundle("novice");
    expect(bundle.invite).toBeNull();
    expect(() => sealBundle(bundle, VEC.bob.pub, { ephemeral: VEC.alice })).toThrow("only a bundle bound to an invite can be sealed");
  });

  test("a recipient of 32 zero bytes is bad-key", () => {
    expect(codeOf(() => sealBundle(vectorBundle(), new Uint8Array(32), { ephemeral: VEC.alice }))).toBe("bad-key");
    expect(codeOf(() => sealBundle(vectorBundle(), new Uint8Array(31), { ephemeral: VEC.alice }))).toBe("bad-key");
  });

  test("an opened bundle still passes readSigned's shape check", () => {
    const opened = openSealed(v8(), bob());
    expect(readSigned(bundleBytes(opened))).toEqual(opened);
  });
});
