// The company keystore, company.json: an Ed25519 key that signs invites and an X25519 key that bundles are sealed to.
// Keys are strict b64u (F1) and each kid is fingerprint(pub) (F3). The file is 0600 in a 0700 folder on POSIX.
import { existsSync, lstatSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { ensurePrivateDir, writePrivate, type ProfilerHome, type Sys } from "../home";
import { b64u, equalBytes, unb64u } from "./bytes";
import { defaultRand, edFromSeed, fingerprint, newEdKey, newXKey, xFromPriv, type EdKey, type Rand, type XKey } from "./keys";

export interface CompanyFile { v: 1; name: string; createdAt: string; ed25519: { kid: string; pub: string; seed: string }; x25519: { kid: string; pub: string; priv: string } }
export interface Company { name: string; ed: EdKey & { kid: string }; x: XKey & { kid: string } }

const MAX_NAME = 80;
const CONTROL = /\p{Cc}/u;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/** A company name: 1–80 characters (code points), none of them a control character. */
export function isCompanyName(name: unknown): name is string {
  if (typeof name !== "string") return false;
  const n = [...name].length;
  return n >= 1 && n <= MAX_NAME && !CONTROL.test(name);
}

/**
 * Writes a new keystore. Without `force`, an existing company.json (or a symlink there, even a dangling one) is
 * Error("exists") and is never touched. With `force`, the new file replaces the old one atomically, so a failed
 * write keeps the old keys, and stale `.company.json.*.tmp` files from a crashed write are removed first.
 * `warn` receives the folder's loose-permission warning, if any.
 */
export function initCompany(h: ProfilerHome, o: { name: string; now: number; force?: boolean; rand?: Rand; warn?: (w: string) => void }): Company {
  if (!isCompanyName(o.name)) throw new Error(`the company name must be 1–${MAX_NAME} characters, with no control characters`);
  if (!o.force && lexists(h.company)) throw new Error("exists");
  const rand = o.rand ?? defaultRand;
  const ed = newEdKey(rand);
  const x = newXKey(rand);
  const company: Company = { name: o.name, ed: { ...ed, kid: fingerprint(ed.pub) }, x: { ...x, kid: fingerprint(x.pub) } };
  const file: CompanyFile = {
    v: 1,
    name: o.name,
    createdAt: new Date(o.now).toISOString(),
    ed25519: { kid: company.ed.kid, pub: b64u(ed.pub), seed: b64u(ed.seed) },
    x25519: { kid: company.x.kid, pub: b64u(x.pub), priv: b64u(x.priv) },
  };
  for (const w of ensurePrivateDir(h.dir, h.platform)) o.warn?.(w);
  if (o.force) removeStaleTemps(h);
  try {
    writePrivate(h.company, JSON.stringify(file, null, 2) + "\n", { platform: h.platform, exclusive: !o.force });
  } catch (e) {
    // Without force, EEXIST means company.json was created since the check above. With force, it can only be a temp
    // name, so it is passed on as it is.
    if (!o.force && (e as NodeJS.ErrnoException).code === "EEXIST") throw new Error("exists");
    throw e;
  }
  return company;
}

/**
 * Removes the `.company.json.*.tmp` files a crashed write left behind: each holds a copy of a private key. A folder
 * with such a name was not made by writePrivate, so it is skipped and never aborts the forced write.
 */
function removeStaleTemps(h: ProfilerHome): void {
  const prefix = `.${basename(h.company)}.`;
  for (const f of readdirSync(dirname(h.company), { withFileTypes: true })) {
    if (!f.isDirectory() && f.name.startsWith(prefix) && f.name.endsWith(".tmp")) rmSync(join(dirname(h.company), f.name), { force: true });
  }
}

/** True when anything is at `path`, a dangling symlink included. */
function lexists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

class Malformed extends Error {
  constructor(what: string) {
    super(`company.json is malformed: ${what}`);
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function key32(o: Record<string, unknown>, member: string, where: string): Uint8Array {
  const v = o[member];
  if (typeof v !== "string") throw new Malformed(`${where}.${member} is missing`);
  try {
    return unb64u(v, { bytes: 32 });
  } catch {
    throw new Malformed(`${where}.${member} is not a 32-byte base64url value`);
  }
}

function section(f: Record<string, unknown>, where: "ed25519" | "x25519", priv: "seed" | "priv"): { kid: unknown; pub: Uint8Array; priv: Uint8Array } {
  const s = f[where];
  if (!isObject(s)) throw new Malformed(`${where} is missing`);
  return { kid: s.kid, pub: key32(s, "pub", where), priv: key32(s, priv, where) };
}

/** Null when company.json is absent. Re-derives both public keys and kids; a mismatch is "company.json is inconsistent". */
export function loadCompany(h: ProfilerHome, s: Sys): { company: Company; warnings: string[] } | null {
  if (!existsSync(h.company)) return null;
  let f: unknown;
  try {
    f = JSON.parse(readFileSync(h.company, "utf8"));
  } catch {
    throw new Malformed("not JSON");
  }
  if (!isObject(f) || f.v !== 1) throw new Malformed("not a v1 keystore");
  if (!isCompanyName(f.name)) throw new Malformed("the name must be 1–80 characters, with no control characters");
  if (typeof f.createdAt !== "string" || !ISO.test(f.createdAt) || Number.isNaN(Date.parse(f.createdAt))) {
    throw new Malformed("createdAt is not an ISO time");
  }
  const e = section(f, "ed25519", "seed");
  const x = section(f, "x25519", "priv");
  const ed = edFromSeed(e.priv);
  const xk = xFromPriv(x.priv);
  if (!equalBytes(ed.pub, e.pub) || e.kid !== fingerprint(ed.pub) || !equalBytes(xk.pub, x.pub) || x.kid !== fingerprint(xk.pub)) {
    throw new Error("company.json is inconsistent");
  }
  const warnings: string[] = [];
  if (s.platform !== "win32" && (statSync(h.company).mode & 0o077) !== 0) {
    warnings.push(`company.json can be read by other users; run chmod 600 ${h.company}`);
  }
  return { company: { name: f.name, ed: { ...ed, kid: e.kid }, x: { ...xk, kid: x.kid } }, warnings };
}
