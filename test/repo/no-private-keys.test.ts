// No private key is ever committed (Global Constraints, Keys). This walks every text file that git tracks and looks for
// private-key MATERIAL, never for format names: the plans and this test name "kty":"OKP", "PRIVATE KEY" and the
// PKCS#8 prefixes on purpose, and those mentions pass. Test keys are the published RFC vectors (raw hex, which is
// allowed) or keys generated at run time, as in the self-tests below. release-keys.json holds public keys only.
import { afterAll, describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { profilerHome } from "../../src/home";
import { b64u, unb64u } from "../../src/trust/bytes";
import { initCompany } from "../../src/trust/company";
import { fingerprint, newEdKey } from "../../src/trust/keys";
import { testSys, VEC } from "../kit/keys";

const ROOT = join(import.meta.dir, "..", "..");

type Finding = "pem" | "pkcs8-hex" | "pkcs8-base64" | "jwk-d" | "keystore" | "signing-key";

const B64U_43 = String.raw`[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])`;
/** Each rule matches key material: a marker plus a full-length value. Names and prefixes alone never match. */
const RULES: ReadonlyArray<readonly [Finding, RegExp]> = [
  ["pem", /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/],
  // Ed25519 or X25519 PKCS#8 DER (F3) followed by its 32-byte private half, as hex.
  ["pkcs8-hex", /302e020100300506032b65(?:70|6e)04220420[0-9a-fA-F]{64}/],
  // The same DER as base64, as in a PEM body.
  ["pkcs8-base64", /MC4CAQAwBQYDK2V[wu]BCIEI[A-Za-z0-9+/]{40,}/],
  // A JWK private member "d" with a 32-byte value, also inside an escaped JSON string.
  ["jwk-d", new RegExp(String.raw`\\?"d\\?"\s*:\s*\\?"${B64U_43}`)],
  // A company.json "seed" or "priv", in JSON or in a JS/TS object literal.
  ["keystore", new RegExp(String.raw`\b(?:seed|priv)\\?["']?\s*:\s*\\?["'\x60]${B64U_43}`)],
  // The compile-time signing key, "<keyId>:<b64u seed>", next to its define name.
  ["signing-key", new RegExp(String.raw`AIPROF_RELEASE_SIGNING_KEY[^A-Za-z0-9]{1,8}[a-z][a-z0-9-]{1,31}:${B64U_43}`)],
];

function findings(text: string): Finding[] {
  return RULES.filter(([, re]) => re.test(text)).map(([name]) => name);
}

const decoder = new TextDecoder("utf-8", { fatal: true });

/** The tracked file's text, or null for a binary file (a NUL byte, or not UTF-8). */
function textOf(path: string): string | null {
  const bytes = readFileSync(path);
  if (bytes.includes(0)) return null;
  try {
    return decoder.decode(bytes);
  } catch {
    return null;
  }
}

function trackedFiles(): string[] {
  const out = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: ROOT });
  expect(out.exitCode).toBe(0);
  return out.stdout.toString().split("\0").filter((p) => p !== "");
}

