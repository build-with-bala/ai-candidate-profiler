// F4: the invite token. A company signs claims naming the role, its profile hash, the requested fields, an expiry,
// a nonce and the key a bundle is sealed to: aiprof-inv1.<b64u(JCS claims)>.<b64u(Ed25519 signature)>.
import { Buffer } from "node:buffer";
import { b64u, unb64u, utf8 } from "./bytes";
import { isCompanyName, type Company } from "./company";
import { TrustError } from "./errors";
import { jcsBytes, parseCanonical } from "./jcs";
import { defaultRand, edSign, edVerify, fingerprint, type Rand } from "./keys";

export const INVITE_PREFIX = "aiprof-inv1";
export const OPTIONAL_FIELDS = ["config", "exhibits", "exposure", "fingerprints", "identity", "personas", "projects", "risk", "signals", "stack"] as const;
export type InviteField = (typeof OPTIONAL_FIELDS)[number];
export const CLOCK_SKEW_S = 300;
export const MAX_INVITE_S = 90 * 86400;
export const DEFAULT_INVITE_S = 14 * 86400;

export interface InviteClaims {
  v: 1;
  id: string;
  company: { name: string; pub: string };
  role: string;
  roleHash: string;
  nonce: string;
  iat: number;
  exp: number;
  fields: InviteField[];
  sealTo: string | null;
}
export interface Invite { token: string; claims: InviteClaims; companyPub: Uint8Array; companyFp: string; nonce: Uint8Array; sealTo: Uint8Array | null; displayId: string }

const MAX_TOKEN = 4096;
const MIN_INVITE_S = 3600;
const ROLE = /^[a-z0-9][a-z0-9-]{1,31}$/;
const HEX24 = /^[0-9a-f]{24}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const CLAIM_KEYS = ["company", "exp", "fields", "iat", "id", "nonce", "role", "roleHash", "sealTo", "v"];
const COMPANY_KEYS = ["name", "pub"];
const FIELD_SET: ReadonlySet<string> = new Set(OPTIONAL_FIELDS);

export function isInviteField(f: unknown): f is InviteField {
  return typeof f === "string" && FIELD_SET.has(f);
}

/** Draws the id (12 bytes) first and the nonce (16 bytes) second. `now` is epoch ms; iat is its whole second. */
export function mintInvite(
  c: Company,
  o: { role: string; roleHash: string; now: number; expiresS: number; fields?: readonly InviteField[]; seal: boolean; rand?: Rand },
): Invite {
  if (!ROLE.test(o.role)) throw new Error("the role id must match ^[a-z0-9][a-z0-9-]{1,31}$");
  if (!HEX64.test(o.roleHash)) throw new Error("the role hash must be 64 lower-case hex characters");
  if (!Number.isSafeInteger(o.expiresS) || o.expiresS <= 0 || o.expiresS > MAX_INVITE_S) throw new Error("an invite lasts from 1 second to 90 days");
  const fields = o.fields ?? OPTIONAL_FIELDS;
  if (!fields.every(isInviteField)) throw new Error(`requested fields must be among: ${OPTIONAL_FIELDS.join(", ")}`);
  const rand = o.rand ?? defaultRand;
  const id = Buffer.from(rand(12)).toString("hex");
  const nonce = rand(16);
  const iat = Math.floor(o.now / 1000);
  const claims: InviteClaims = {
    v: 1,
    id,
    company: { name: c.name, pub: b64u(c.ed.pub) },
    role: o.role,
    roleHash: o.roleHash,
    nonce: b64u(nonce),
    iat,
    exp: iat + o.expiresS,
    fields: [...new Set(fields)].sort(),
    sealTo: o.seal ? b64u(c.x.pub) : null,
  };
  const signed = `${INVITE_PREFIX}.${b64u(jcsBytes(claims))}`;
  return parseInvite(`${signed}.${b64u(edSign(c.ed.seed, utf8(signed)))}`);
}

const bad = (reason: string): TrustError => new TrustError("bad-invite", `not a valid invite: ${reason}`);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const hasKeys = (o: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(o).sort();
  return own.length === keys.length && own.every((k, i) => k === keys[i]);
};

function decode(s: string, what: string, bytes?: number): Uint8Array {
  try {
    return unb64u(s, { bytes });
  } catch {
    throw bad(`${what} is not ${bytes === undefined ? "" : `a ${bytes}-byte `}base64url value`);
  }
}

