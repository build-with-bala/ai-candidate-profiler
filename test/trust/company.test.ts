// The company keystore (company.json) and the private home folder it lives in.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensurePrivateDir, profilerHome, writePrivate, type ProfilerHome } from "../../src/home";
import { b64u, unb64u } from "../../src/trust/bytes";
import { initCompany, loadCompany, type CompanyFile } from "../../src/trust/company";
import { edFromSeed, fingerprint, xFromPriv, type Rand } from "../../src/trust/keys";
import { testSys, VEC } from "../kit/keys";

const POSIX = process.platform !== "win32";
const NOW = Date.UTC(2026, 10, 18, 9, 30, 0);
const mode = (path: string): number => statSync(path).mode & 0o777;

let root: string;
let home: ProfilerHome;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "aiprof-company-"));
  home = profilerHome(testSys(root));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

/** A Rand that hands out these 32-byte values in order. */
function queue(...values: Uint8Array[]): Rand {
  return (n) => {
    const next = values.shift();
    if (!next || next.length !== n) throw new Error("the queue rand ran dry");
    return next;
  };
}

describe("profilerHome", () => {
  test("is $AIPROF_HOME when set, holding company.json, invites.jsonl and roles/", () => {
    const sys = testSys(root);
    expect(profilerHome(sys)).toEqual({
      dir: join(root, "aiprof"),
      company: join(root, "aiprof", "company.json"),
      invites: join(root, "aiprof", "invites.jsonl"),
      roles: join(root, "aiprof", "roles"),
    });
  });

  test("defaults to <home>/.ai-profiler when $AIPROF_HOME is unset or empty", () => {
    for (const vars of [{}, { AIPROF_HOME: "" }]) {
      const sys = { ...testSys(root), vars };
      expect(profilerHome(sys).dir).toBe(join(root, "home", ".ai-profiler"));
      expect(profilerHome(sys).company).toBe(join(root, "home", ".ai-profiler", "company.json"));
    }
  });
});

describe("ensurePrivateDir and writePrivate", () => {
  test.skipIf(!POSIX)("make a 0700 folder and 0600 files, tightening an existing loose file", () => {
    const dir = join(root, "a", "b");
    ensurePrivateDir(dir);
    expect(mode(dir)).toBe(0o700);
    const file = join(dir, "f");
    writeFileSync(file, "old");
    chmodSync(file, 0o644);
    writePrivate(file, "new");
    expect(mode(file)).toBe(0o600);
    expect(readFileSync(file, "utf8")).toBe("new");
    writePrivate(join(dir, "g"), Uint8Array.of(1, 2));
    expect(mode(join(dir, "g"))).toBe(0o600);
  });

  test("writePrivate never creates folders", () => {
    expect(() => writePrivate(join(root, "missing", "f"), "x")).toThrow();
    expect(existsSync(join(root, "missing"))).toBe(false);
  });
});

describe("initCompany", () => {
  test.skipIf(!POSIX)("writes company.json at 0600 in a 0700 folder", () => {
    initCompany(home, { name: "Example Co", now: NOW });
    expect(mode(home.dir)).toBe(0o700);
    expect(mode(home.company)).toBe(0o600);
  });

  test("writes the keys as b64u with kid = fingerprint(pub), drawing the Ed25519 seed first", () => {
    const c = initCompany(home, { name: "Example Co", now: NOW, rand: queue(VEC.t1.seed, VEC.bob.priv) });
    expect(c.ed).toEqual({ ...VEC.t1, kid: "21fe31dfa154a261" });
    expect(c.x).toEqual({ ...VEC.bob, kid: "f35e5616160a30bf" });
    const file = JSON.parse(readFileSync(home.company, "utf8")) as CompanyFile;
    expect(file).toEqual({
      v: 1,
      name: "Example Co",
      createdAt: "2026-11-18T09:30:00.000Z",
      ed25519: { kid: "21fe31dfa154a261", pub: b64u(VEC.t1.pub), seed: b64u(VEC.t1.seed) },
      x25519: { kid: "f35e5616160a30bf", pub: b64u(VEC.bob.pub), priv: b64u(VEC.bob.priv) },
    });
  });

  test("a second init throws exists and leaves the file unchanged; force replaces it", () => {
    initCompany(home, { name: "Example Co", now: NOW });
    const before = readFileSync(home.company, "utf8");
    expect(() => initCompany(home, { name: "Other Co", now: NOW })).toThrow(/^exists$/);
    expect(readFileSync(home.company, "utf8")).toBe(before);
    const replaced = initCompany(home, { name: "Other Co", now: NOW, force: true });
    const after = readFileSync(home.company, "utf8");
    expect(after).not.toBe(before);
    expect((JSON.parse(after) as CompanyFile).name).toBe("Other Co");
    expect(loadCompany(home, testSys(root))?.company).toEqual(replaced);
  });

  test("rejects a name of 0 or 81 characters, or one holding a control character", () => {
    for (const name of ["", "x".repeat(81), "Example\nCo", "Tab\tCo", "Del\u007fCo", "C1\u0085Co"]) {
      expect(() => initCompany(home, { name, now: NOW })).toThrow(/company name/);
    }
    expect(existsSync(home.company)).toBe(false);
    expect(initCompany(home, { name: "😀".repeat(80), now: NOW }).name).toBe("😀".repeat(80)); // 80 characters, not code units
  });
});

