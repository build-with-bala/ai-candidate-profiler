// The company keystore (company.json) and the private home folder it lives in.
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as fs from "node:fs";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensurePrivateDir, profilerHome, writePrivate, type ProfilerHome } from "../../src/home";
import { b64u, unb64u } from "../../src/trust/bytes";
import { initCompany, loadCompany, type CompanyFile } from "../../src/trust/company";
import { edFromSeed, fingerprint, xFromPriv, type Rand } from "../../src/trust/keys";
import { testSys, VEC } from "../kit/keys";

const POSIX = process.platform !== "win32";
const PLATFORM = testSys("").platform;
/** chmod does not bind root, so tests that make a folder read-only skip under it. */
const ROOT_USER = process.getuid?.() === 0;
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
      platform: sys.platform,
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

describe("ensurePrivateDir", () => {
  test.skipIf(!POSIX)("makes every folder it creates 0700 and returns no warning", () => {
    const dir = join(root, "a", "b");
    expect(ensurePrivateDir(dir, PLATFORM)).toEqual([]);
    expect(mode(join(root, "a"))).toBe(0o700);
    expect(mode(dir)).toBe(0o700);
  });

  test.skipIf(!POSIX)("never re-modes a folder that exists, and warns when others can enter it", () => {
    // AIPROF_HOME=$HOME must never chmod the home folder.
    const dir = join(root, "there");
    mkdirSync(dir);
    chmodSync(dir, 0o755);
    expect(ensurePrivateDir(dir, PLATFORM)).toEqual([`${dir} can be read by other users; run chmod 700 ${dir}`]);
    expect(mode(dir)).toBe(0o755);
    chmodSync(dir, 0o710);
    expect(ensurePrivateDir(dir, PLATFORM)).toHaveLength(1);
    expect(mode(dir)).toBe(0o710);
  });

  test.skipIf(!POSIX)("leaves an existing parent alone when it creates a child", () => {
    const parent = join(root, "parent");
    mkdirSync(parent);
    chmodSync(parent, 0o755);
    expect(ensurePrivateDir(join(parent, "child"), PLATFORM)).toEqual([]);
    expect(mode(parent)).toBe(0o755);
    expect(mode(join(parent, "child"))).toBe(0o700);
  });

  test("accepts an existing 0700 folder without a warning", () => {
    const dir = join(root, "there");
    mkdirSync(dir, { mode: 0o700 });
    if (POSIX) chmodSync(dir, 0o700);
    expect(ensurePrivateDir(dir, PLATFORM)).toEqual([]);
  });

  test("takes the platform from Sys: on win32 it neither chmods nor warns", () => {
    const dir = join(root, "loose");
    mkdirSync(dir);
    if (POSIX) chmodSync(dir, 0o755);
    expect(ensurePrivateDir(dir, "win32")).toEqual([]);
    if (POSIX) expect(mode(dir)).toBe(0o755);
  });
});

