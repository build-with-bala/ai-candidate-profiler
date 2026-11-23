// The recruiter's invite log, $AIPROF_HOME/invites.jsonl: one JSON line per minted invite, 0600, so a dossier can
// show the name the recruiter gave an invite. It is append-only, so it never rewrites the entries already there.
import { Buffer } from "node:buffer";
import { closeSync, constants, existsSync, fchmodSync, fstatSync, openSync, readFileSync, readSync, writeSync } from "node:fs";
import type { ProfilerHome } from "../home";
import { isInviteField, type InviteField } from "./invite";

export interface InviteLogEntry { id: string; name: string | null; role: string; roleHash: string; iat: number; exp: number; sealed: boolean; fields: InviteField[] }

/**
 * Appends one line, creating the file at 0600 (never its folder). On POSIX a symlink at the path is refused
 * (O_NOFOLLOW). When an earlier write was torn, the new line starts on a fresh line, so only the torn one is lost.
 */
export function appendInviteLog(h: ProfilerHome, e: InviteLogEntry): void {
  const posix = h.platform !== "win32";
  const flags = posix ? constants.O_RDWR | constants.O_APPEND | constants.O_CREAT | (constants.O_NOFOLLOW ?? 0) : "a+";
  const fd = openSync(h.invites, flags, 0o600);
  try {
    if (posix) fchmodSync(fd, 0o600);
    const size = fstatSync(fd).size;
    let lead = "";
    if (size > 0) {
      const last = Buffer.alloc(1);
      readSync(fd, last, 0, 1, size - 1);
      if (last[0] !== 0x0a) lead = "\n";
    }
    const { id, name, role, roleHash, iat, exp, sealed, fields } = e;
    const bytes = new TextEncoder().encode(lead + JSON.stringify({ id, name, role, roleHash, iat, exp, sealed, fields }) + "\n");
    let off = 0;
    while (off < bytes.length) off += writeSync(fd, bytes, off, bytes.length - off);
  } finally {
    closeSync(fd);
  }
}

/** The entries by invite id; a later line for the same id wins. Malformed lines are skipped. */
export function readInviteLog(h: ProfilerHome): Map<string, InviteLogEntry> {
  const out = new Map<string, InviteLogEntry>();
  if (!existsSync(h.invites)) return out;
  for (const line of readFileSync(h.invites, "utf8").split("\n")) {
    if (line.trim() === "") continue;
    let v: unknown;
    try {
      v = JSON.parse(line);
    } catch {
      continue;
    }
    const entry = toEntry(v);
    if (entry) out.set(entry.id, entry);
  }
  return out;
}

const isWhole = (n: unknown): n is number => Number.isSafeInteger(n);

/** A fresh entry built from a valid line's own fields, or null. */
function toEntry(v: unknown): InviteLogEntry | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const { id, name, role, roleHash, iat, exp, sealed, fields } = o;
  if (typeof id !== "string" || !/^[0-9a-f]{24}$/.test(id)) return null;
  if (name !== null && typeof name !== "string") return null;
  if (typeof role !== "string" || typeof roleHash !== "string" || typeof sealed !== "boolean") return null;
  if (!isWhole(iat) || !isWhole(exp)) return null;
  if (!Array.isArray(fields) || !fields.every(isInviteField)) return null;
  return { id, name, role, roleHash, iat, exp, sealed, fields: [...fields] };
}
