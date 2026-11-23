// F4: invite tokens (format, expiry, requested fields) and the recruiter's local invite log.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { appendFileSync, existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensurePrivateDir, profilerHome, type ProfilerHome } from "../../src/home";
import { b64u, utf8 } from "../../src/trust/bytes";
import {
  CLOCK_SKEW_S, DEFAULT_INVITE_S, INVITE_PREFIX, MAX_INVITE_S, mintInvite, OPTIONAL_FIELDS, inviteStatus, parseExpires, parseFields,
  parseInvite, type Invite, type InviteClaims,
} from "../../src/trust/invite";
import { appendInviteLog, readInviteLog, type InviteLogEntry } from "../../src/trust/invite-log";
import { jcs } from "../../src/trust/jcs";
import { edSign, sha256Hex, type Rand } from "../../src/trust/keys";
import { codeOf, testCompany, testSys, VEC } from "../kit/keys";

const POSIX = process.platform !== "win32";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const hex = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "hex"));
const DAY = 86400;

/** F4's V6 claims, exactly as the plan pins their JCS. */
const V6_CLAIMS_JCS =
  '{"company":{"name":"Example Co","pub":"11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"},"exp":1796119200,"fields":["exhibits","fingerprints"],' +
  '"iat":1794909600,"id":"a1b2c3d4e5f60718293a4b5c","nonce":"AAECAwQFBgcICQoLDA0ODw","role":"backend",' +
  '"roleHash":"0000000000000000000000000000000000000000000000000000000000000000","sealTo":"3p7bfXt9wbTTW2HC7OQ1Nz-DQ8hbeGdNrfx-FG-IK08","v":1}';
const V6_SHA256 = "b4baae7ecda50ce5b41e4042b9eedda4f3466a120590735acffb140907d9b95e";
const V6_SIG = "0bPyJilGau62BrkSdXlPzXo12bybMDMA0PV3q3fSGqyCHoDOzegxPHO9DzlbOsVzdJB45mziA0sxkdxPWhD5AA";

/** A Rand that hands out these values in order, each of the length asked for. */
function queue(...values: Uint8Array[]): Rand {
  return (n) => {
    const next = values.shift();
    if (!next || next.length !== n) throw new Error("the queue rand ran dry");
    return next;
  };
}

function mintV6(): Invite {
  return mintInvite(testCompany("Example Co"), {
    role: "backend",
    roleHash: "0".repeat(64),
    now: Date.UTC(2026, 10, 17, 10, 0, 0),
    expiresS: 14 * DAY,
    fields: ["fingerprints", "exhibits"],
    seal: true,
    rand: queue(hex("a1b2c3d4e5f60718293a4b5c"), hex("000102030405060708090a0b0c0d0e0f")),
  });
}

/** A token over these claims, signed by VEC.t1 (the testCompany key), with the claims written as `text`. */
function signed(text: string): string {
  const seg = b64u(utf8(text));
  return `${INVITE_PREFIX}.${seg}.${b64u(edSign(VEC.t1.seed, utf8(`${INVITE_PREFIX}.${seg}`)))}`;
}

/** The message of what f throws, or "no throw". */
function messageOf(f: () => unknown): string {
  try {
    f();
  } catch (e) {
    return (e as Error).message;
  }
  return "no throw";
}

const v6Claims = (): Record<string, unknown> => JSON.parse(V6_CLAIMS_JCS) as Record<string, unknown>;
const withClaims = (change: (c: Record<string, unknown>) => void): string => {
  const c = v6Claims();
  change(c);
  return signed(jcs(c));
};

describe("constants", () => {
  test("match the plan", () => {
    expect(INVITE_PREFIX).toBe("aiprof-inv1");
    expect(OPTIONAL_FIELDS).toEqual(["config", "exhibits", "exposure", "fingerprints", "identity", "personas", "projects", "risk", "signals", "stack"]);
    expect([CLOCK_SKEW_S, MAX_INVITE_S, DEFAULT_INVITE_S]).toEqual([300, 90 * DAY, 14 * DAY]);
  });
});