describe("writePrivate", () => {
  test.skipIf(!POSIX)("writes 0600 files, replacing an existing loose file with a 0600 one", () => {
    const file = join(root, "f");
    writeFileSync(file, "old");
    chmodSync(file, 0o644);
    writePrivate(file, "new", { platform: PLATFORM });
    expect(mode(file)).toBe(0o600);
    expect(readFileSync(file, "utf8")).toBe("new");
    writePrivate(join(root, "g"), Uint8Array.of(1, 2), { platform: PLATFORM });
    expect(mode(join(root, "g"))).toBe(0o600);
    expect(readFileSync(join(root, "g"))).toEqual(Buffer.from([1, 2]));
  });

  test("replaces atomically through a temp file in the same folder, leaving no temp file behind", () => {
    const file = join(root, "f");
    writePrivate(file, "one", { platform: PLATFORM });
    writePrivate(file, "two", { platform: PLATFORM });
    expect(readFileSync(file, "utf8")).toBe("two");
    expect(readdirSync(root)).toEqual(["f"]);
  });

  test.skipIf(!POSIX || ROOT_USER)("a failed write keeps the old file whole", () => {
    const dir = join(root, "locked");
    mkdirSync(dir);
    const file = join(dir, "f");
    writePrivate(file, "keep", { platform: PLATFORM });
    chmodSync(dir, 0o500); // the temp file cannot be created
    try {
      expect(() => writePrivate(file, "lost", { platform: PLATFORM })).toThrow();
    } finally {
      chmodSync(dir, 0o700);
    }
    expect(readFileSync(file, "utf8")).toBe("keep");
    expect(readdirSync(dir)).toEqual(["f"]);
  });

  test.skipIf(!POSIX)("replaces a symlink itself and never writes through it", () => {
    const target = join(root, "target");
    const link = join(root, "link");
    symlinkSync(target, link); // dangling
    writePrivate(link, "x", { platform: PLATFORM });
    expect(lstatSync(link).isFile()).toBe(true);
    expect(existsSync(target)).toBe(false);
  });

  test("exclusive refuses an existing file and leaves it unchanged", () => {
    const file = join(root, "f");
    writePrivate(file, "first", { platform: PLATFORM, exclusive: true });
    expect(() => writePrivate(file, "second", { platform: PLATFORM, exclusive: true })).toThrow(expect.objectContaining({ code: "EEXIST" }));
    expect(readFileSync(file, "utf8")).toBe("first");
  });

  test("a taken temp name is retried with a fresh one, and the taken file is left alone", () => {
    const file = join(root, "f");
    const names = [join(root, ".f.taken.tmp"), join(root, ".f.taken.tmp"), join(root, ".f.free.tmp")];
    writeFileSync(names[0]!, "stale");
    const asked: number[] = [];
    writePrivate(file, "new", { platform: PLATFORM, tempName: (attempt) => (asked.push(attempt), names[attempt]!) });
    expect(asked).toEqual([0, 1, 2]);
    expect(readFileSync(file, "utf8")).toBe("new");
    expect(readFileSync(names[0]!, "utf8")).toBe("stale");
    expect(readdirSync(root).sort()).toEqual([".f.taken.tmp", "f"]);
  });

  test("gives up with EEXIST when every temp name is taken, and never touches the target", () => {
    const file = join(root, "f");
    writeFileSync(file, "keep");
    writeFileSync(join(root, ".f.taken.tmp"), "stale");
    expect(() => writePrivate(file, "lost", { platform: PLATFORM, tempName: () => join(root, ".f.taken.tmp") }))
      .toThrow(expect.objectContaining({ code: "EEXIST" }));
    expect(readFileSync(file, "utf8")).toBe("keep");
  });

  test("the default temp name is unpredictable: a file at the old <pid>.<count> name never collides", () => {
    const file = join(root, "f");
    for (let n = 1; n <= 500; n++) writeFileSync(join(root, `.f.${process.pid}.${n}.tmp`), "stale");
    for (let n = 0; n < 4; n++) writePrivate(file, String(n), { platform: PLATFORM });
    expect(readFileSync(file, "utf8")).toBe("3");
    expect(readdirSync(root).filter((f) => !f.startsWith(`.f.${process.pid}.`))).toEqual(["f"]);
  });

  test("a failed close after a good write is thrown, the temp file is removed and the target is untouched", () => {
    const file = join(root, "f");
    writeFileSync(file, "keep");
    const realClose = fs.closeSync;
    const close = spyOn(fs, "closeSync").mockImplementation((fd) => {
      realClose(fd);
      throw Object.assign(new Error("close failed"), { code: "EIO" });
    });
    try {
      expect(() => writePrivate(file, "lost", { platform: PLATFORM })).toThrow("close failed");
      expect(() => writePrivate(join(root, "g"), "lost", { platform: PLATFORM, exclusive: true })).toThrow("close failed");
    } finally {
      close.mockRestore();
    }
    expect(readFileSync(file, "utf8")).toBe("keep");
    expect(readdirSync(root)).toEqual(["f"]);
  });

  test("when both the write and the close fail, the write's error is the one thrown and the temp file is removed", () => {
    const file = join(root, "f");
    const realClose = fs.closeSync;
    const write = spyOn(fs, "writeSync").mockImplementation(() => {
      throw Object.assign(new Error("disk full"), { code: "ENOSPC" });
    });
    const close = spyOn(fs, "closeSync").mockImplementation((fd) => {
      realClose(fd);
      throw Object.assign(new Error("close failed"), { code: "EIO" });
    });
    try {
      expect(() => writePrivate(file, "lost", { platform: PLATFORM })).toThrow("disk full");
    } finally {
      write.mockRestore();
      close.mockRestore();
    }
    expect(readdirSync(root)).toEqual([]);
  });

  test("never creates folders", () => {
    expect(() => writePrivate(join(root, "missing", "f"), "x", { platform: PLATFORM })).toThrow();
    expect(() => writePrivate(join(root, "missing", "f"), "x", { platform: PLATFORM, exclusive: true })).toThrow();
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
    expect(readdirSync(home.dir)).toEqual(["company.json"]);
  });

  test("force removes stale company.json temp files, which hold key copies, and still replaces the keys", () => {
    initCompany(home, { name: "Example Co", now: NOW });
    for (const s of [".company.json.123.1.tmp", ".company.json.99.4.tmp", `.company.json.${process.pid}.1.tmp`]) {
      writeFileSync(join(home.dir, s), "an old key copy");
    }
    writeFileSync(join(home.dir, "notes.txt"), "mine");
    writeFileSync(join(home.dir, ".company.json.bak"), "mine too");
    const c = initCompany(home, { name: "Other Co", now: NOW, force: true });
    expect(loadCompany(home, testSys(root))?.company).toEqual(c);
    expect(readdirSync(home.dir).sort()).toEqual([".company.json.bak", "company.json", "notes.txt"]);
  });

  test("without force, a stale temp file changes nothing: an existing keystore is still exists", () => {
    initCompany(home, { name: "Example Co", now: NOW });
    const before = readFileSync(home.company, "utf8");
    writeFileSync(join(home.dir, ".company.json.123.1.tmp"), "an old key copy");
    expect(() => initCompany(home, { name: "Other Co", now: NOW })).toThrow(/^exists$/);
    expect(readFileSync(home.company, "utf8")).toBe(before);
    expect(existsSync(join(home.dir, ".company.json.123.1.tmp"))).toBe(true);
  });

  test.skipIf(!POSIX)("never writes through a dangling symlink at company.json", () => {
    ensurePrivateDir(home.dir, PLATFORM);
    const target = join(root, "elsewhere.json");
    symlinkSync(target, home.company);
    expect(() => initCompany(home, { name: "Example Co", now: NOW })).toThrow(/^exists$/);
    expect(existsSync(target)).toBe(false);
    initCompany(home, { name: "Example Co", now: NOW, force: true });
    expect(lstatSync(home.company).isFile()).toBe(true);
    expect(existsSync(target)).toBe(false);
  });

  test.skipIf(!POSIX || ROOT_USER)("a failed forced write keeps the existing keys", () => {
    const c = initCompany(home, { name: "Example Co", now: NOW });
    const before = readFileSync(home.company, "utf8");
    chmodSync(home.dir, 0o500);
    try {
      expect(() => initCompany(home, { name: "Other Co", now: NOW, force: true })).toThrow();
    } finally {
      chmodSync(home.dir, 0o700);
    }
    expect(readFileSync(home.company, "utf8")).toBe(before);
    expect(loadCompany(home, testSys(root))?.company).toEqual(c);
  });

  test.skipIf(!POSIX)("warns, and does not chmod, when the existing home folder is loose", () => {
    mkdirSync(home.dir);
    chmodSync(home.dir, 0o755);
    const warnings: string[] = [];
    initCompany(home, { name: "Example Co", now: NOW, warn: (w) => warnings.push(w) });
    expect(warnings).toEqual([`${home.dir} can be read by other users; run chmod 700 ${home.dir}`]);
    expect(mode(home.dir)).toBe(0o755);
    expect(mode(home.company)).toBe(0o600);
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
    writePrivate(home.company, JSON.stringify(f), { platform: PLATFORM });
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
    writePrivate(home.company, "{not json", { platform: PLATFORM });
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
