// F5: aiprof/2 bundles. Sections, assembly, the signing input, signatures, canonical file bytes, and the tamper suite.
import { describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { b64u, fromUtf8, utf8 } from "../../src/trust/bytes";
import {
  assemble, BUNDLE_BUDGET, BUNDLE_READ_MAX, bundleBytes, checkSignature, dossierNo, FORMAT, metaCoreSha, payloadHash, readSigned, signBundle, signingInput,
  type AssembleInput, type SignedBundle,
} from "../../src/trust/bundle";
import { TrustError } from "../../src/trust/errors";
import { mintInvite, OPTIONAL_FIELDS, type InviteField } from "../../src/trust/invite";
import { jcs, jcsBytes } from "../../src/trust/jcs";
import { fingerprint, sha256Hex } from "../../src/trust/keys";
import { filterPayload, REQUIRED_KEYS, SECTION_KEYS } from "../../src/trust/sections";
import { resolveSigner } from "../../src/trust/signer";
import { CORE_PIN, VERSION } from "../../src/version";
import { PERSONA_CREATED_AT, personaBundle, personaExhibits, personaExport, seeded, v6Invite, vectorBundle, vectorUnsigned } from "../kit/bundles";
import { codeOf, testCompany, testSigner, VEC } from "../kit/keys";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const V7_SIG = "xboFqdBnign8mQMslWGpHAzzOZ3kdrv-CP5h2crNAb1Il0wYVBlfnUkt3LKvESQAd-dAVMy3rPrcGOcK_sgEDg";
const DAY = 86400;

/** True when the bytes fail to read as a signed bundle, or read but do not verify under `pub`. */
function rejected(bytes: Uint8Array, pub: Uint8Array): boolean {
  let b: SignedBundle;
  try {
    b = readSigned(bytes);
  } catch (e) {
    if (e instanceof TrustError) return true;
    throw e;
  }
  return !checkSignature(b, pub);
}

/** The bundle as a mutable JSON tree, changed by `change`, and written back as JCS bytes. */
function edited(b: SignedBundle, change: (o: Record<string, any>) => void): Uint8Array {
  const o = JSON.parse(jcs(b)) as Record<string, any>;
  change(o);
  return jcsBytes(o);
}

function input(o: Partial<AssembleInput> = {}): AssembleInput {
  return {
    exported: personaExport("expert"),
    invite: null,
    name: null,
    exhibits: personaExhibits("expert"),
    fingerprints: [],
    exclusions: { tools: 0, projects: 0, sessions: 0 },
    signer: testSigner(),
    createdAt: PERSONA_CREATED_AT,
    ...o,
  };
}

function inviteFor(fields: readonly InviteField[]) {
  return mintInvite(testCompany(), { role: "backend", roleHash: "0".repeat(64), now: PERSONA_CREATED_AT - DAY * 1000, expiresS: 14 * DAY, fields, seal: false });
}

describe("constants", () => {
  test("match the plan", () => {
    expect(FORMAT).toBe("aiprof/2");
    expect(BUNDLE_READ_MAX).toBe(8 * 1024 * 1024);
    expect(BUNDLE_BUDGET).toBe(400_000);
    expect(REQUIRED_KEYS).toEqual(["schema", "core", "reference", "coverage", "overall", "dimensions", "exclusions"]);
    const optional = OPTIONAL_FIELDS.filter((f) => f !== "exhibits" && f !== "fingerprints");
    expect(Object.keys(SECTION_KEYS).sort()).toEqual([...optional]);
    for (const f of optional) expect(SECTION_KEYS[f as keyof typeof SECTION_KEYS][0]).toBe(f);
    expect(SECTION_KEYS.projects).toEqual(["projects", "otherProjects"]);
  });
});

describe("V7", () => {
  const b = vectorBundle();
  const bytes = bundleBytes(b);

  test("the signing input: 1204 bytes, no timestamp key, but sealed: null", () => {
    const si = signingInput(b);
    expect(si.length).toBe(1204);
    expect(sha256Hex(si)).toBe("9282a29039f7641355b7dd3d08bb19095f0ba7d7e6f3764b77bd6d97efaac575");
    const text = fromUtf8(si);
    expect(text).not.toContain('"timestamp"');
    expect(text).not.toContain('"signature"');
    expect(text).toContain('"sealed":null');
    expect(signingInput(vectorUnsigned())).toEqual(si);
  });

  test("the signature, the file and the dossier number", () => {
    expect(b.signature).toEqual({ alg: "Ed25519", keyId: "test-39f713d0", sig: V7_SIG });
    expect(bytes.length).toBe(1370);
    expect(sha256Hex(bytes)).toBe("a68461f60fddb4a8dbcdc9ca7c3265241c6320e2f3c1586c1d3bf02a7cdfb414");
    expect(payloadHash(b)).toBe("9282a29039f7641355b7dd3d08bb19095f0ba7d7e6f3764b77bd6d97efaac575");
    expect(dossierNo(b)).toBe("9282-A290");
    expect(dossierNo(vectorUnsigned())).toBe("9282-A290");
  });

  test("readSigned round-trips the file, and the signature verifies only under VEC.t2", () => {
    const read = readSigned(bytes);
    expect(read).toEqual(b);
    expect(bundleBytes(read)).toEqual(bytes);
    expect(checkSignature(read, VEC.t2.pub)).toBe(true);
    expect(checkSignature(read, VEC.t1.pub)).toBe(false);
    expect(checkSignature(read, new Uint8Array(31))).toBe(false);
  });

  test("signBundle refuses a signer whose key id is not the bundle's", () => {
    const other = resolveSigner({ rand: () => new Uint8Array(32).fill(7) });
    expect(() => signBundle(vectorUnsigned(), other)).toThrow("the signer's key id is not the bundle's meta.keyId");
  });
});

describe("filterPayload", () => {
  const value = personaExport("expert").value as Record<string, unknown>;

  test("keeps the required keys plus the requested sections, never forensics", () => {
    expect(Object.keys(filterPayload(value, [])).sort()).toEqual([...REQUIRED_KEYS].sort());
    expect(Object.keys(filterPayload(value, ["stack", "exhibits"])).sort()).toEqual([...REQUIRED_KEYS, "stack"].sort());
    expect(Object.keys(filterPayload(value, ["projects"])).sort()).toEqual([...REQUIRED_KEYS, "otherProjects", "projects"].sort());
    expect(filterPayload(value, [...OPTIONAL_FIELDS])).not.toHaveProperty("forensics");
  });

  test("drops undeclared keys and refuses an export without a required key", () => {
    expect(filterPayload({ ...value, extra: 1, raw: "x" }, [...OPTIONAL_FIELDS])).not.toContainAnyKeys(["extra", "raw"]);
    const { overall: _, ...partial } = value;
    expect(() => filterPayload(partial, [])).toThrow("the export has no overall");
  });
});

describe("assemble (expert persona)", () => {
  const exported = personaExport("expert");
  const value = exported.value as Record<string, unknown>;

  test("lifts forensics out of the payload into integrity", () => {
    const u = assemble(input());
    expect(u.payload).not.toHaveProperty("forensics");
    expect(u.integrity).toEqual(value.forensics as Record<string, unknown>);
  });

  test("an invite requesting only fingerprints ships the required keys, no exhibits, and the fingerprints", () => {
    const fps = [{ fp: "c1f6af6c44d0ef639be976ee2e3f111d", day: "2026-11-02", tool: "claude-code", size: "L" as const }];
    const invite = inviteFor(["fingerprints"]);
    const u = assemble(input({ invite, fingerprints: fps }));
    expect(Object.keys(u.payload).sort()).toEqual([...REQUIRED_KEYS].sort());
    expect(u.exhibits).toBeNull();
    expect(u.fingerprints).toEqual(fps);
    expect(u.invite).toBe(invite.token);
  });

  test("an invite that does not request fingerprints ships [] and, with exhibits, the exhibits", () => {
    const fps = [{ fp: "c1f6af6c44d0ef639be976ee2e3f111d", day: "2026-11-02", tool: "claude-code", size: "L" as const }];
    const u = assemble(input({ invite: inviteFor(["exhibits", "stack"]), fingerprints: fps }));
    expect(u.fingerprints).toEqual([]);
    expect(u.exhibits).toEqual(personaExhibits("expert"));
    expect(Object.keys(u.payload).sort()).toEqual([...REQUIRED_KEYS, "stack"].sort());
  });

  test("an unbound bundle has every section and the exhibits, but never fingerprints (pre-flight G9)", () => {
    const fps = [{ fp: "c1f6af6c44d0ef639be976ee2e3f111d", day: "2026-11-02", tool: "claude-code", size: "L" as const }];
    const u = assemble(input({ fingerprints: fps }));
    const { forensics: _, ...rest } = value;
    expect(u.payload).toEqual(rest);
    expect(u.exhibits).toEqual(personaExhibits("expert"));
    expect(u.fingerprints).toEqual([]);
    expect(u.invite).toBeNull();
  });

  test("every key of the export is declared: required, a section, or forensics", () => {
    const declared = new Set([...REQUIRED_KEYS, ...Object.values(SECTION_KEYS).flat(), "forensics"]);
    for (const kind of ["novice", "intermediate", "expert"] as const) {
      for (const key of Object.keys(personaExport(kind).value as object)) expect({ kind, key, declared: declared.has(key) }).toEqual({ kind, key, declared: true });
    }
  });

  test("meta: versions from src/version.ts, createdAt in UTC to the second, the subject's name and the exclusions", () => {
    const u = assemble(input({ createdAt: PERSONA_CREATED_AT + 999, name: "Ada", exclusions: { tools: 1, projects: 2, sessions: 3 } }));
    expect(u.meta).toEqual({ profiler: VERSION, core: "1.0.0", coreSha: CORE_PIN.sha || "0".repeat(40), createdAt: "2026-11-18T10:42:07Z", keyId: "test-39f713d0", build: "release" });
    expect(u.subject).toEqual({ name: "Ada" });
    expect(u.exclusions).toEqual({ tools: 1, projects: 2, sessions: 3 });
    expect(u.timestamp).toBeNull();
    expect(u.sealed).toBeNull();
    expect(u.format).toBe("aiprof/2");
  });

  test("coreSha is the pinned sha, 40 zeros only while the pin is empty, and an Error for any other pin", () => {
    expect(assemble(input()).meta.coreSha).toBe(CORE_PIN.sha || "0".repeat(40));
    expect(metaCoreSha("")).toBe("0".repeat(40));
    expect(metaCoreSha("0123456789abcdef0123456789abcdef01234567")).toBe("0123456789abcdef0123456789abcdef01234567");
    for (const pin of ["main", "0".repeat(39), "0".repeat(41), "0123456789ABCDEF0123456789ABCDEF01234567", " ".repeat(40)]) {
      expect(() => metaCoreSha(pin)).toThrow("package.json corePin.sha is not a 40-hex commit sha");
    }
  });

  test("a dev signer sets devKey to its public key; a release signer does not", () => {
    const dev = resolveSigner({ rand: () => new Uint8Array(32).fill(9) });
    expect(dev.build).toBe("dev");
    const d = assemble(input({ signer: dev }));
    expect(d.meta).toMatchObject({ build: "dev", keyId: dev.keyId, devKey: b64u(dev.pub) });
    expect(d.meta.keyId).toBe(`dev-${fingerprint(dev.pub).slice(0, 8)}`);
    const signed = signBundle(d, dev);
    expect(checkSignature(readSigned(bundleBytes(signed)), dev.pub)).toBe(true);
    expect(assemble(input()).meta).not.toHaveProperty("devKey");
  });

  test("refuses an export that is not aiprof/2 or has no forensics, and a name the reader would refuse", () => {
    expect(() => assemble(input({ exported: { ...exported, schema: "aiprof/1" as "aiprof/2" } }))).toThrow();
    const { forensics: _, ...noForensics } = value;
    expect(() => assemble(input({ exported: { ...exported, value: noForensics } }))).toThrow("the export has no forensics");
    expect(() => assemble(input({ exported: { ...exported, value: [] } }))).toThrow();
    expect(codeOf(() => assemble(input({ name: "" })))).toBe("bad-format");
    expect(codeOf(() => assemble(input({ name: "x".repeat(81) })))).toBe("bad-format");
    expect(codeOf(() => assemble(input({ name: "\u001b[31mAda\u001b[0m" })))).toBe("bad-format");
    expect(codeOf(() => assemble(input({ name: "Ada\nLovelace" })))).toBe("bad-format");
    expect(codeOf(() => assemble(input({ name: "Ada\u0085" })))).toBe("bad-format");
  });
});

describe("personaBundle", () => {
  test("each persona signs, reads back and verifies; an invite and a name are carried", () => {
    for (const kind of ["novice", "intermediate", "expert"] as const) {
      const { bundle, bytes } = personaBundle(kind);
      expect(readSigned(bytes)).toEqual(bundle);
      expect(checkSignature(bundle, VEC.t2.pub)).toBe(true);
    }
    const invite = v6Invite();
    const { bundle } = personaBundle("novice", { invite, name: "Ada" });
    expect(bundle.invite).toBe(invite.token);
    expect(bundle.subject.name).toBe("Ada");
  });
});

describe("readSigned's shape check (F5)", () => {
  const b = vectorBundle();
  const cases: Record<string, (o: Record<string, any>) => void> = {
    "an extra top-level key": (o) => { o.extra = 1; },
    "a missing top-level key": (o) => { delete o.exhibits; },
    "a __proto__ top-level key": (o) => { Object.defineProperty(o, "__proto__", { value: {}, enumerable: true }); },
    "format aiprof/1": (o) => { o.format = "aiprof/1"; },
    "an extra meta key": (o) => { o.meta.extra = 1; },
    "a missing meta key": (o) => { delete o.meta.coreSha; },
    "devKey on a release build": (o) => { o.meta.devKey = b64u(VEC.t2.pub); },
    "a dev build without devKey": (o) => { o.meta.build = "dev"; },
    "build beta": (o) => { o.meta.build = "beta"; },
    "a short coreSha": (o) => { o.meta.coreSha = "0".repeat(39); },
    "createdAt with milliseconds": (o) => { o.meta.createdAt = "2026-11-18T10:42:07.000Z"; },
    "createdAt that is not a date": (o) => { o.meta.createdAt = "2026-13-45T10:42:07Z"; },
    "a profiler version holding a newline": (o) => { o.meta.profiler = "2.0.0\n"; },
    "alg EdDSA": (o) => { o.signature.alg = "EdDSA"; },
    "signature.keyId unlike meta.keyId": (o) => { o.signature.keyId = "test-00000000"; },
    "an extra signature key": (o) => { o.signature.extra = 1; },
    "a 63-byte sig": (o) => { o.signature.sig = b64u(new Uint8Array(63)); },
    "sealed not null": (o) => { o.sealed = {}; },
    "an invite that is a number": (o) => { o.invite = 1; },
    "9 fingerprints": (o) => { o.fingerprints = Array.from({ length: 9 }, () => o.fingerprints[0]); },
    "a fingerprint fp in upper case": (o) => { o.fingerprints[0].fp = "C1F6AF6C44D0EF639BE976EE2E3F111D"; },
    "a fingerprint size XXL": (o) => { o.fingerprints[0].size = "XXL"; },
    "a fingerprint day that is not a date": (o) => { o.fingerprints[0].day = "2026-02-30"; },
    "an extra fingerprint key": (o) => { o.fingerprints[0].sessionId = "x"; },
    "a fingerprint with no tool": (o) => { delete o.fingerprints[0].tool; },
    "negative exclusions": (o) => { o.exclusions.tools = -1; },
    "fractional exclusions": (o) => { o.exclusions.sessions = 1.5; },
    "an extra exclusions key": (o) => { o.exclusions.days = 0; },
    "an empty subject name": (o) => { o.subject.name = ""; },
    "an 81-character subject name": (o) => { o.subject.name = "x".repeat(81); },
    "an extra subject key": (o) => { o.subject.email = null; },
    "a subject name holding an ANSI escape": (o) => { o.subject.name = "\u001b[2J\u001b[31mAda"; },
    "a subject name holding a newline": (o) => { o.subject.name = "Ada\nLovelace"; },
    "a payload that is an array": (o) => { o.payload = []; },
    "integrity null": (o) => { o.integrity = null; },
    "exhibits that are a string": (o) => { o.exhibits = "x"; },
    "an empty top-level object": (o) => { Object.keys(o).forEach((k) => delete o[k]); },
  };

  test("each malformed shape is bad-format", () => {
    for (const [what, change] of Object.entries(cases)) {
      expect({ what, code: codeOf(() => readSigned(edited(b, change))) }).toEqual({ what, code: "bad-format" });
    }
    expect(codeOf(() => readSigned(utf8("[]")))).toBe("bad-format");
    expect(codeOf(() => readSigned(utf8("null")))).toBe("bad-format");
    expect(Object.prototype).not.toHaveProperty("meta");
  });

  test("a non-null timestamp is timestamp-unsupported", () => {
    expect(codeOf(() => readSigned(edited(b, (o) => { o.timestamp = { tsa: "x" }; })))).toBe("timestamp-unsupported");
  });

  test("an 80-character name (code points, not code units) and a well-formed dev build pass the shape check", () => {
    expect(readSigned(edited(b, (o) => { o.subject.name = "😀".repeat(80); })).subject.name).toBe("😀".repeat(80));
    const dev = readSigned(edited(b, (o) => { o.meta.build = "dev"; o.meta.devKey = b64u(VEC.t1.pub); }));
    expect(dev.meta.devKey).toBe(b64u(VEC.t1.pub));
    expect(checkSignature(dev, VEC.t2.pub)).toBe(false); // the meta changed, so the signature no longer holds
  });
});

describe("dropped sections stay dropped", () => {
  test("a section re-added to a bundle whose invite left it out, then re-canonicalized, no longer verifies", () => {
    const { bundle } = personaBundle("expert", { invite: inviteFor(["stack"]) });
    expect(bundle.payload).not.toHaveProperty("signals");
    expect(checkSignature(bundle, VEC.t2.pub)).toBe(true);
    const signals = (personaExport("expert").value as Record<string, unknown>).signals;
    const readded = readSigned(edited(bundle, (o) => { o.payload.signals = signals; }));
    expect(readded.payload.signals).toEqual(signals);
    expect(checkSignature(readded, VEC.t2.pub)).toBe(false);
  });

  test("fingerprints added to a bundle whose invite did not request them no longer verify", () => {
    const { bundle } = personaBundle("expert", { invite: inviteFor(["exhibits"]) });
    expect(bundle.fingerprints).toEqual([]);
    const fps = [{ fp: "c1f6af6c44d0ef639be976ee2e3f111d", day: "2026-11-02", tool: "claude-code", size: "L" }];
    const readded = readSigned(edited(bundle, (o) => { o.fingerprints = fps; }));
    expect(readded.fingerprints).toEqual(fps as SignedBundle["fingerprints"]);
    expect(checkSignature(readded, VEC.t2.pub)).toBe(false);
  });
});

describe("tamper suite (§10)", () => {
  test("XOR 0x01 on every byte of the V7 file fails to read or to verify", () => {
    const bytes = bundleBytes(vectorBundle());
    for (let i = 0; i < bytes.length; i++) {
      const t = new Uint8Array(bytes);
      t[i]! ^= 0x01;
      expect({ i, rejected: rejected(t, VEC.t2.pub) }).toEqual({ i, rejected: true });
    }
    expect(rejected(bytes, VEC.t2.pub)).toBe(false);
  });

  test("500 seeded positions × masks 0x01, 0x20 and 0x80 on the expert persona bundle all fail", () => {
    const { bytes } = personaBundle("expert");
    const r = seeded(6);
    let cases = 0;
    for (let k = 0; k < 500; k++) {
      const i = Math.floor(r() * bytes.length);
      for (const mask of [0x01, 0x20, 0x80]) {
        const t = new Uint8Array(bytes);
        t[i]! ^= mask;
        expect({ i, mask, rejected: rejected(t, VEC.t2.pub) }).toEqual({ i, mask, rejected: true });
        cases++;
      }
    }
    expect(cases).toBe(1500);
  });

  test("a sig whose last character differs only in its unused bits is refused, though a lenient decoder reads the same bytes", () => {
    const b = vectorBundle();
    const last = ALPHABET.indexOf(V7_SIG.slice(-1));
    expect(last & 0xf).toBe(0);
    for (let unused = 1; unused <= 0xf; unused++) {
      const variant = V7_SIG.slice(0, -1) + ALPHABET[last | unused];
      expect(new Uint8Array(Buffer.from(variant, "base64url"))).toEqual(new Uint8Array(Buffer.from(V7_SIG, "base64url")));
      const bytes = edited(b, (o) => { o.signature.sig = variant; });
      expect(codeOf(() => readSigned(bytes))).toBe("bad-format");
    }
    for (const sig of [V7_SIG + "==", V7_SIG.replace("-", "+"), V7_SIG.replace("_", "/"), V7_SIG.slice(0, -1), ` ${V7_SIG}`]) {
      expect(codeOf(() => readSigned(edited(b, (o) => { o.signature.sig = sig; })))).toBe("bad-format");
    }
  });
});

describe("re-saves are not-canonical", () => {
  const bytes = bundleBytes(vectorBundle());
  const text = fromUtf8(bytes);
  const pretty = JSON.stringify(JSON.parse(text), null, 2);
  const cases: Record<string, Uint8Array> = {
    "2-space indent": utf8(pretty),
    "a trailing newline": utf8(text + "\n"),
    "a BOM": new Uint8Array([0xef, 0xbb, 0xbf, ...bytes]),
    "CRLF line ends": utf8(pretty.replaceAll("\n", "\r\n") + "\r\n"),
    "a trailing CRLF": utf8(text + "\r\n"),
  };
  test("each is not-canonical, though it parses to the same value", () => {
    for (const [what, b] of Object.entries(cases)) {
      expect({ what, code: codeOf(() => readSigned(b)) }).toEqual({ what, code: "not-canonical" });
    }
  });
});

describe("size", () => {
  test("8 MiB + 1 byte is too-large; 8 MiB of padding fails on the bytes, not the size", () => {
    const bytes = bundleBytes(vectorBundle());
    const big = new Uint8Array(BUNDLE_READ_MAX + 1).fill(0x20);
    big.set(bytes);
    expect(codeOf(() => readSigned(big))).toBe("too-large");
    expect(codeOf(() => readSigned(big.subarray(0, BUNDLE_READ_MAX)))).toBe("not-canonical");
  });

  test("the expert persona bundle fits the budget", () => {
    const { bytes } = personaBundle("expert");
    expect(bytes.length).toBeLessThanOrEqual(BUNDLE_BUDGET);
    expect(bytes.length).toBeGreaterThan(10_000); // large enough that the 500-position sweep covers a real payload
  });
});