const tmp = mkdtempSync(join(tmpdir(), "aiprof-nokeys-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("the scanner, on keys built at run time", () => {
  const ed = generateKeyPairSync("ed25519").privateKey;
  const x = generateKeyPairSync("x25519").privateKey;

  test("finds a PEM private key, and its base64 DER body", () => {
    for (const key of [ed, x]) {
      const pem = key.export({ format: "pem", type: "pkcs8" }).toString();
      expect(findings(pem)).toEqual(["pem", "pkcs8-base64"]);
      const body = pem.split("\n")[1];
      expect(findings(`const k = "${body}";`)).toEqual(["pkcs8-base64"]);
    }
    const header = (kind: string) => `-----BEGIN ${kind}PRIVATE KEY-----`; // built here, so this file holds no header
    expect(findings(header("EC "))).toEqual(["pem"]);
    expect(findings(header("ENCRYPTED "))).toEqual(["pem"]);
  });

  test("finds PKCS#8 DER as hex", () => {
    for (const key of [ed, x]) {
      const der = key.export({ format: "der", type: "pkcs8" }).toString("hex");
      expect(findings(`Buffer.from("${der}", "hex")`)).toEqual(["pkcs8-hex"]);
    }
  });

  test("finds a private JWK, raw or escaped inside a string", () => {
    for (const key of [ed, x]) {
      const jwk = JSON.stringify(key.export({ format: "jwk" }));
      expect(findings(jwk)).toEqual(["jwk-d"]);
      expect(findings(JSON.stringify(jwk))).toEqual(["jwk-d"]);
      expect(findings(JSON.stringify(key.export({ format: "jwk" }), null, 2))).toEqual(["jwk-d"]);
    }
  });

  test("finds a company.json, and its seed or priv in an object literal", () => {
    const home = profilerHome(testSys(tmp));
    initCompany(home, { name: "Example Co", now: 0 });
    const text = readFileSync(home.company, "utf8");
    expect(findings(text)).toEqual(["keystore"]);
    const seed = b64u(newEdKey().seed);
    expect(findings(`{ seed: "${seed}" }`)).toEqual(["keystore"]);
    expect(findings(`{ priv: '${seed}' }`)).toEqual(["keystore"]);
    expect(findings(`{ "priv": \`${seed}\` }`)).toEqual(["keystore"]);
  });

  test("finds an embedded signing key next to its define name", () => {
    const seed = b64u(newEdKey().seed);
    expect(findings(`AIPROF_RELEASE_SIGNING_KEY=v2-2026:${seed}`)).toEqual(["signing-key"]);
    expect(findings(`--define AIPROF_RELEASE_SIGNING_KEY='"v2-2026:${seed}"'`)).toEqual(["signing-key"]);
  });

  test("passes format names, prefixes, public keys and the published vectors", () => {
    const pubJwk = JSON.stringify(generateKeyPairSync("ed25519").publicKey.export({ format: "jwk" }));
    const ok = [
      'no JSON object holding both "kty":"OKP" and "d"',
      '{"kty":"OKP","crv":"Ed25519","d":"<seed>","x":"<pub>"}',
      pubJwk,
      "no `-----BEGIN … PRIVATE KEY-----` block",
      'const ED_PKCS8 = Buffer.from("302e020100300506032b657004220420", "hex");',
      "`302e020100300506032b657004220420` followed by the seed",
      "no `MC4CAQAwBQYDK2V[wu]BCIEI` followed by 40 base64 characters",
      'seed: hex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60"),',
      "embedded `test-39f713d0:<b64u(VEC.t2.seed)>`",
      '{"pub":"11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"}',
      `"sig":"${b64u(new Uint8Array(64))}"`,
      `seed: "${b64u(newEdKey().seed).slice(0, 42)}"`, // too short for a 32-byte seed
      `seed: "${b64u(new Uint8Array(33))}"`, // too long
    ];
    for (const line of ok) expect(findings(line)).toEqual([]);
  });
});

describe("the repository", () => {
  test("no tracked text file holds private-key material", () => {
    const files = trackedFiles();
    expect(files).toContain("src/trust/keys.ts");
    const found = files.flatMap((file) => {
      const text = textOf(join(ROOT, file));
      return text === null ? [] : findings(text).map((rule) => `${file}: ${rule}`);
    });
    expect(found).toEqual([]);
  });

  test("every release-keys.json entry is a public key with a matching fingerprint, and never a vector key", () => {
    const lists = trackedFiles().filter((file) => file === "release-keys.json" || file.endsWith("/release-keys.json"));
    expect(lists).toContain("src/trust/release-keys.json");
    const vectorPubs = [VEC.t1.pub, VEC.t2.pub, VEC.alice.pub, VEC.bob.pub].map((pub) => Buffer.from(pub).toString("hex"));
    for (const file of lists) {
      const list = JSON.parse(readFileSync(join(ROOT, file), "utf8")) as { v: unknown; keys: unknown };
      expect(list.v).toBe(1);
      expect(Array.isArray(list.keys)).toBe(true);
      for (const entry of list.keys as Array<Record<string, unknown>>) {
        expect(Object.keys(entry).sort()).toEqual(["alg", "fingerprint", "keyId", "pub", "revoked"]);
        const pub = unb64u(entry.pub as string, { bytes: 32 });
        expect(entry.fingerprint).toBe(fingerprint(pub));
        expect(vectorPubs).not.toContain(Buffer.from(pub).toString("hex"));
      }
    }
  });
});
