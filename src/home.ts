// The recruiter's private folder: $AIPROF_HOME, or <home>/.ai-profiler. It holds company.json, invites.jsonl and roles/.
// On POSIX the folders this app creates are 0700 and every file it writes 0600; Windows has no such modes. The platform
// always comes from Sys, never from process.platform, so tests can run either branch.
import { chmodSync, closeSync, fchmodSync, fsyncSync, mkdirSync, openSync, renameSync, statSync, unlinkSync, writeSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { basename, dirname, join, posix, resolve, win32 } from "node:path";

export interface Sys { home: string; vars: Readonly<Record<string, string | undefined>>; platform: "darwin" | "linux" | "win32" }
export interface ProfilerHome { dir: string; company: string; invites: string; roles: string; platform: Sys["platform"] }

export function profilerHome(s: Sys): ProfilerHome {
  const { join } = s.platform === "win32" ? win32 : posix;
  const set = s.vars.AIPROF_HOME;
  const dir = set !== undefined && set !== "" ? set : join(s.home, ".ai-profiler");
  return { dir, company: join(dir, "company.json"), invites: join(dir, "invites.jsonl"), roles: join(dir, "roles"), platform: s.platform };
}

/**
 * mkdir -p. On POSIX, each folder it creates becomes 0700 (mkdir's own mode is narrowed by the umask). A folder that
 * already exists is never re-moded, so AIPROF_HOME=$HOME never chmods the home folder; instead the result holds a
 * warning when other users can enter it.
 */
export function ensurePrivateDir(dir: string, platform: Sys["platform"]): string[] {
  const first = mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (platform === "win32") return [];
  if (first === undefined) {
    return (statSync(dir).mode & 0o077) !== 0 ? [`${dir} can be read by other users; run chmod 700 ${dir}`] : [];
  }
  // mkdir created `first` and every folder below it on the way to `dir`.
  const top = resolve(first);
  for (let d = resolve(dir); ; d = dirname(d)) {
    chmodSync(d, 0o700);
    if (d === top || dirname(d) === d) break;
  }
  return [];
}

/** How many temp names writePrivate tries before it gives up with EEXIST. */
const TEMP_ATTEMPTS = 8;

/** `.<name>.<pid>.<ms>.<12 random hex>.tmp` in the target's folder: a stale temp file from a crashed run never collides. */
function defaultTempName(path: string): string {
  return join(dirname(path), `.${basename(path)}.${process.pid}.${Date.now()}.${randomBytes(6).toString("hex")}.tmp`);
}

/**
 * Writes the whole file at 0600 and never creates folders.
 * - By default the bytes go to a temp file in the same folder, which is renamed over `path`. A failed write never
 *   touches the old file, and a symlink at `path` is replaced, never written through. A temp name that is taken is
 *   retried with a fresh one.
 * - `exclusive` creates `path` itself and fails with EEXIST when anything, even a dangling symlink, is there. A failed
 *   write removes the partial file.
 */
export function writePrivate(path: string, data: string | Uint8Array, o: { platform: Sys["platform"]; exclusive?: boolean }): void {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  if (o.exclusive) writeNew(path, bytes, o.platform);
  else replaceAtomically(path, bytes, o.platform, () => defaultTempName(path));
}

/**
 * @internal Tests only: writePrivate's atomic replace with `tempName` in place of the random name generator, so a
 * test can make a name collide. Production code calls writePrivate, which takes no name.
 */
export function writePrivateWithTempNames(path: string, data: string | Uint8Array, o: { platform: Sys["platform"] }, tempName: (attempt: number) => string): void {
  replaceAtomically(path, typeof data === "string" ? new TextEncoder().encode(data) : data, o.platform, tempName);
}

function replaceAtomically(path: string, bytes: Uint8Array, platform: Sys["platform"], name: (attempt: number) => string): void {
  for (let attempt = 0; ; attempt++) {
    const temp = name(attempt);
    try {
      writeNew(temp, bytes, platform);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST" && attempt + 1 < TEMP_ATTEMPTS) continue;
      throw e;
    }
    try {
      renameSync(temp, path);
    } catch (e) {
      unlinkQuietly(temp);
      throw e;
    }
    return;
  }
}

/**
 * Creates `path` ("wx", 0600), writes every byte, syncs and closes it. On any failure, a failed close included, the
 * new file is removed, and the first error is the one thrown.
 */
function writeNew(path: string, bytes: Uint8Array, platform: Sys["platform"]): void {
  const fd = openSync(path, "wx", 0o600);
  let written = false;
  try {
    if (platform !== "win32") fchmodSync(fd, 0o600); // exactly 0600, whatever the umask
    let off = 0;
    while (off < bytes.length) off += writeSync(fd, bytes, off, bytes.length - off);
    fsyncSync(fd);
    written = true;
  } finally {
    let closeError: unknown = null;
    try {
      closeSync(fd);
    } catch (e) {
      closeError = e;
    }
    if (!written || closeError !== null) unlinkQuietly(path);
    // A write error is already propagating; only a close error after a good write needs throwing here.
    if (written && closeError !== null) throw closeError;
  }
}

function unlinkQuietly(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // already gone
  }
}