/** F4 parsing. Every failure is TrustError("bad-invite") with the reason; the message never repeats the token. */
export function parseInvite(token: string): Invite {
  if (typeof token !== "string") throw bad("not a string");
  if (token.length > MAX_TOKEN) throw bad(`longer than ${MAX_TOKEN} characters`);
  const parts = token.split(".");
  if (parts.length !== 3) throw bad("it needs exactly three parts separated by dots");
  const [prefix, seg, sigText] = parts as [string, string, string];
  if (prefix !== INVITE_PREFIX) throw bad(`the prefix is not ${INVITE_PREFIX}`);
  const segBytes = decode(seg, "the claims part");
  const sig = decode(sigText, "the signature", 64);
  let value: unknown;
  try {
    value = parseCanonical(segBytes, { maxBytes: MAX_TOKEN });
  } catch {
    throw bad("the claims are not canonical JSON");
  }
  const { claims, companyPub, nonce, sealTo } = checkClaims(value);
  if (!edVerify(companyPub, utf8(`${prefix}.${seg}`), sig)) throw bad("the signature does not verify under the company key");
  return { token, claims, companyPub, companyFp: fingerprint(companyPub), nonce, sealTo, displayId: claims.id.slice(0, 4).toUpperCase() };
}

function checkClaims(v: unknown): { claims: InviteClaims; companyPub: Uint8Array; nonce: Uint8Array; sealTo: Uint8Array | null } {
  if (!isObject(v) || !hasKeys(v, CLAIM_KEYS)) throw bad(`the claims must have exactly the keys ${CLAIM_KEYS.join(", ")}`);
  if (v.v !== 1) throw bad("v must be 1");
  if (typeof v.id !== "string" || !HEX24.test(v.id)) throw bad("id must be 24 lower-case hex characters");
  const company = v.company;
  if (!isObject(company) || !hasKeys(company, COMPANY_KEYS)) throw bad("company must have exactly the keys name, pub");
  if (!isCompanyName(company.name)) throw bad("the company name must be 1–80 characters, with no control characters");
  if (typeof company.pub !== "string") throw bad("company.pub must be a string");
  const companyPub = decode(company.pub, "company.pub", 32);
  if (typeof v.role !== "string" || !ROLE.test(v.role)) throw bad("role must match ^[a-z0-9][a-z0-9-]{1,31}$");
  if (typeof v.roleHash !== "string" || !HEX64.test(v.roleHash)) throw bad("roleHash must be 64 lower-case hex characters");
  if (typeof v.nonce !== "string") throw bad("nonce must be a string");
  const nonce = decode(v.nonce, "nonce", 16);
  const { iat, exp } = v;
  if (!Number.isSafeInteger(iat) || !Number.isSafeInteger(exp) || (iat as number) < 0) throw bad("iat and exp must be whole epoch seconds");
  const span = (exp as number) - (iat as number);
  if (span <= 0 || span > MAX_INVITE_S) throw bad("exp must be after iat by at most 90 days");
  const fields = v.fields;
  if (!Array.isArray(fields) || !fields.every(isInviteField)) throw bad(`fields must be among: ${OPTIONAL_FIELDS.join(", ")}`);
  for (let i = 1; i < fields.length; i++) if (!(fields[i - 1]! < fields[i]!)) throw bad("fields must be sorted and unique");
  let sealTo: Uint8Array | null = null;
  if (v.sealTo !== null) {
    if (typeof v.sealTo !== "string") throw bad("sealTo must be a key or null");
    sealTo = decode(v.sealTo, "sealTo", 32);
  }
  const claims: InviteClaims = {
    v: 1,
    id: v.id,
    company: { name: company.name, pub: company.pub },
    role: v.role,
    roleHash: v.roleHash,
    nonce: v.nonce,
    iat: iat as number,
    exp: exp as number,
    fields: [...fields],
    sealTo: v.sealTo as string | null,
  };
  return { claims, companyPub, nonce, sealTo };
}

/** F4 validity at `nowMs`: expired after exp, not yet valid before iat − 300 s, valid in between (both ends included). */
export function inviteStatus(i: Invite, nowMs: number): "valid" | "expired" | "not-yet-valid" {
  if (nowMs > i.claims.exp * 1000) return "expired";
  if (nowMs < (i.claims.iat - CLOCK_SKEW_S) * 1000) return "not-yet-valid";
  return "valid";
}

/** "14d" or "36h" → seconds, from 1 hour to 90 days. */
export function parseExpires(s: string): number {
  const m = typeof s === "string" ? s.match(/^([1-9][0-9]{0,5})([dh])$/) : null;
  const n = m ? Number(m[1]) * (m[2] === "d" ? 86400 : 3600) : NaN;
  if (!(n >= MIN_INVITE_S && n <= MAX_INVITE_S)) throw new Error("--expires takes a whole number of days or hours, such as 14d or 36h, from 1h to 90d");
  return n;
}

/** A comma list of optional fields → sorted and unique. Spaces around a name and empty items are ignored. */
export function parseFields(s: string): InviteField[] {
  const out = new Set<InviteField>();
  for (const item of s.split(",")) {
    const f = item.trim();
    if (f === "") continue;
    if (!isInviteField(f)) throw new Error(`unknown field; the fields are: ${OPTIONAL_FIELDS.join(", ")}`);
    out.add(f);
  }
  return [...out].sort();
}