describe("V6", () => {
  test("mintInvite reproduces the token: claims JCS, 602 chars, SHA-256 and signature", () => {
    const i = mintV6();
    const [prefix, seg, sig] = i.token.split(".");
    expect(prefix).toBe("aiprof-inv1");
    expect(Buffer.from(seg!, "base64url").toString("utf8")).toBe(V6_CLAIMS_JCS);
    expect(i.token).toHaveLength(602);
    expect(sha256Hex(i.token)).toBe(V6_SHA256);
    expect(sig).toBe(V6_SIG);
  });

  test("parseInvite gives the claims, keys, display id and company fingerprint", () => {
    const token = mintV6().token;
    const i = parseInvite(token);
    expect(i.token).toBe(token);
    expect(i.claims).toEqual(v6Claims() as unknown as InviteClaims);
    expect(i.displayId).toBe("A1B2");
    expect(i.companyFp).toBe("21fe31dfa154a261");
    expect(i.companyPub).toEqual(VEC.t1.pub);
    expect(i.nonce).toEqual(hex("000102030405060708090a0b0c0d0e0f"));
    expect(i.sealTo).toEqual(VEC.bob.pub);
  });

  test("an unsealed invite carries sealTo null, and fields default to every optional field", () => {
    const i = mintInvite(testCompany(), { role: "ai-engineer", roleHash: "f".repeat(64), now: 1_800_000_000_500, expiresS: DEFAULT_INVITE_S, seal: false });
    expect(i.claims.sealTo).toBeNull();
    expect(i.sealTo).toBeNull();
    expect(i.claims.fields).toEqual([...OPTIONAL_FIELDS]);
    expect(i.claims.iat).toBe(1_800_000_000);
    expect(i.claims.exp).toBe(1_800_000_000 + DEFAULT_INVITE_S);
    expect(i.claims.id).toMatch(/^[0-9a-f]{24}$/);
    expect(parseInvite(i.token)).toEqual(i);
  });

  test("mintInvite refuses a bad role, role hash, expiry or field", () => {
    const c = testCompany();
    const base = { role: "backend", roleHash: "0".repeat(64), now: Date.UTC(2026, 10, 17), expiresS: DAY, seal: false };
    for (const o of [
      { ...base, role: "Backend" },
      { ...base, role: "b" },
      { ...base, roleHash: "0".repeat(63) },
      { ...base, expiresS: 0 },
      { ...base, expiresS: MAX_INVITE_S + 1 },
      { ...base, expiresS: 1.5 },
      { ...base, fields: ["nope" as (typeof OPTIONAL_FIELDS)[number]] },
    ]) {
      expect(() => mintInvite(c, o)).toThrow();
    }
  });
});