describe("loadCompany", () => {
  test("is null when company.json is absent", () => {
    expect(loadCompany(home, testSys(root))).toBeNull();
  });

  test("round-trips the keys, with no warning for a 0600 file", () => {
    const c = initCompany(home, { name: "Example Co", now: NOW });
    expect(loadCompany(home, testSys(root))).toEqual({ company: c, warnings: [] });
  });

  /** company.json with one field edited. */
  function edit(change: (f: CompanyFile) => void): void {
    initCompany(home, { name: "Example Co", now: NOW, rand: queue(VEC.t1.seed, VEC.bob.priv) });
    const f = JSON.parse(readFileSync(home.company, "utf8")) as CompanyFile;
    change(f);
    writePrivate(home.company, JSON.stringify(f));
  }

  test("an edited public key or kid is inconsistent", () => {
    const edits: Array<(f: CompanyFile) => void> = [
      (f) => { f.ed25519.pub = b64u(VEC.t2.pub); },
      (f) => { f.ed25519.pub = b64u(VEC.t2.pub); f.ed25519.kid = fingerprint(VEC.t2.pub); },
      (f) => { f.x25519.pub = b64u(VEC.alice.pub); },
      (f) => { f.x25519.kid = fingerprint(VEC.alice.pub); },
      (f) => { f.ed25519.seed = b64u(VEC.t2.seed); },
    ];
    for (const change of edits) {
      edit(change);
      expect(() => loadCompany(home, testSys(root))).toThrow("company.json is inconsistent");
      rmSync(home.company);
    }
  });

  test("a malformed file is an error, never a crash or a half-read company", () => {
    const edits: Array<(f: CompanyFile) => void> = [
      (f) => { (f as { v: number }).v = 2; },
      (f) => { f.name = "x".repeat(81); },
      (f) => { f.createdAt = "yesterday"; },
      (f) => { f.ed25519.seed = f.ed25519.seed + "A"; },
      (f) => { f.x25519.priv = f.x25519.priv.replace(/.$/, "B"); }, // non-zero unused bits
      (f) => { delete (f as Partial<CompanyFile>).x25519; },
    ];
    for (const change of edits) {
      edit(change);
      expect(() => loadCompany(home, testSys(root))).toThrow(/^company\.json is (?:malformed|inconsistent)/);
      rmSync(home.company);
    }
    writePrivate(home.company, "{not json");
    expect(() => loadCompany(home, testSys(root))).toThrow(/^company\.json is malformed/);
  });

  test.skipIf(!POSIX)("a file other users can read loads with a chmod warning (Review Focus 3)", () => {
    const c = initCompany(home, { name: "Example Co", now: NOW });
    chmodSync(home.company, 0o644);
    expect(loadCompany(home, testSys(root))).toEqual({
      company: c,
      warnings: [`company.json can be read by other users; run chmod 600 ${home.company}`],
    });
  });

  test("does not warn about modes on Windows, which has none", () => {
    initCompany(home, { name: "Example Co", now: NOW });
    if (POSIX) chmodSync(home.company, 0o644);
    expect(loadCompany(home, { ...testSys(root), platform: "win32" })?.warnings).toEqual([]);
  });

  test("the loaded keys match the stored private halves", () => {
    initCompany(home, { name: "Example Co", now: NOW });
    const f = JSON.parse(readFileSync(home.company, "utf8")) as CompanyFile;
    const loaded = loadCompany(home, testSys(root))!.company;
    expect(loaded.ed).toEqual({ ...edFromSeed(unb64u(f.ed25519.seed)), kid: f.ed25519.kid });
    expect(loaded.x).toEqual({ ...xFromPriv(unb64u(f.x25519.priv)), kid: f.x25519.kid });
  });
});

test("ensurePrivateDir accepts a folder that already exists", () => {
  mkdirSync(join(root, "there"));
  expect(() => ensurePrivateDir(join(root, "there"))).not.toThrow();
});
