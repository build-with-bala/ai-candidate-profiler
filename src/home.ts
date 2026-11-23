// The recruiter's private folder: $AIPROF_HOME, or <home>/.ai-profiler. It holds company.json, invites.jsonl and roles/.
// On POSIX the folder is 0700 and every file in it 0600; Windows has no such modes.
import { closeSync, chmodSync, fchmodSync, mkdirSync, openSync, writeSync } from "node:fs";
import { posix, win32 } from "node:path";

export interface Sys { home: string; vars: Readonly<Record<string, string | undefined>>; platform: "darwin" | "linux" | "win32" }
export interface ProfilerHome { dir: string; company: string; invites: string; roles: string }

const POSIX = process.platform !== "win32";

export function profilerHome(s: Sys): ProfilerHome {
  const { join } = s.platform === "win32" ? win32 : posix;
  const set = s.vars.AIPROF_HOME;
  const dir = set !== undefined && set !== "" ? set : join(s.home, ".ai-profiler");
  return { dir, company: join(dir, "company.json"), invites: join(dir, "invites.jsonl"), roles: join(dir, "roles") };
}

/** mkdir -p, then 0700 on POSIX (mkdir's own mode is narrowed by the umask and never applies to a folder that exists). */
export function ensurePrivateDir(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (POSIX) chmodSync(dir, 0o700);
}

/** Writes the whole file at 0600, tightening an existing file before any byte is written. Never creates folders. */
export function writePrivate(path: string, data: string | Uint8Array): void {
  const fd = openSync(path, "w", 0o600);
  try {
    if (POSIX) fchmodSync(fd, 0o600);
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    let off = 0;
    while (off < bytes.length) off += writeSync(fd, bytes, off, bytes.length - off);
  } finally {
    closeSync(fd);
  }
}