describe("tamper (F4 parsing)", () => {
  test("every one-character substitution in V6 is bad-invite", () => {
    const token = mintV6().token;
    let cases = 0;
    for (let i = 0; i < token.length; i++) {
      for (const ch of ALPHABET) {
        if (ch === token[i]) continue;
        const t = token.slice(0, i) + ch + token.slice(i + 1);
        if (codeOf(() => parseInvite(t)) !== "bad-invite") throw new Error(`position ${i} → ${ch} was accepted`);
        cases++;
      }
    }
    expect(cases).toBeGreaterThan(602 * 62);
  });

  test("each malformed shape is bad-invite", () => {
    const token = mintV6().token;
    const [, seg, sig] = token.split(".");
    const cases: Record<string, string> = {
      "an extra . part": `${token}.AA`,
      "a missing part": `${INVITE_PREFIX}.${seg}`,
      "prefix aiprof-inv2": `aiprof-inv2.${seg}.${sig}`,
      "= padding": `${token}==`,
      "claims re-encoded with spaces": signed(JSON.stringify(JSON.parse(V6_CLAIMS_JCS), null, 1)),
      "an extra claim key": withClaims((c) => { c.extra = 1; }),
      "a __proto__ claim key": signed(V6_CLAIMS_JCS.replace('{"company"', '{"__proto__":{},"company"')),
      "exp − iat of 91 days": withClaims((c) => { c.exp = (c.iat as number) + 91 * DAY; }),
      "exp equal to iat": withClaims((c) => { c.exp = c.iat; }),
      "unsorted fields": withClaims((c) => { c.fields = ["fingerprints", "exhibits"]; }),
      "a repeated field": withClaims((c) => { c.fields = ["exhibits", "exhibits"]; }),
      "an unknown field": withClaims((c) => { c.fields = ["exhibits", "secrets"]; }),
      "a 31-byte sealTo": withClaims((c) => { c.sealTo = b64u(VEC.bob.pub.subarray(0, 31)); }),
      "a bad role": withClaims((c) => { c.role = "-backend"; }),
      "an upper-case id": withClaims((c) => { c.id = "A1B2C3D4E5F60718293A4B5C"; }),
      "v 2": withClaims((c) => { c.v = 2; }),
      "a fractional iat": withClaims((c) => { c.iat = (c.iat as number) + 0.5; }),
      "a company name with a newline": withClaims((c) => { (c.company as { name: string }).name = "Example\nCo"; }),
      "an extra company key": withClaims((c) => { (c.company as Record<string, unknown>).x = 1; }),
      "claims that are not an object": signed("[]"),
      "a signature by another key": `${INVITE_PREFIX}.${seg}.${b64u(edSign(VEC.t2.seed, utf8(`${INVITE_PREFIX}.${seg}`)))}`,
      "4097 chars": `${token}${"A".repeat(4097 - token.length)}`,
      "an empty token": "",
    };
    for (const [what, t] of Object.entries(cases)) {
      expect({ what, code: codeOf(() => parseInvite(t)) }).toEqual({ what, code: "bad-invite" });
    }
    expect(cases["4097 chars"]).toHaveLength(4097);
    expect(codeOf(() => parseInvite(42 as unknown as string))).toBe("bad-invite");
    expect(Object.prototype).not.toHaveProperty("company");
  });

  test("the length cap is exactly 4096 characters, and a long claims part is what trips it", () => {
    // Validly signed claims padded with an extra key. A token is 99 characters plus its claims part, and a base64url
    // part is never 4n+1 long, so 4096 is out of reach: 2997 bytes of claims give 4095, and 2998 give 4097.
    const padded = (bytes: number): string => {
      const c = v6Claims();
      c.pad = "";
      c.pad = "q".repeat(bytes - jcs(c).length);
      return signed(jcs(c));
    };
    const under = padded(2997);
    expect(under).toHaveLength(4095);
    expect(messageOf(() => parseInvite(under))).toBe("not a valid invite: the claims must have exactly the keys " +
      "company, exp, fields, iat, id, nonce, role, roleHash, sealTo, v");
    const over = padded(2998);
    expect(over).toHaveLength(4097);
    expect(over.split(".")[1]).toHaveLength(3998);
    expect(messageOf(() => parseInvite(over))).toBe("not a valid invite: longer than 4096 characters");
  });

  test("a part that is not base64url says so in plain words", () => {
    const [, seg, sig] = mintV6().token.split(".");
    expect(messageOf(() => parseInvite(`${INVITE_PREFIX}.${seg}!.${sig}`))).toBe("not a valid invite: the claims part is not a base64url value");
    expect(messageOf(() => parseInvite(`${INVITE_PREFIX}.${seg}.${sig}AA`))).toBe("not a valid invite: the signature is not a 64-byte base64url value");
  });

  test("errors never repeat the token", () => {
    const token = mintV6().token;
    const [, seg] = token.split(".");
    for (const t of [token + "x", `aiprof-inv2.${seg}.AA`, signed('{"role":"' + "q".repeat(40) + '"}')]) {
      let message = "no throw";
      try {
        parseInvite(t);
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toStartWith("not a valid invite: ");
      expect(message).not.toContain(seg!.slice(0, 16));
      expect(message).not.toContain("qqqq");
    }
  });
});

describe("inviteStatus (Review Focus 1)", () => {
  const i = mintV6();
  const { iat, exp } = i.claims;
  test("is valid in [iat − 300 s, exp], expired after exp, not yet valid before iat − 300 s", () => {
    expect(inviteStatus(i, exp * 1000)).toBe("valid");
    expect(inviteStatus(i, (exp + 1) * 1000)).toBe("expired");
    expect(inviteStatus(i, exp * 1000 + 1)).toBe("expired");
    expect(inviteStatus(i, (iat - 300) * 1000)).toBe("valid");
    expect(inviteStatus(i, (iat - 301) * 1000)).toBe("not-yet-valid");
    expect(inviteStatus(i, iat * 1000)).toBe("valid");
  });

  test("a time that is not a finite number is an error, never valid", () => {
    for (const now of [NaN, Infinity, -Infinity, "1794909600000" as unknown as number, undefined as unknown as number]) {
      expect(() => inviteStatus(i, now)).toThrow("the current time must be a finite epoch-ms number");
    }
  });
});

describe("parseExpires", () => {
  test("reads days and hours as seconds, from 1 h to 90 d", () => {
    expect(parseExpires("14d")).toBe(1209600);
    expect(parseExpires("36h")).toBe(129600);
    expect(parseExpires("1h")).toBe(3600);
    expect(parseExpires("90d")).toBe(MAX_INVITE_S);
    expect(parseExpires("2160h")).toBe(MAX_INVITE_S);
  });

  test("anything else is an error", () => {
    for (const s of ["0d", "0h", "91d", "2161h", "2w", "", "d", "14", "-1d", "1.5d", " 14d", "14D", "014d", "99999999999999999999d"]) {
      expect(() => parseExpires(s)).toThrow();
    }
  });
});

describe("parseFields", () => {
  test("gives a sorted, unique list", () => {
    expect(parseFields("stack,signals,stack")).toEqual(["signals", "stack"]);
    expect(parseFields(OPTIONAL_FIELDS.toReversed().join(","))).toEqual([...OPTIONAL_FIELDS]);
  });

  test("an unknown field is an error", () => {
    for (const s of ["x", "stack,x", "Stack", "__proto__", "toString"]) expect(() => parseFields(s)).toThrow();
  });
});

describe("invite log", () => {
  let root: string;
  let home: ProfilerHome;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "aiprof-invites-"));
    home = profilerHome(testSys(root));
    ensurePrivateDir(home.dir, home.platform);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const entry = (id: string, name: string | null): InviteLogEntry => ({
    id, name, role: "backend", roleHash: "0".repeat(64), iat: 1794909600, exp: 1796119200, sealed: true, fields: ["exhibits", "fingerprints"],
  });

  test("is empty when the file is absent", () => {
    expect(readInviteLog(home).size).toBe(0);
  });

  test("two appends read back as two entries, keyed by id", () => {
    const a = entry("a1b2c3d4e5f60718293a4b5c", "Ada <b>");
    const b = entry("0123456789abcdef01234567", null);
    appendInviteLog(home, a);
    appendInviteLog(home, b);
    expect(readInviteLog(home)).toEqual(new Map([[a.id, a], [b.id, b]]));
  });

  test("a garbage or malformed line is skipped", () => {
    const a = entry("a1b2c3d4e5f60718293a4b5c", "Ada");
    appendInviteLog(home, a);
    appendFileSync(home.invites, "not json\n{}\n[1]\n" + JSON.stringify({ ...a, id: "0".repeat(24), sealed: "yes" }) + "\n");
    appendFileSync(home.invites, JSON.stringify({ ...a, id: "1".repeat(24), fields: ["secrets"] }) + "\n");
    appendFileSync(home.invites, '{"id":"' + "2".repeat(24)); // a torn last line
    const b = entry("0123456789abcdef01234567", null);
    appendInviteLog(home, b); // starts on a fresh line, so the torn line costs only itself
    expect(readInviteLog(home)).toEqual(new Map([[a.id, a], [b.id, b]]));
    expect(Object.prototype).not.toHaveProperty("sealed");
  });

  test("an entry that readInviteLog would skip is refused before anything is written", () => {
    const a = entry("a1b2c3d4e5f60718293a4b5c", "Ada");
    const bad: Array<Record<string, unknown>> = [
      { ...a, id: "A1B2C3D4E5F60718293A4B5C" },
      { ...a, name: 7 },
      { ...a, sealed: "yes" },
      { ...a, iat: 1.5 },
      { ...a, exp: NaN },
      { ...a, fields: ["secrets"] },
      { ...a, fields: "exhibits" },
      { ...a, role: undefined },
    ];
    for (const e of bad) {
      expect(() => appendInviteLog(home, e as unknown as InviteLogEntry)).toThrow("the invite log entry is malformed");
    }
    expect(existsSync(home.invites)).toBe(false);
    appendInviteLog(home, a);
    expect(readInviteLog(home)).toEqual(new Map([[a.id, a]]));
  });

  test.skipIf(!POSIX)("the file is 0600", () => {
    appendInviteLog(home, entry("a1b2c3d4e5f60718293a4b5c", null));
    expect(statSync(home.invites).mode & 0o777).toBe(0o600);
  });
});
