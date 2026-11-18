# Plan 4 — AI Candidate Profiler v2: trust stack, consent, verify, dossier, interview kit, compare console — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Paths.** `<A>` and `<B>` stand for the roots of the local checkouts of A (`build-with-bala/ai-candidate-profiler`) and B (`build-with-bala/ai-practice-report`). `<research>` stands for the private research notes, which are in neither repo. `<scratch>` stands for the session scratchpad, a folder outside both repos. The controller gives the concrete paths at dispatch.

**Goal:** Rebuild A (`ai-profiler`) on B's pinned core as the hiring app of spec §8. It covers:
- company keys and signed invites;
- a consented `.aiprof` bundle, signed with the release key and sealed to the company key;
- `verify`, which renders the "assay certificate" dossier with A's own template, from verified data only;
- an interview kit generated from gaps and unknowns;
- role profiles and an offline compare console with no default ranking.

**Architecture:**
- **`src/trust/`** is the trust stack, on `node:crypto` only. It pins every byte, and each format has a test vector (Formats below):
  - strict base64url and RFC 8785 JCS;
  - key fingerprints and invite tokens;
  - the bundle's signing input and file bytes;
  - the sealed envelope.
- **The candidate run:** B's `scan()` → `analyze()` → `exportPayload()` → consent → `prepare()` → sign → seal → write the `.aiprof` and the candidate copy.
  - Consent is a terminal menu plus `preview.html`.
  - `prepare()` produces the exact bytes that get signed.
- **The recruiter side:** `verify` classifies the input, authenticates it, checks the invite binding, and reads the payload through a deny-by-default view. Only then does A build its data models (dossier, kit, console) and render them with B's viz kit.
- **Order:** Tasks 1–13 need only Plan 2's core. Task 14 bumps the pin once Plan 3 has merged. Tasks 15–21 use the viz kit.

**Tech Stack:**
- Bun 1.3.11, TypeScript 5 (`strict`), `bun test`.
- `node:crypto`: Ed25519, X25519, HKDF-SHA256, AES-256-GCM, SHA-256, HMAC-SHA256.
- B's core and viz kit, pinned by commit SHA.
- Playwright from an install outside the repo, for visual QA only.
- No other runtime dependency.

**Spec:** `<A>/docs/superpowers/specs/2026-11-17-ai-leverage-suite-v2-design.md`.
- This plan implements:
  - §8.1–§8.4;
  - §8.5 without the pairing recorder;
  - §8.6 without calibration;
  - §8.7;
  - A's CI and security guard (§10);
  - visual QA of the dossier and the console;
  - the §11 P3' acceptance.
- §2, §3, §6.6, §6.7, §6.9, §9, §13 and §14 bind every task.

**Builds on:**
- **Plan 2** (`docs/superpowers/plans/2026-11-17-plan-2-core-analysis.md`), as merged into B's `main`. Tasks consume the names its Interfaces blocks state, mostly from Tasks 2, 4, 12, 13, 14 and 16. Task 1 pins them.
- **Plan 3** (`docs/superpowers/plans/2026-11-18-plan-3-practice-report-app.md`), merging in parallel. Tasks consume its "Interfaces for Plan 4" block and its Tasks 6, 8 and 10. Task 14 pins them.

**Research (private):** `<research>/03-trust-privacy.md` (main), `04-product-workflow.md` and `05-report-design.md`. Never commit them, and never quote values from them.

**Repo and branch:**
- **A** lives at `<A>` (public: `build-with-bala/ai-candidate-profiler`). `main` holds v1.5.0. The local `main` is a stale copy of the history from before the rewrite, so every command uses `origin/main` (pre-flight G1).
- Work happens on `feat/v2`. That branch holds only the docs and has never been pushed.
  - Task 0 makes it safe to push, and Task 1 pushes it.
  - Task 21 opens the PR into `main`. It is merged only after the final whole-branch review.
- **B** lives at `<B>` (`build-with-bala/ai-practice-report`). It is read-only for this plan: never check out, test or edit there, because another agent works in that checkout. Read B's code in A's `node_modules/ai-practice-report/`, which is exactly the pinned commit.

**Out of scope:**
- **Plan 5:** the pairing-session recorder (`session start/end`, Exhibit P), RFC 3161 timestamps (`--timestamp`), `verify --brief`, `calibrate`, the P1/P2 tools, and WSL.
- **Plan 6:** the release workflows, the release-key CI secret and the real `release-keys.json` entry, the 5-target release build, and README and methodology polish.

## Global Constraints

Plan 2's Global Constraints carry over where they apply to A. They cover the platform, free text, what is read (always through the core), repository content, real data, reading and temp files, identity and logging, tests, and commits and pushes. Plan 3's **Reports** constraints apply to every HTML file A writes: the preview, the candidate copy, the dossier and the console. This plan adds the constraints marked ✚.

**Dependencies**
- ✚ The only runtime dependency is `ai-practice-report`, given as `github:build-with-bala/ai-practice-report#<40-hex sha>`.
  - `package.json` `corePin` records `{ repo, sha, ref }`. `ref` names the branch state, or B's tag once one exists, for readability.
  - Local development may point at B's checkout with `file:`. The pin test fails on anything but a GitHub SHA, so such a change never lands.
- ✚ The only devDependencies are `typescript` and `@types/bun`, as in B. Playwright is never in `package.json`.
- ✚ `src/` imports B only through `ai-practice-report/core` and `ai-practice-report/viz`. Tests import B's test kits only through `test/kit/core.ts`.
- ✚ `bun install` fetches B from GitHub, so it runs with `dangerouslyDisableSandbox: true`.

**Crypto**
- ✚ Use `node:crypto` only: Ed25519, X25519, HKDF-SHA256, AES-256-GCM, SHA-256, HMAC-SHA256 and `randomBytes`. No other library, and no hand-made primitive.
- ✚ Every random byte comes from an injectable `Rand`, so tests reproduce exact bytes.
- ✚ Binary fields in JSON are strict base64url (F1).
- ✚ A file A signs or seals is exactly the JCS bytes of its value (F2). Readers reject every other byte sequence.

**Keys**
- ✚ No private key is ever committed: not in `src/`, `test/`, fixtures or docs.
  - Test keys are either the published RFC 8032 and RFC 7748 vector keys, or keys generated at test time.
  - `release-keys.json` holds public keys only, and never a vector key.
  - Task 3's test enforces this.
- ✚ Company keys live in `$AIPROF_HOME/company.json` (default `~/.ai-profiler/company.json`), mode 0600, in a 0700 folder on POSIX.
- ✚ The release signing key reaches a binary only through the compile-time define `AIPROF_RELEASE_SIGNING_KEY`. Plan 6 wires it from a CI secret. Without the define, a build signs with a one-time dev key, and its bundles verify as "dev build".

**Trust and legal wording**
- ✚ `TRUST_STATEMENT` (Spec values) appears verbatim in four places: `--help`, the preview, the dossier's §6 and the console. Every banner and message says tamper-evidence, never proof.
- ✚ No surface makes a hire, no-hire or advance recommendation, ranks people by one number, or orders candidates by default. "What to verify next" takes the place of a recommendation.
- ✚ The server-backed share is shown. It never orders, flags or scores anything.

**Names and surfaces (§6.7)**
- ✚ Real project names appear only in the terminal consent table and in `find`'s output. Everything else carries labels only, plus the names the candidate chose to reveal:
  - `preview.html` and the candidate copy;
  - bundles and the `--json` sidecar;
  - dossiers and the console;
  - logs.
- ✚ `verify` never renders, opens or executes HTML the candidate supplied. It renders only from data that passed verification, with A's own template.

**Files and processes**
- ✚ A command writes only the files it names, each 0600.
- ✚ The consent preview exists only while the menu runs. It is deleted on confirm, on quit, at end of input and on SIGINT.
- ✚ No network requests. `--timestamp`, `session`, `calibrate` and `--brief` are usage errors that say "… is not available in this version".
- ✚ Exit codes:
  - 0: success;
  - 1: failure (verification or binding failed, invite expired, write error, no `find` match);
  - 2: usage error;
  - 3: readable but unverifiable (dev build, self-reported, v1 report);
  - 130: interrupted.

**Tests**
- ✚ Recruiter-side tests set `AIPROF_HOME` to a temp folder, so the real `~/.ai-profiler` is never touched.
- ✚ Every HTML file a test renders passes `renderKit.auditHtml` (from Task 17 on).

**Docs:** ✚ `test/docs.test.ts` (Task 0) runs in CI. Public docs state formats and rules, never figures from the owner's machine.

## Spec values (verbatim — tasks cite these and never restate them differently)

**§3 Honest trust limits:** "the candidate owns the machine; anything embedded in a client binary can be extracted. Signing gives tamper-*evidence*; forensics raise the cost of fabrication; only the live walkthrough/pairing ties evidence to a person. The product must say exactly this."

**§8.2**
- "**Release key:** one Ed25519 keypair per major release line, private key held only in the protected GitHub Actions `release` environment (owner approval per run), injected at compile time (`--define`) so it is never in the repo; public keys + key IDs + revocation list ship in `src/trust/release-keys.json`. Local/dev builds use a dev key and verify as "dev build". Honest framing everywhere: proves "produced by an official vN binary or by someone who extracted its key"."
- "**Company keys:** `keys init` writes `~/.ai-profiler/company.json` (0600): Ed25519 (invites) + X25519 (sealing); prints a public fingerprint."
- "**Invite token:** compact, signed by the company key; carries role id + role-profile hash + requested fields + expiry + nonce + `sealTo`." Token shape (§8.1): `aiprof-inv1.<b64 JSON{v,id,company,role,roleHash,nonce,iat,exp,fields,sealTo}>.<sig>`.
- "Signature over RFC 8785 (JCS) canonical JSON of everything except `signature`/`timestamp`. Sealing (when the invite has `sealTo`): X25519 ECDH → HKDF-SHA256 → AES-256-GCM over the canonical payload; only `format/meta/invite` stay in the clear."

**§8.3**
```
scan ─► preview.html opens (every field to be shared, raw JSON toggle, what was read vs shared)
     ─► terminal: [1] exclude tools  [2] exclude projects  [3] exclude date range  [4] reveal a project name
                  [5] toggle timestamp (network)  [c] confirm and seal  [q] quit (nothing written)
     ─► exclusions recorded as counts in the bundle
non-interactive: --yes --exclude-tool X --exclude-project P-3F2A --since 2026-06-01 --timestamp
```

**§8.4**
- "Reading order: 10-second certificate → 2-minute skim → exhibits → interview kit → method & chain of custody. One long document, sticky contents rail (desktop) / chapter bar (mobile), fixed chapter order so dossiers compare side by side, every claim cites a lettered exhibit, every exhibit shows its window + n." The certificate mock that follows that sentence in the spec is the first-screen target.
- "Seal states: **struck gold** (sufficient evidence and no failed check — "not anchorable" tools are neutral and appear as an integrity line, not a seal state) · **outlined PROVISIONAL** (thin evidence) · **vermilion FLAGGED** (an integrity check failed; banner above everything)."
- "No hire/advance recommendation — "what to verify next" instead."
- Chapters: "§0 Certificate · §1 How they work (ledger expanded, Ex.A day under the loupe, Ex.B delegation outline, Ex.C verification loop) · §2 Habit & trajectory (Ex.D habit & rotation, Ex.E then→now) · §3 Range (Ex.F agent-touched stack, tool ledger table) · §4 Findings (Strengths · Watch · **Unknowns**) · §5 Interview kit · §6 Method & chain of custody (sources, windows, caps, integrity checks with ⚑ propagated to affected exhibits, redactions/exclusions, weights, scorer + reference versions, payload hash, release key ID, CSP)."

**§8.5**
- "Probes generated from gaps and unknowns, ordered by uncertainty × dimension weight; each probe card prints with write-in lines". The probe card in the spec (PROBE 3 · VERIFICATION) is the layout.
- "**Walkthrough:** the bundle lists ~8 fingerprinted sessions (diverse by tool, size, recency, incl. the peak-parallel one); the candidate runs `ai-profiler find <fp>` to locate it locally and walks through it on screen share."

**§8.6**
- "**Role profiles** (`roles/*.json`, shipped: backend, frontend, full-stack, platform/infra, AI engineer, tech lead; editable): `mustHaves[{dimension, targetBand, weight, why}]`, `niceToHaves`, `probeBank`. The invite carries the role id + content hash. Role fit is shown per must-have as **meets / partial / below / insufficient** using interval vs target — no total."
- "**Compare console** (`compare` → one offline HTML): verified bundles side by side on the role's must-haves and all dimensions (intervals overlaid), integrity bands, notes per candidate, shortlist toggle, CSV export. Default order = import order; the recruiter sorts explicitly by any column."

**§8.7:** "`--name`, `--out`, `--json`, `--no-open` keep working; `--redact` is now the default (accepted, prints a notice); `--reveal-projects` added. `verify` on a v1 HTML says "v1 report — unverifiable"."

**§6.7:** "**Where real names may appear (my call):** only on surfaces that by design never leave the machine — A's terminal consent UI (a label ↔ name table used to exclude or reveal projects) and B's private report (…). Never in A's `preview.html` or candidate copy (labels only — these files get forwarded by mistake), bundles, share cards, employer exports, or logs. … The canary harness encodes one rule per surface." Preview contract: "both apps can render exactly the bytes that would be exported (raw-JSON toggle). A requires explicit confirmation before sealing."

**§10:** "bundle sign/verify/seal/tamper round-trips"; "**Visual QA:** Playwright screenshots of both reports in dark/light, 1440 px and 390 px, and print-to-PDF; reviewed before declaring done."

**§11 P3' acceptance:** "invite → candidate run → consent → `.aiprof` → verify → dossier works end to end; tampering with any byte fails verification; sealed bundles open only with the company key; compare console renders 5 bundles."

**Copy pinned by this plan** (adapted from §3 and §6.7, exact):
- `TRUST_STATEMENT`:
  1. "A signature shows that this file was made by an official ai-profiler v2 binary, or by someone who extracted that binary's key, and that it has not changed since."
  2. "It is tamper-evidence, not proof: the candidate owns the machine, and anything embedded in a client binary can be extracted."
  3. "The integrity checks raise the cost of fabrication; they do not prove honesty."
  4. "Only the live walkthrough and pairing tie the evidence to a person."
  5. "ai-profiler makes no hire or no-hire recommendation and ranks no one; people decide, using the interview."
- `PRIVACY_STATEMENT`:
  1. "ai-profiler reads your local agent history files, which contain your prompts, replies and code, in memory to count things."
  2. "It keeps none of the text, never opens credential files, and makes no network requests."
  3. "Mixed files such as ~/.claude.json are parsed in memory and only allowlisted fields are kept."
  4. "In the git repositories your sessions ran in, it reads commit metadata and a short list of config files (see --explain), never source files; --no-repo-signals turns this off."
  5. "Nothing is shared until you approve the preview, which shows every byte of the file you send."
  6. "Projects appear as labels such as P-3F2A; their real names appear only in this terminal, unless you choose to reveal one."

## Formats (pinned; Tasks 2–9 implement them, and every vector must reproduce exactly)

**F1 — base64url.**
- Use the RFC 4648 §5 alphabet, with no padding.
- `unb64u(s)` accepts `s` only when all of these hold:
  - it matches `^[A-Za-z0-9_-]*$`;
  - `s.length % 4 !== 1`;
  - re-encoding the decoded bytes gives `s` again.

  The last rule rejects non-zero unused bits. Without it, a changed last character of a signature could decode to the same bytes.
- Fixed lengths:
  - keys and seeds: 32 bytes (43 chars);
  - signatures: 64 bytes (86 chars);
  - nonces: 16 bytes (22 chars).

**F2 — JCS (RFC 8785).**
- `jcs(v)` serializes:
  - `null`, `true` and `false` as themselves;
  - finite numbers by ECMAScript `Number#toString`, with `-0` as `0`;
  - strings by `JSON.stringify`, after rejecting lone surrogates;
  - arrays in order;
  - plain objects (prototype `Object.prototype` or `null`), with their own string keys sorted by UTF-16 code units (default `Array#sort`), leaving out keys whose value is `undefined`.

  Everything else throws `TrustError("bad-format")`: non-finite numbers, an `undefined` array item, bigint, functions, symbols, `Date`, `Map`, and class instances.
- The output is UTF-8.
- **Reading** (`parseCanonical`):
  - the input is at most `maxBytes` long (default 8 MiB);
  - it has no UTF-8 BOM;
  - it is strict UTF-8 (`TextDecoder` with `fatal: true`);
  - it parses with `JSON.parse`;
  - `jcsBytes(value)` equals the input byte for byte. A value that `jcs` cannot serialize, such as the `Infinity` that `1e309` parses to, counts as not canonical. So does any other throw while re-serializing, such as the `RangeError` that deep nesting causes. An implementation may cap the depth instead, with the same code (pre-flight G3).

  Otherwise it throws `too-large`, `not-json` or `not-canonical`.

**F3 — Keys and ids.**
- Keys are raw 32-byte values. They are imported through RFC 8410 DER prefixes:
  - Ed25519 PKCS#8: `302e020100300506032b657004220420` followed by the seed;
  - Ed25519 SPKI: `302a300506032b6570032100` followed by the public key;
  - X25519 PKCS#8: `302e020100300506032b656e04220420` followed by the private key;
  - X25519 SPKI: `302a300506032b656e032100` followed by the public key.

  A raw public key is the last 32 bytes of its SPKI DER export.
- `fingerprint(pub)` is the first 16 lower-case hex characters of SHA-256(pub).
- `displayFingerprint` upper-cases it and joins its groups of four with `-`.
- A company key's `kid` is its fingerprint.
- Release key ids match `^[a-z][a-z0-9-]{1,31}$` and never start with `dev-`. Dev key ids are `dev-` followed by the first 8 hex characters of the fingerprint.

**F4 — Invite token.**
- **Claims.** Exactly these keys:

  | key | value |
  |---|---|
  | `v` | `1` |
  | `id` | 24 lower-case hex: 12 random bytes, drawn first |
  | `company` | `{ name: 1–80 chars without control chars, pub: Ed25519 public key }` |
  | `role` | `^[a-z0-9][a-z0-9-]{1,31}$` |
  | `roleHash` | 64 lower-case hex (F8) |
  | `nonce` | 16 random bytes, drawn second |
  | `iat`, `exp` | integer epoch seconds, with `0 < exp − iat ≤ 90 days` |
  | `fields` | sorted, unique, a subset of `OPTIONAL_FIELDS` |
  | `sealTo` | the company's X25519 public key, or `null` |

- **Token:** `seg = b64u(jcsBytes(claims))`, and `token = "aiprof-inv1." + seg + "." + b64u(Ed25519(companySeed, ascii("aiprof-inv1." + seg)))`.
- **Parsing:**
  - the token is at most 4096 chars, in exactly three `.`-separated parts;
  - the prefix is `aiprof-inv1`;
  - each part decodes strictly;
  - the claims are canonical JCS and match the table;
  - the signature verifies under `claims.company.pub`.

  Any failure is `bad-invite`, with the reason.
- **Validity:**
  - `expired` when `now > exp`;
  - `not-yet-valid` when `now < iat − 300 s`;
  - `valid` otherwise.

  A bundle's `createdAt` must lie in `[iat − 300 s, exp]`. `verify` never compares an invite with the current time.

**F5 — Bundle `aiprof/2`.**
- **Keys:** `format`, `meta`, `invite`, `subject`, `payload`, `exhibits`, `integrity`, `fingerprints`, `exclusions`, `timestamp`, `signature` and `sealed`.

  | key | value |
  |---|---|
  | `format` | `"aiprof/2"` |
  | `meta` | `{ profiler, core, coreSha (40 hex), createdAt ("YYYY-MM-DDTHH:MM:SSZ", UTC), keyId, build ("release" or "dev") }`, plus `devKey` (b64u) exactly when `build` is `"dev"` |
  | `invite` | the token, or `null` |
  | `subject` | `{ name: null or 1–80 chars }` |
  | `payload` | `exportPayload().value` without `forensics`, filtered to the required keys plus the requested sections |
  | `exhibits` | an object, or `null` |
  | `integrity` | the export's `forensics`, lifted out of the payload |
  | `fingerprints` | at most 8 (F7), or `[]` |
  | `exclusions` | `{ tools, projects, sessions }` |
  | `timestamp` | `null` in this plan |
  | `signature` | `{ alg: "Ed25519", keyId, sig }` |
  | `sealed` | `null` |

- **Rules:**
  - `meta.keyId` equals `signature.keyId`.
  - **Signing input:** `jcsBytes` of the bundle without `signature` and `timestamp`. It still includes `"sealed": null`. V7 follows this rule: its signing input has no `"timestamp"` key (pre-flight G2).
  - **File:** `jcsBytes(bundle)`.
  - A non-`null` `timestamp` is `timestamp-unsupported` in this plan.

**F6 — Sealed bundle.** Sign first, then seal. The invite must carry `sealTo`, whose bytes are R.
1. Make an ephemeral X25519 key `(e, E)` from `Rand`.
2. `shared = X25519(e, R)`. An all-zero result is `bad-key`.
3. `okm = HKDF-SHA256(ikm = shared, salt = E ‖ R, info = ascii("aiprof/2 seal v1"), length = 44)`, so `key = okm[0..32]` and `iv = okm[32..44]`. The IV is derived, which is safe because every seal uses a fresh ephemeral key.
4. `header = { alg: "X25519-HKDF-SHA256-A256GCM", kid: fingerprint(R), epk: b64u(E) }`.
5. `aad = jcsBytes({ format, meta, invite, sealed: header })`.
6. The plaintext is `jcsBytes` of the signed bundle without `format`, `meta`, `invite` and `sealed`. Its keys are `exclusions`, `exhibits`, `fingerprints`, `integrity`, `payload`, `signature`, `subject` and `timestamp`.
7. `ct = AES-256-GCM(key, iv, aad, plaintext) ‖ tag(16)`.
8. The file is `jcsBytes({ format, meta, invite, sealed: { ...header, ct: b64u(ct) } })`.

**Opening:**
1. Check `kid` against the local X25519 key, then derive and decrypt.
2. The plaintext must be canonical JCS with exactly those eight keys.
3. Rebuild `{ format, meta, invite, ...inner, sealed: null }`, then verify its signature as for any bundle.

**F7 — Session fingerprints.**
- **Value:** `fp` is the first 32 lower-case hex characters of `HMAC-SHA256(key = invite nonce, msg = utf8("aiprof-fp1\n" + sessionId))`.
  - `sessionId` is the core's `SessionEv.id`, which is `<tool>:<raw id>`.
  - `day` is the session's local `YYYY-MM-DD` in the analysis time zone.
- **Size:** `size` is S below 20 actions, M below 100, L below 400, and XL otherwise. Actions are the tool events of the session and all its descendants (`parentId`) that pass Plan 2's walk rule 2: category not `meta`, and `outcome` not `denied` or `cancelled`. Use the core's `isAction` when `ai-practice-report/core` exports it (Task 1 records whether it does).
- **Candidates:** detail-window sessions that have no `parentId`, have origin `human`, have at least one action, and are not excluded (by tool, by project key, or by a start outside `[from, to]`).
- **Picks,** never picking a session twice:
  1. the session that overlaps the most other candidates;
  2. the session with the most actions;
  3. the latest start;
  4. then rounds over the tools, ordered by candidate count descending (ties by tool id). Each round takes, per tool, a session whose (size, ISO week) pair is not yet chosen, preferring the latest start.

  Stop at 8 picks. Ties go to more actions, then to the later start, then to the id.
- **Output:** the picks, sorted by `day`, then `fp`.

**F8 — Hashes and numbers.**
- `payloadHash` is the SHA-256 hex of the signing input.
- `dossierNo` is the first 8 hex characters of `payloadHash`, upper-cased, written `XXXX-XXXX`. A self-reported bundle uses the hash of its file bytes instead.
- `roleHash` is the SHA-256 hex of `jcsBytes(profile)`.
- An invite's display id is the first 4 hex characters of `id`, upper-cased.

**F9 — Classifying input.** Classifying only detects the kind of input; the readers decide validity.
1. More than 8 MiB → `unknown` (`too-large`).
2. Skip a UTF-8 BOM and ASCII whitespace.
3. If the next byte is `<`, the input is HTML:
   - `v1-html` when it contains both `<title>AI Leverage Dossier</title>` and `<script id="data" type="application/json">`;
   - `html` otherwise.
4. If the next byte is `{`, try `JSON.parse`. On failure → `unknown` (`not-json`).
5. If the value is a non-null, non-array object with `format: "aiprof/2"` (pre-flight G17):
   - `sealed` is a non-null, non-array object → `sealed`;
   - else `signature` is a non-null, non-array object → `signed`;
   - else, from Task 15 on, `isSelfReported` holds → `self-reported`.
6. Anything else → `unknown` (`bad-format`).

**Vector keys** (published test vectors; never trust anchors):

| name | source | private | public |
|---|---|---|---|
| `VEC.t1` | RFC 8032 TEST 1 | `9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60` | `d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a` |
| `VEC.t2` | RFC 8032 TEST 2 | `4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb` | `3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c` |
| `VEC.alice` | RFC 7748 §6.1 | `77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a` | `8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a` |
| `VEC.bob` | RFC 7748 §6.1 | `5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb` | `de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f` |

**Vectors:**

| id | input | expected |
|---|---|---|
| V1 | Ed25519 `VEC.t1`, empty message | signature `e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b` |
| V2 | Ed25519 `VEC.t2`, message `72` | signature `92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00` |
| V3 | X25519(alice priv, bob pub) | `4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742` |
| V4 | HKDF RFC 5869 A.1 (IKM `0b`×22, salt `000102…0c`, info `f0…f9`, L 42) | `3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865` |
| V4b | AES-256-GCM, zero key, zero IV: empty / 16 zero bytes | tag `530f8afbc74536b9a963b4f1c4cb738b` / ct `cea7403d4d606b6e074ec5d3baf39d18`, tag `d0d1c8a799996bf0265b98b5d48ab919` |
| V5 | `fingerprint` of t1, t2 and bob | `21fe31dfa154a261`, `39f713d0a644253f`, `f35e5616160a30bf`; `displayFingerprint(t1)` = `21FE-31DF-A154-A261`; `b64u(t1 pub)` = `11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo` |
| V6 | invite (below) | token 602 chars, SHA-256 `b4baae7ecda50ce5b41e4042b9eedda4f3466a120590735acffb140907d9b95e`; signature `0bPyJilGau62BrkSdXlPzXo12bybMDMA0PV3q3fSGqyCHoDOzegxPHO9DzlbOsVzdJB45mziA0sxkdxPWhD5AA` |
| V7 | bundle (below), `VEC.t2` under `test-39f713d0` | signing input 1204 bytes, SHA-256 `9282a29039f7641355b7dd3d08bb19095f0ba7d7e6f3764b77bd6d97efaac575`; sig `xboFqdBnign8mQMslWGpHAzzOZ3kdrv-CP5h2crNAb1Il0wYVBlfnUkt3LKvESQAd-dAVMy3rPrcGOcK_sgEDg`; file 1370 bytes, SHA-256 `a68461f60fddb4a8dbcdc9ca7c3265241c6320e2f3c1586c1d3bf02a7cdfb414`; `dossierNo` `9282-A290` (pre-flight G2) |
| V8 | V7 sealed to bob, ephemeral alice | key `085c202071f44d0e247786af1dfbff67affcf39348b36b8d0f90e869fedbb502`, iv `bd7bb02c87539ff7036c044c`; SHA-256(aad) `4754459c26a9ce4fbf4d100bfdd406cf5fa74807389b340b7a7051e1290e4c7a`; SHA-256(plaintext) `47bfe8a269abc4156bf99a4f5186c799c5556c2cc9692afff35e6b8439e42792`; ct 561 bytes (545 + the 16-byte tag), tag `779b49da1986483d750f0899e4f05228`; file 1691 bytes, SHA-256 `7d339148e66e59b2ce285ff839fff87749b8f373a5efc53eab92013e5816725f` (pre-flight G2) |
| V9 | `sessionFingerprint(000102…0f, "claude-code:11111111-2222-3333-4444-555555555555")` | `c1f6af6c44d0ef639be976ee2e3f111d` |

**V6 input:**
- company: `VEC.t1`, named "Example Co";
- `Rand` returns `a1b2c3d4e5f60718293a4b5c` first, then `000102030405060708090a0b0c0d0e0f`;
- role `backend`, `roleHash` 64 zeros;
- `now` = 2026-11-17T10:00:00Z, `expiresS` 14 days;
- fields `exhibits,fingerprints`;
- sealed to `VEC.bob`.

This gives the claims JCS `{"company":{"name":"Example Co","pub":"11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"},"exp":1796119200,"fields":["exhibits","fingerprints"],"iat":1794909600,"id":"a1b2c3d4e5f60718293a4b5c","nonce":"AAECAwQFBgcICQoLDA0ODw","role":"backend","roleHash":"0000000000000000000000000000000000000000000000000000000000000000","sealTo":"3p7bfXt9wbTTW2HC7OQ1Nz-DQ8hbeGdNrfx-FG-IK08","v":1}`.

**V7 input** (`<V6>` is the V6 token). Its signing input is this object without `timestamp`; its file is this object plus `signature` (pre-flight G2):
```json
{"format":"aiprof/2","meta":{"profiler":"2.0.0-dev","core":"1.0.0","coreSha":"0000000000000000000000000000000000000000","createdAt":"2026-11-18T10:42:07Z","keyId":"test-39f713d0","build":"release"},
 "invite":"<V6>","subject":{"name":null},"payload":{"schema":"aiprof/2","core":"1.0.0","reference":"v0"},"exhibits":null,
 "integrity":{"band":"consistent","serverBacked":0.5,"anchorable":["claude-code"],"notAnchorable":[],"checks":[]},
 "fingerprints":[{"fp":"c1f6af6c44d0ef639be976ee2e3f111d","day":"2026-11-02","tool":"claude-code","size":"L"}],
 "exclusions":{"tools":0,"projects":0,"sessions":0},"timestamp":null,"sealed":null}
```

**JCS vectors (RFC 8785).**
- Appendix B, as IEEE-754 bit pattern → output:

  | bits | output |
  |---|---|
  | `0000000000000000` | `0` |
  | `8000000000000000` | `0` |
  | `0000000000000001` | `5e-324` |
  | `8000000000000001` | `-5e-324` |
  | `7fefffffffffffff` | `1.7976931348623157e+308` |
  | `ffefffffffffffff` | `-1.7976931348623157e+308` |
  | `4340000000000000` | `9007199254740992` |
  | `c340000000000000` | `-9007199254740992` |
  | `4430000000000000` | `295147905179352830000` |
  | `7fffffffffffffff` | throws |
  | `7ff0000000000000` | throws |
  | `44b52d02c7e14af5` | `9.999999999999997e+22` |
  | `44b52d02c7e14af6` | `1e+23` |
  | `44b52d02c7e14af7` | `1.0000000000000001e+23` |
  | `444b1ae4d6e2ef4e` | `999999999999999700000` |
  | `444b1ae4d6e2ef4f` | `999999999999999900000` |
  | `444b1ae4d6e2ef50` | `1e+21` |
  | `3eb0c6f7a0b5ed8c` | `9.999999999999997e-7` |
  | `3eb0c6f7a0b5ed8d` | `0.000001` |
  | `41b3de4355555553` | `333333333.3333332` |
  | `41b3de4355555554` | `333333333.33333325` |
  | `41b3de4355555555` | `333333333.3333333` |
  | `41b3de4355555556` | `333333333.3333334` |
  | `41b3de4355555557` | `333333333.33333343` |
  | `becbf647612f3696` | `-0.0000033333333333333333` |
  | `43143ff3c1cb0959` | `1424953923781206.2` |

- §3.2.2: the input below (as written in the RFC, escapes and all) → `{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\u000f\nA'B\"\\\\\"/"}`.
  ```
  {"numbers":[333333333.33333329,1E30,4.50,2e-3,0.000000000000000000000000001],"string":"\u20ac$\u000F\u000aA'\u0042\u0022\u005c\\\"\/","literals":[null,true,false]}
  ```
- §3.2.3: the sorting example, whose keys are U+20AC, U+000D, U+FB33, `1`, U+1F600, U+0080 and U+00F6 with the RFC's values, → the UTF-8 hex `7b225c72223a2243617272696167652052657475726e222c2231223a224f6e65222c22c280223a22436f6e74726f6c222c22c3b6223a224c6174696e20536d616c6c204c6574746572204f205769746820446961657265736973222c22e282ac223a224575726f205369676e222c22f09f9880223a22456d6f6a693a204772696e6e696e672046616365222c22efacb3223a22486562726577204c65747465722044616c6574205769746820446167657368227d`.
- A lone surrogate (`"\ud800"`) throws.

## Builder's calls (binding here; spec §14 leaves them open)

1. **One canonical byte sequence per file.** Signed and sealed files are exactly F2 bytes. A file that was re-saved, re-indented or given a BOM fails as `not-canonical`. Together with F1, this is why flipping any single byte fails verification.
2. **A's own JCS.** The spec places `jcs` in A's `trust/`, and the signatures depend on it, so A implements F2 and pins it with the RFC vectors. Task 2 also asserts that B's `canonicalJson` agrees on the Appendix B rows (both throws included), on §3.2.2 and §3.2.3, and on a persona payload. Plan 2 Task 14 makes `canonicalJson` throw on lone surrogates too (pre-flight G6).
3. **Bundle fields beyond the spec's sketch:**
   - `integrity` is the export's `forensics`, lifted out of the payload, so nothing is duplicated.
   - `subject.name` carries the candidate's optional `--name`. It is signed, and sealed when the bundle is sealed; it is never in the clear `meta`.
   - `exhibits` carries `computeExhibits` output through a deny-by-default copy. Plan 3's builder's call 2 allows this. B's schema is unchanged.
4. **Requested fields.**
   - These payload keys always ship: `schema`, `core`, `reference`, `coverage`, `overall`, `dimensions` and `exclusions`.
   - These sections ship only when the invite requests them (`OPTIONAL_FIELDS`): `config`, `exhibits`, `exposure`, `fingerprints`, `identity`, `personas`, `projects`, `risk`, `signals` and `stack`.
   - An unbound run ships every section, `exhibits` included. Its `fingerprints` stay `[]`, because it has no nonce (pre-flight G9).
5. **Labels are per run.** The scan salt stays random. A salt the recruiter knew would let them test guessed paths against the labels. So `--exclude-project` and `--reveal-projects` accept any of:
   - a label from the same run;
   - a folder name;
   - a path prefix.
6. **Consent menu.**
   - Item [3] *limits* the date range, because the core keeps `[from, to]`.
   - Item [6] turns repo signals off by re-analysing with an `off` `RepoSignals`, with no rescan. `--no-repo-signals` instead skips the git after-pass entirely.
   - The menu, table and prompts write only through `Deps.tty`. Production maps it to stderr, and the menu runs only when stdin and stderr are both TTYs, so a redirected stderr never receives the real-names table (pre-flight G10).
7. **Dev builds** sign with a one-time key per run. The bundle carries its public key in `meta.devKey`. `verify` says "DEV BUILD" and exits 3.
8. **Recruiter-only content.** The interview kit and role fit appear only in the recruiter's dossier, never in the preview or the candidate copy.
9. **Test kits.** B exports only `./core` and `./viz`, so `test/kit/core.ts` imports B's installed test kits by relative path into `node_modules/ai-practice-report/test/…`. Bun copies a `file:` dependency and extracts a GitHub one whole, and Task 1 checks that the kits are there.
10. **`--explain`** prints the core's own `describe` texts and no per-plugin counts. B's env and placeholder helpers live in B's app and are not exported.
11. **Dates.**
    - The terminal shows ISO dates (`2026-12-01`).
    - HTML shows `renderKit.fmt.day` in UTC, with `(UTC)` after it.
12. **CSV export** follows RFC 4180, with CRLF line ends. A cell that starts with `=`, `+`, `-`, `@`, a tab or CR gets a leading `'`, so a spreadsheet never runs a typed note as a formula.

## Review Focus

1. **Clocks and expiry edges.** Cases:
   - a candidate clock up to 5 min ahead of the invite's `iat`;
   - a run exactly at `exp`, and one second after it;
   - a bundle verified weeks after its invite expired.

   Expected:
   - the run accepts the skewed clock and refuses an expired invite, saying when it expired;
   - `verify` judges `createdAt` against `[iat − 300 s, exp]` and never against the current time, so a bundle stays verifiable after its invite expires.

   Pinned by Tasks 5, 8 and 13.
2. **Hostile files given to `verify` and `compare`.** Cases:
   - a 9 MiB file;
   - 100,000 nested arrays;
   - `__proto__` keys;
   - `1e309`;
   - a BOM, CRLF or re-indented re-save;
   - a token with an extra dot;
   - a truncated sealed `ct`;
   - a payload with a missing field;
   - any HTML file.

   Expected: a precise failure and exit 1 (3 for a v1 report), no crash, no prototype pollution, no dossier written, and HTML is never rendered. Pinned by Tasks 6, 7 and 8.
3. **Missing or wrong company key.** Cases:
   - `verify` with no `company.json`;
   - another company's key;
   - `keys init` run twice;
   - a world-readable key file.

   Expected:
   - the sealed case names both fingerprints ("sealed to F35E-…; this machine's key is …");
   - an unsealed bundle verifies, with a note that the invite's issuer was not checked;
   - `keys init` never overwrites without `--force`;
   - reading keys warns about loose permissions.

   Pinned by Tasks 3, 7 and 8.
4. **Interrupted or odd candidate runs.** Cases:
   - Ctrl-C at the menu;
   - end of input mid-menu;
   - no TTY and no `--yes`;
   - a missing or read-only output folder;
   - a second run on the same day;
   - a `--name` holding `/` or an emoji.

   Expected: the preview is removed, nothing is half-written, the exit codes are 130 / 0 / 2 / 1 / 0, and the file stem is safe. Pinned by Tasks 9 and 13.
5. **Edge evidence in the dossier and the console.** Cases:
   - an empty home;
   - only tools that are not anchorable;
   - a self-reported B export;
   - a dev build;
   - 20 bundles for mixed roles;
   - two bundles from one invite;
   - names (subject, invite log, revealed projects) holding HTML, RTL text, emoji or CJK.

   Expected:
   - a provisional seal, and empty exhibits that state `n` and `needs`;
   - a neutral "Unverifiable" line;
   - the right banners;
   - duplicates marked, and no ordering by default;
   - every name escaped;
   - no "NaN", "undefined" or "null" in any text.

   Pinned by Tasks 16, 17 and 18.

## File map

```
test/docs.test.ts                                                                                   0
package.json · tsconfig.json · bun.lock · .gitignore · .github/workflows/{ci,security-guard}.yml    1
src/version.ts · src/payload/catalog.ts · test/kit/core.ts · test/{pin,contract/plan2}.test.ts      1
src/trust/{errors,bytes,jcs,keys}.ts                                                                2
src/home.ts · src/trust/{company,release,signer}.ts · src/trust/release-keys.json · test/kit/keys.ts 3
roles/*.json · src/roles/{profile,shipped,fit}.ts                                                   4
src/trust/{invite,invite-log}.ts                                                                    5
src/trust/{sections,bundle}.ts · test/kit/bundles.ts                                                6
src/trust/seal.ts                                                                                   7
src/payload/view.ts · src/trust/{verify,banner}.ts · test/fixtures/v1-report.html                   8
src/consent/{names,state,fingerprints,prepare,terminal}.ts                                          9
probes/*.json · src/payload/checks.ts · src/kit/{bank,generate}.ts                                  10
src/console/{model,csv}.ts                                                                          11
src/cli.ts · src/copy.ts · src/cli/{args,help,explain,main,deps,io,keys,invite,roles,find}.ts       12
src/cli/{outputs,run,verify}.ts · src/render/{raw,index}.ts                                         13
test/contract/plan3.test.ts (pin bump)                                                              14
src/payload/exhibits.ts                                                                             15
src/dossier/{copy,model,findings,method}.ts · test/kit/dossiers.ts                                  16
src/dossier/{render,css}.ts · src/dossier/sections/*.ts                                             17
src/console/{render,css,client}.ts · src/cli/compare.ts                                             18
test/canary.surfaces.test.ts                                                                        19
scripts/{qa-dossiers,visual-qa}.ts                                                                  20
scripts/{build,profiler-smoke}.ts · test/{integration,compile}.test.ts                              21
```

---

### Task 0: Scrub the docs, pin them with a test, and give `feat/v2` one clean commit

**Files:**
- Create: `test/docs.test.ts`
- Modify: `docs/superpowers/specs/2026-11-17-ai-leverage-suite-v2-design.md`, and any line of `docs/superpowers/plans/*.md` that the test flags

**Interfaces:**
- Produces `test/docs.test.ts`. Every later doc commit must pass it, and CI runs it from Task 1 on.

**The rules the test pins.** Code spans are inline backtick spans. Every rule skips fenced code blocks.

| # | Rule |
|---|---|
| D1 | On a line holding `[measured]` outside code spans, no digit remains outside code spans. Allowed: version tokens (`v1`, `v0.38`), phase and tier names (`P0`–`P6`), check ids (`C1`–`C10`) and section references (`§6.1`). |
| D2 | A line that names the machine (`this machine`, `this Mac`, also with `'s`) holds no figure outside code spans. A figure is: <br>• a number followed by `%` or one of `GB MB KB files IDs ids versions days sessions threads requests trajectories UUIDs accounts axes`, with an optional `+` between; or <br>• a number right after `this machine:` or `this Mac:`. <br>A number right after `≤ < ≥ >` (spaces allowed) is a budget, not a figure. |
| D3 | No `R²` outside code spans. |
| D4 | No ratio `a/b` outside code spans whose two sides each have at least 3 digits or commas. |
| D5 | In a table whose header row starts with `| Check |`, every row has exactly 2 cells. |

**Rewrites.**
- **General rule:**
  - keep the requirement and its `[measured]` citation, and drop the figure;
  - put format constants in code spans: field names, versions, and dates of format changes.
- **The offenders today, all in the spec:**
  - **Header "Inputs" line.** The brainstorm's measurements on real local traces are cited as `[measured]`, and the figures stay private.
  - **§0, the "v1 cannot be patched" bullet.** Name what v1 misses, without shares: most subagent tool calls, every Copilot chat in the `.jsonl` journal, and nearly all Codex shell commands. Replace v1's score on the owner's machine with "a heavy user's v1 report pins several axes at the cap" `[measured]`.
  - **§2, goal 8.** "a full scan of a heavy, multi-gigabyte Claude Code and Codex history in ≤ 60 s cold, peak RSS ≤ 1 GB".
  - **§4, the Shared core row.** "Claude Code ships new versions every few days" `[measured]`.
  - **§6.1, the Claude Code, Codex, Copilot and Antigravity rows.** Drop the shares and counts, and put `2026-02-23` in a code span.
  - **§6.6.**
    - Drop the "Measured baseline on genuine data" column.
    - After the table, add one sentence: every threshold sits well outside what genuine local traces showed, where server ids track time almost exactly and the cross-checks match nearly every record `[measured]`.
  - **§11, the P1 acceptance.** The file count becomes "(every subagent and workflow file on disk)".

- [ ] **Step 1: Check the precondition.**
  - The controller has committed every plan doc, including this one.
  - No other session commits to `feat/v2` until Step 7 is done. Plans 2 and 3 take doc amendments on this branch, and the squash would drop a commit that lands mid-task.
  - `git branch --show-current` prints `feat/v2`.
  - `git status --porcelain` prints nothing.
- [ ] **Step 2: Write the failing test.**
  - `test/docs.test.ts` walks `docs/**/*.md`, applies D1–D5, and fails with one `file:line rule` entry per violation.
  - It also self-tests each rule on made-up inline lines (one that passes and one that fails), so no rule can pass vacuously. The made-up figures must not be real ones: use, for example, `this machine: 12` and `3,000/4,000`.
- [ ] **Step 3: Run** `bun test test/docs.test.ts` (Bun runs it without a `package.json`) → FAIL, listing the spec lines above and no plan line.
- [ ] **Step 4: Rewrite** those lines, by the rules above.
- [ ] **Step 5: Run** `bun test test/docs.test.ts` → PASS.
- [ ] **Step 6: Commit** `docs: state formats and rules, not figures from the owner's machine`.
- [ ] **Step 7: Squash `origin/main..feat/v2` into one commit,** so that no figure survives in the history the first push publishes. Use `origin/main`, never the local `main`. The local `main` is the history from before the rewrite: it shares no merge-base with `feat/v2`, and its v1 commits carry another author email (pre-flight G1).
```bash
git fetch origin                                     # sandbox off (pre-flight G1)
git merge-base --is-ancestor origin/main feat/v2     # exit 0, else stop and report BLOCKED (pre-flight G1)
git branch backup/feat-v2-pre-scrub          # local only — never pushed; deleted after the PR merges (Task 21)
git reset --soft origin/main                 # (pre-flight G1)
git commit -m "docs: AI Leverage Suite v2 spec and plans

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git rev-list --count origin/main..feat/v2    # 1 (pre-flight G1)
git diff backup/feat-v2-pre-scrub feat/v2    # empty: the same tree
bun test test/docs.test.ts                   # PASS on the only commit
```
  Never run `git push --all`, which would publish the backup branch. Never push the local `main` (pre-flight G1).

---

### Task 1: Scaffold v2 on the pinned core — contract, test-kit bridge, CI, first push

**Files:**
- Create:
  - `package.json`, `tsconfig.json` and `bun.lock` (generated);
  - `src/version.ts` and `src/payload/catalog.ts`;
  - `test/kit/core.ts`, `test/pin.test.ts` and `test/contract/plan2.test.ts`;
  - `.github/workflows/ci.yml` and `.github/workflows/security-guard.yml`.
- Modify: `.gitignore`. Add `*.aiprof`, `*.dossier.html`, `ai-profiler-console-*.html` and `qa-out/`, and keep the v1 lines.
- Delete: `src/main.ts`, `src/scan.ts`, `src/scoring.ts`, `src/template.html` and `build.sh`. These are v1; Plan 6 brings the release build back.

**Interfaces:**
- **Consumes** B on `main` after Plan 2's merge, exactly as the plans' Interfaces blocks state:
  - **Plan 1:**
    - `scan` and `ScanOptions` (`env`, `tools`, `salt`, `handleSignals`, `onProgress`);
    - `ScanResult` (`store`, `coverage`, `cwds`, `salt`, `finishedAt`, `tempClean`);
    - `registry` (`describe.reads` and `describe.neverReads`);
    - `EventStore` (`all`, `forSession`), `VERSION`, and the event and id types.
  - **Plan 2:**
    - Task 2: `ScanOptions.repoSignals` and `ScanResult.repos`;
    - Task 16: `REPO_SIGNALS_DESCRIBE`;
    - Task 13: `analyze`, `AnalyzeOptions` (`exclude`, `timeZone`) and `Analysis`;
    - Task 14: `exportPayload`, `ExportOptions` (`reveal`), `ExportResult` and `canonicalJson`;
    - Tasks 7, 11 and 12: `DimensionId`, `Confidence`, `Band`, `CheckId`, `CheckStatus` and `Forensics`.
  - **Test kits:**
    - `fakeHome` and `FakeHome`;
    - `CANARY`, `findCanaries`, `expectNoCanaries` and `CanaryKey`;
    - the Plan 1 builders: `buildCcTranscripts`, `buildCcLifetime`, `buildCodexRollouts`, `buildCodexIndex`, `buildCopilot`, `buildCursor`, `buildAgentCli` and `buildAntigravity`;
    - the Claude Code fixture helpers `CcTranscript`, `ccSid`, `slug` and `fixtureStart` from `test/fixtures/claude-code.ts`, for an extra transcript inside a repo (pre-flight G13);
    - `personaScan` (Plan 2 Task 9), `scanResultOf` (Task 4), `makeRepo` (Task 2) and `synthStore` (Task 15).
- **Produces:**
```ts
// src/version.ts
export const VERSION: string;                                   // package.json "version": "2.0.0-dev"
export const CORE_PIN: { repo: string; sha: string; ref: string };   // package.json "corePin"
export const CORE_VERSION: string;                              // B's VERSION
// src/payload/catalog.ts
export const DIMENSIONS: readonly DimensionId[];                // leverage, orchestration, steering, verification, delivery, context, judgment
export const DIMENSION_LABEL: Readonly<Record<DimensionId, string>>;   // Leverage, Orchestration, Steering, Verification, Delivery, Context, Judgment
export const DIMENSION_WEIGHTS: Readonly<Record<DimensionId, number>>; // §6.5: verification 0.20; leverage, orchestration, steering, context 0.15; judgment, delivery 0.10
export const LEDGER_GROUPS: ReadonlyArray<{ label: string; dims: readonly DimensionId[] }>;
  // WORKING WITH AGENTS: leverage, orchestration, steering · QUALITY: verification, delivery · SETUP & JUDGMENT: context, judgment
export type ValueUnit = "share" | "rate" | "count" | "rho" | "tokens" | "log2" | "of3" | "of5";
export type ExhibitLetter = "a" | "b" | "c" | "d" | "e" | "f";
export interface ComponentInfo { id: string; dimension: DimensionId; signal: string; unit: ValueUnit; cite: ExhibitLetter }
export const COMPONENTS: readonly ComponentInfo[];              // the table below, in order
export function componentInfo(id: string): ComponentInfo | undefined;
// test/kit/core.ts — the only bridge into B's installed test kits
export { fakeHome, type FakeHome, CANARY, findCanaries, expectNoCanaries, type CanaryKey, personaScan, scanResultOf, synthStore, makeRepo /* + the 8 builders */,
  CcTranscript, ccSid, slug, fixtureStart /* pre-flight G13 */ };
export function allBuilders(h: FakeHome): void;                 // runs the 8 Plan 1 builders
```

**`COMPONENTS`** (id · signal · unit · cite). These copy Plan 3 Task 9's `id · unit · cites`. The signal is the `Signals` metric that holds the component's raw value; the export carries `signals`, but not `raw`.

| id | signal | unit | cite | id | signal | unit | cite |
|---|---|---|---|---|---|---|---|
| lev.sticky | stickyMean | log2 | a | ctx.instructions | maintainedShare | share | f |
| lev.run | p90Run | count | a | ctx.artifacts | artifacts | count | f |
| orc.parallel | parallelShare | share | a | ctx.hygiene | hygiene | share | a |
| orc.fanout | fanoutPerEpisode | rate | b | ctx.briefs | briefScore | of5 | e |
| orc.headless | headlessPerWeek | rate | a | jud.switches | switchesPerWeek | rate | f |
| orc.background | backgroundShare | share | b | jud.rho | rho | rho | f |
| ver.vae | vae | share | c | jud.cost | tokensPerLanded | tokens | f |
| ver.closure | closure | share | c | del.landed | landedShare | share | c |
| ver.guardrails | guardrails | of3 | c | del.rework | reworkShare | share | c |
| ste.correction | correctionRate | share | e | del.prs | prsPerWeek | rate | c |
| ste.interrupts | healthyInterruptShare | share | a | | | | |
| ste.turnsPerWork | turnsPerWork | rate | a | | | | |

- [ ] **Step 1: Pin and install.**
  1. Confirm that Plan 2's PR is merged: `gh pr list --repo build-with-bala/ai-practice-report --state merged`.
  2. Read the SHA: `git ls-remote https://github.com/build-with-bala/ai-practice-report refs/heads/main`.
  3. Write `package.json`:
     - `name: "ai-candidate-profiler"`, `version: "2.0.0-dev"`, `private: true`, `type: "module"`;
     - `dependencies`: the GitHub SHA;
     - `corePin: { repo, sha, ref: "main (Plan 2 merged)" }`;
     - `scripts: { test: "bun test", typecheck: "tsc --noEmit", profiler: "bun src/cli.ts" }`;
     - B's two devDependencies.
  4. Write `tsconfig.json` with B's compiler options and `include: ["src", "test", "scripts"]`.
  5. Run `bun install`, with the network.
- [ ] **Step 2: Read B as installed.**
  - Read `node_modules/ai-practice-report/core/index.ts`, `core/analyze.ts`, `core/privacy/{export,schema,jcs}.ts`, `test/kit/{home,canary}.ts` and `test/fixtures/personas.ts`.
  - Confirm that every consumed name exists with the type its plan states. If any differs, stop and report BLOCKED with the difference.
- [ ] **Step 3: Write the failing tests.**
  - **`pin.test.ts`:**
    - the dependency matches `^github:build-with-bala/ai-practice-report#[0-9a-f]{40}$`, and its SHA equals `corePin.sha`;
    - `bun.lock` contains that SHA's first 7 hex characters;
    - no dependency uses `file:`, `link:` or a branch name;
    - `CORE_PIN` deep-equals `corePin`.
  - **`contract/plan2.test.ts`.** Compile-time pins use typed assignments. At run time, with `raw = personaScan("intermediate")` and `a = analyze(raw, { timeZone: "UTC" })`, it asserts:
    - The dimension ids equal `DIMENSIONS` as a set. The component ids equal `COMPONENTS` as a set, each under its `dimension`.
    - Every `ok` component has `c.raw === a.signals[componentInfo(c.id).signal].value`. This pins the signal map.
    - For `e = exportPayload(a, { schema: "aiprof/2" })`:
      - `JSON.parse(e.json)` deep-equals `e.value`;
      - the top-level keys are exactly Plan 2 Task 14's: `schema`, `core`, `reference`, `coverage`, `overall`, `dimensions`, `personas`, `signals`, `exposure`, `stack`, `risk`, `config`, `projects`, `forensics`, `identity` and `exclusions`, plus `otherProjects` if Plan 2 put it at top level. Any other difference is BLOCKED;
      - each exported component has exactly the keys `id`, `status`, `x`, `z`, `n` and `weight`;
      - each signal in `COMPONENTS` exports `value`, `n` and `window`;
      - `forensics` has `band`, `serverBacked`, `anchorable`, `notAnchorable` and `checks`.
    - A reveal of `{ label: a.projects[0].label, name: "my-lib" }` names that project only.
    - `a.projects[0].key` is a key of `raw.cwds`.
    - Excluding `a.projects[0].label` gives `exclusions.projects === 1`.
    - `REPO_SIGNALS_DESCRIBE.reads.length > 0`, and every plugin has `describe.reads`.
    - On a `fakeHome` with `allBuilders`, `scan({ env: h.env, repoSignals: false })` gives `repos.status === "off"` and `tempClean`.
    - If B exports `WEIGHTS`, it equals `DIMENSION_WEIGHTS`. Task 14 pins this unconditionally through the bridge (pre-flight G16).
    - If B exports `isAction`, F7 uses it rather than restating walk rule 2. Record which, in the task report.
- [ ] **Step 4: Run** `bun test test/pin.test.ts test/contract` → FAIL until `src/version.ts` and the catalog exist. Then **implement** them and `test/kit/core.ts`, and run `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Add CI.**
  - `ci.yml` is B's `ci.yml`: the same matrix, the same action SHAs and Bun `1.3.11`.
  - `security-guard.yml` is B's, verbatim. It triggers only on pushes and PRs to `main`, so it first gates Task 21's PR (pre-flight G4).
- [ ] **Step 6: Commit and push.**
```bash
git add -A && git commit -m "build: v2 scaffold on the pinned ai-practice-report core; CI and security guard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
# EtherHiding config scan (workspace CLAUDE.md) → nothing printed
git fetch origin && git merge-base --is-ancestor origin/main feat/v2   # sandbox off; exit 0, else BLOCKED (pre-flight G1)
git push -u origin feat/v2        # sandbox off
gh run watch                      # CI green on ubuntu, macos and windows; the guard first runs on Task 21's PR (pre-flight G4)
```

---

### Task 2: Trust primitives — strict base64url, RFC 8785 JCS, raw keys, fingerprints

**Files:**
- Create: `src/trust/{errors,bytes,jcs,keys}.ts`, `test/trust/{bytes,jcs,keys}.test.ts`

**Interfaces:**
- **Consumes:** `node:crypto`; B's `canonicalJson`, `analyze`, `exportPayload` and `personaScan`, for the cross-check only.
```ts
// errors.ts
export type TrustCode = "bad-base64" | "bad-format" | "not-json" | "not-canonical" | "too-large" | "bad-key" | "bad-signature" | "unknown-key"
  | "revoked-key" | "bad-invite" | "invite-other-company" | "invite-mismatch" | "outside-invite-window" | "fields-exceed-request"
  | "no-company-key" | "sealed-other-key" | "seal-failed" | "payload-malformed" | "timestamp-unsupported";
export class TrustError extends Error { readonly code: TrustCode; constructor(code: TrustCode, message: string) }
// bytes.ts
export function b64u(bytes: Uint8Array): string;
export function unb64u(s: string, o?: { bytes?: number }): Uint8Array;   // F1; `bytes` = required length
export function utf8(s: string): Uint8Array;
export function fromUtf8(b: Uint8Array): string;                       // fatal; TrustError("not-json") on invalid UTF-8
export function equalBytes(a: Uint8Array, b: Uint8Array): boolean;
// jcs.ts
export function jcs(value: unknown): string;                           // F2
export function jcsBytes(value: unknown): Uint8Array;
export function parseCanonical(bytes: Uint8Array, o?: { maxBytes?: number }): unknown;
// keys.ts
export type Rand = (n: number) => Uint8Array;
export const defaultRand: Rand;                                        // crypto.randomBytes
export interface EdKey { seed: Uint8Array; pub: Uint8Array }
export interface XKey { priv: Uint8Array; pub: Uint8Array }
export function edFromSeed(seed: Uint8Array): EdKey;
export function xFromPriv(priv: Uint8Array): XKey;
export function newEdKey(rand?: Rand): EdKey;                          // rand(32) is the seed
export function newXKey(rand?: Rand): XKey;                            // rand(32) is the private key
export function edSign(seed: Uint8Array, msg: Uint8Array): Uint8Array;
export function edVerify(pub: Uint8Array, msg: Uint8Array, sig: Uint8Array): boolean;   // false, never a throw, on malformed input
export function x25519(priv: Uint8Array, pub: Uint8Array): Uint8Array; // TrustError("bad-key") on an all-zero result
export function sha256(b: Uint8Array | string): Uint8Array;
export function sha256Hex(b: Uint8Array | string): string;
export function hmac256(key: Uint8Array, msg: Uint8Array | string): Uint8Array;
export function fingerprint(pub: Uint8Array): string;                  // F3
export function displayFingerprint(fp: string): string;
```

- [ ] **Step 1: Write the failing tests.**
  - **`bytes`:**
    - round-trips at lengths 0–70;
    - `unb64u` rejects `=` padding, `+`, `/`, a space, length ≡ 1 (mod 4), and the V7 signature with a last character differing only in its unused bits (a 64-byte signature has 4) (pre-flight G19);
    - `unb64u(s, { bytes: 32 })` rejects 31 and 33 bytes;
    - `fromUtf8` of `c3 28` throws.
  - **`jcs`:**
    - every Appendix B row: build the double from its bits with `DataView`;
    - the §3.2.2 example, as a string;
    - the §3.2.3 example, as hex;
    - the throws: NaN, a lone surrogate, `[undefined]`, `new Date()`, `new Map()`, `1n`, a class instance;
    - `{ a: undefined, b: 1 }` → `{"b":1}`.
  - **`parseCanonical`** rejects each of these with `not-canonical`: a BOM, the canonical bytes plus `\n`, re-indented JSON, `{"a":1,"a":1}`, `1.0`, `"\u0041"` (a needless escape: JCS writes `"A"`), `1e309`, and 100,000 nested arrays inside an object, with no throw (pre-flight G3). It rejects 8 MiB + 1 byte with `too-large`.
  - **`keys`:**
    - V1–V5;
    - `edVerify` is false on a wrong-length signature;
    - `x25519(VEC.alice.priv, 32 zero bytes)` throws `bad-key`;
    - `newEdKey(r)` with a fixed `r` is deterministic.
  - **Cross-check** (pre-flight G6): B's `canonicalJson` agrees with `jcs` on every Appendix B row, both throws included, on §3.2.2 and §3.2.3, and on `exportPayload(analyze(personaScan("expert")), { schema: "aiprof/2" }).value`.
- [ ] **Step 2: Run** `bun test test/trust` → FAIL.
- [ ] **Step 3: Implement.** Import keys through the F3 DER prefixes, with `createPrivateKey` and `createPublicKey` (`format: "der"`). Use `sign(null, …)`, `verify(null, …)`, `diffieHellman` and `hkdfSync`.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(trust): strict base64url, RFC 8785 JCS, raw Ed25519/X25519 keys and fingerprints, with RFC vectors`.

---

### Task 3: Keys and trust anchors — company keystore, release keys, signer, no committed private keys

**Files:**
- Create:
  - `src/home.ts` and `src/trust/{company,release,signer}.ts`;
  - `src/trust/release-keys.json`, holding exactly `{"v":1,"keys":[]}`;
  - `test/kit/keys.ts`;
  - `test/trust/{company,release,signer}.test.ts` and `test/repo/no-private-keys.test.ts`.

**Interfaces:**
- **Consumes:** Task 2's keys and bytes helpers.
```ts
// src/home.ts
export interface Sys { home: string; vars: Readonly<Record<string, string | undefined>>; platform: "darwin" | "linux" | "win32" }
export interface ProfilerHome { dir: string; company: string; invites: string; roles: string }   // $AIPROF_HOME or <home>/.ai-profiler; company.json, invites.jsonl, roles/
export function profilerHome(s: Sys): ProfilerHome;
export function ensurePrivateDir(dir: string): void;                   // mkdir -p, 0700 on POSIX
export function writePrivate(path: string, data: string | Uint8Array): void;   // 0600; never creates folders
// src/trust/company.ts
export interface CompanyFile { v: 1; name: string; createdAt: string; ed25519: { kid: string; pub: string; seed: string }; x25519: { kid: string; pub: string; priv: string } }
export interface Company { name: string; ed: EdKey & { kid: string }; x: XKey & { kid: string } }
export function initCompany(h: ProfilerHome, o: { name: string; now: number; force?: boolean; rand?: Rand }): Company;   // Error("exists") without force
export function loadCompany(h: ProfilerHome, s: Sys): { company: Company; warnings: string[] } | null;   // null when absent; Error when inconsistent
// src/trust/release.ts
export interface ReleaseKeysFile { v: 1; keys: Array<{ keyId: string; alg: "Ed25519"; pub: string; fingerprint: string; revoked: null | { at: string; reason: string } }> }
export interface TrustedKey { keyId: string; pub: Uint8Array; fingerprint: string; source: "shipped" | "env"; revoked: null | { at: string; reason: string } }
export function loadTrust(vars: Sys["vars"], o?: { shipped?: ReleaseKeysFile }): { keys: Map<string, TrustedKey>; error: string | null };
// src/trust/signer.ts
export interface Signer { keyId: string; build: "release" | "dev"; pub: Uint8Array; sign(msg: Uint8Array): Uint8Array }
export function resolveSigner(o?: { embedded?: string; rand?: Rand }): Signer;
export function signerFromSeed(keyId: string, seed: Uint8Array): Signer;   // build "release"
// test/kit/keys.ts
export const VEC: { t1: EdKey; t2: EdKey; alice: XKey; bob: XKey };
export const TEST_KEY_ID = "test-39f713d0";
export function testSigner(): Signer;                                  // signerFromSeed(TEST_KEY_ID, VEC.t2.seed)
export function testTrust(): Map<string, TrustedKey>;                  // that key, source "env"
export function testCompany(name?: string): Company;                   // ed = VEC.t1, x = VEC.bob
export function testSys(root: string, vars?: Record<string, string>): Sys;   // home = <root>/home, AIPROF_HOME = <root>/aiprof
```

**Rules.**
- **`company.json`.**
  - `name`: 1–80 chars without control chars.
  - `createdAt`: ISO.
  - Keys: b64u, with `kid = fingerprint(pub)`.
  - `loadCompany` re-derives both public keys and the kids. A mismatch is an Error: "company.json is inconsistent".
  - On POSIX, `mode & 0o077` adds the warning "company.json can be read by other users; run chmod 600 <path>".
- **`AIPROF_RELEASE_PUBKEYS`** is a JSON array of `{ keyId, alg: "Ed25519", pub }`.
  - Each `keyId` follows the release pattern (F3) and is not a shipped key id.
  - Each `pub` is 32 bytes.
  - Any other shape sets `error`, and callers exit 2 with it.
- **The signer.** `resolveSigner()` takes `embedded` from the compile-time define. This code is pinned:
```ts
declare const AIPROF_RELEASE_SIGNING_KEY: string | undefined;
const EMBEDDED = typeof AIPROF_RELEASE_SIGNING_KEY === "string" ? AIPROF_RELEASE_SIGNING_KEY : undefined;
```
  - **Present:** the format is `"<keyId>:<b64u 32-byte seed>"`. It gives a `release` signer. A malformed value throws `TrustError("bad-key")`, and the candidate run exits 1.
  - **Absent:** a `dev` signer, with a fresh `newEdKey(rand)` and keyId `dev-<fingerprint(pub)[0..8]>`.

- [ ] **Step 1: Write the failing tests.**
  - **`company`:**
    - init writes 0600 in a 0700 folder (POSIX only);
    - a second init → `exists`, and the file is unchanged;
    - `force` replaces it;
    - `loadCompany` round-trips the keys;
    - an edited `pub` → "inconsistent";
    - mode 0644 → the warning (Review Focus 3);
    - a name of 81 chars, or one holding `\n`, is rejected.
  - **`release`:**
    - the shipped list is empty;
    - a valid env entry gives `source: "env"`;
    - errors for malformed JSON, a 31-byte `pub`, a `dev-` id, and a shipped id;
    - an injected shipped entry with `revoked` set loads that revocation.
  - **`signer`:**
    - an embedded `test-39f713d0:<b64u(VEC.t2.seed)>` → `release`, with `pub = VEC.t2.pub`;
    - its `sign` verifies with `edVerify`;
    - `"x"` → `bad-key`;
    - absent → `dev`, with an id matching `^dev-[0-9a-f]{8}$`;
    - two calls give two keys;
    - a fixed `rand` gives a fixed key.
  - **`no-private-keys`,** over `git ls-files` (text files only):
    - no `-----BEGIN … PRIVATE KEY-----`;
    - no `302e020100300506032b65(70|6e)04220420` followed by 64 hex characters;
    - no `MC4CAQAwBQYDK2V[wu]BCIEI` followed by at least 40 base64 characters;
    - no JSON object holding both `"kty":"OKP"` and `"d"`;
    - every `release-keys.json` entry has exactly the keys `keyId`, `alg`, `pub`, `fingerprint` and `revoked`, its `fingerprint` matches its `pub`, and its `pub` is none of the `VEC` public keys.
- [ ] **Step 2: Run** `bun test test/trust test/repo` → FAIL.
- [ ] **Step 3: Implement** the modules and the test kit.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(trust): company keystore, release trust anchors, compile-time signer with a one-time dev key; no committed private keys`.

---

### Task 4: Role profiles and role fit

**Files:**
- Create: `roles/{backend,frontend,full-stack,platform-infra,ai-engineer,tech-lead}.json`, `src/roles/{profile,shipped,fit}.ts`, `test/roles/{profile,fit}.test.ts`

**Interfaces:**
- **Consumes:** Task 1's `DIMENSIONS`; Task 2's `jcsBytes` and `sha256Hex`; Task 3's `ProfilerHome` and `writePrivate`.
```ts
// profile.ts
export type TargetBand = "exceptional" | "strong" | "developing";
export const BAND_THRESHOLD: Readonly<Record<TargetBand, number>>;   // 80, 60, 35 — Plan 2 builder's call 6
export interface MustHave { dimension: DimensionId; targetBand: TargetBand; weight: number; why: string }
export interface RoleProfile { id: string; title: string; version: number; mustHaves: MustHave[]; niceToHaves: Array<{ dimension: DimensionId; why: string }>; probeBank: string[] }
export function parseRoleProfile(v: unknown): RoleProfile;           // Error naming the field
export function roleHash(p: RoleProfile): string;                    // F8
export interface LoadedRole { profile: RoleProfile; hash: string; source: "shipped" | "local"; path: string | null }
export function loadRoles(h: ProfilerHome): { roles: Map<string, LoadedRole>; errors: string[] };
export function exportRole(h: ProfilerHome, id: string): string;     // writes $AIPROF_HOME/roles/<id>.json (0600); Error("exists")
// shipped.ts
export const SHIPPED_ROLES: readonly RoleProfile[];                  // the six files, JSON-imported, parsed at load
// fit.ts
export type Fit = "meets" | "partial" | "below" | "insufficient";
export interface DimLike { id: DimensionId; status: string; score: number | null; interval: readonly [number, number] | null }
export function fitOf(d: DimLike, target: number): Fit;
export interface RoleFit { role: string; title: string; hashMatches: boolean | null;
  items: Array<MustHave & { target: number; fit: Fit; score: number | null; interval: readonly [number, number] | null }> }
export function roleFit(dims: readonly DimLike[], r: LoadedRole, inviteRoleHash: string | null): RoleFit;
```

**Rules.**
- **Validation:**
  - `id` follows the F4 role pattern; `title` is 1–60 chars; `version` is an integer of at least 1.
  - There are 1–5 must-haves, with distinct dimensions and weights in (0, 1] that sum to 1 within 0.001.
  - There are at most 4 nice-to-haves, each on a distinct dimension that is not a must-have.
  - `why` is 1–120 chars.
  - `probeBank` holds at most 10 ids, each matching `^[a-z]+\.[a-z0-9-]+$`.
  - No other key is allowed.
- **Fit:**
  1. A dimension that is not scored → `insufficient`.
  2. Otherwise take `[lo, hi]` = its interval, or `[score, score]` when it has none.
  3. `lo ≥ T` → `meets`; `hi < T` → `below`; anything else → `partial`.

  There is no total.
- **Loading:** the shipped profiles first. Then each `*.json` in `$AIPROF_HOME/roles/` overrides the profile with the same id, or adds a new one. A malformed file goes into `errors` and is ignored. `roles`, `verify` and `compare` print each entry of `errors` as a `note:` line on stderr (pre-flight G25).
- **`hashMatches`:** `null` without an invite role hash; otherwise whether the invite's hash equals the loaded profile's.

**Shipped profiles.** Every must-have has weight and target as listed, and each `why` is its dimension's sentence below.

| id | title | must-haves (dimension · target · weight) | nice-to-haves | probeBank |
|---|---|---|---|---|
| backend | Backend engineer | verification · strong · 0.40; delivery · strong · 0.35; steering · developing · 0.25 | context, judgment | — |
| frontend | Frontend engineer | verification · strong · 0.35; steering · strong · 0.35; delivery · developing · 0.30 | leverage, context | — |
| full-stack | Full-stack engineer | verification · strong · 0.35; delivery · strong · 0.35; leverage · developing · 0.30 | orchestration, context | — |
| platform-infra | Platform / infrastructure engineer | verification · strong · 0.40; context · strong · 0.35; judgment · developing · 0.25 | delivery, orchestration | `verification.platform` |
| ai-engineer | AI engineer | orchestration · strong · 0.35; context · strong · 0.35; judgment · developing · 0.30 | leverage, verification | — |
| tech-lead | Tech lead | steering · strong · 0.35; verification · strong · 0.35; orchestration · developing · 0.30 | context, delivery | `orchestration.lead` |

**The `why` sentences, by dimension:**
- leverage: "Long runs of useful agent work are where agents save the most time."
- orchestration: "Several agents kept apart multiply output instead of colliding."
- steering: "Catching a wrong turn early saves the whole run."
- verification: "Agent changes need a passing check before anyone relies on them."
- delivery: "Agent work only counts once it lands as reviewed commits."
- context: "Agents need the codebase's rules and commands before they start."
- judgment: "The right model and effort for the task protect both cost and quality."

- [ ] **Step 1: Write the failing tests.**
  - **Shipped profiles:**
    - all six parse;
    - their ids are the six above;
    - every weight sum is 1.
  - **`roleHash`:**
    - stable when the keys are reordered;
    - changes when a weight changes.
  - **`parseRoleProfile`** rejects, one case each:
    - a duplicate dimension;
    - weights summing to 0.9;
    - 6 must-haves;
    - a nice-to-have that is also a must-have;
    - an unknown key;
    - a 121-char `why`;
    - a bad probe id.
  - **`fitOf`,** against target 60:
    - `[63, 80]` → meets;
    - `[55, 80]` → partial;
    - `[40, 58]` → below;
    - score 65 with no interval → meets;
    - `insufficient` → insufficient.
  - **Loading:**
    - a local `backend.json` replaces the shipped one, with `source: "local"`;
    - a malformed local file is listed in `errors`, and the shipped profile is kept;
    - `exportRole` writes 0600 and refuses a second time;
    - `hashMatches` is true, false or null.
- [ ] **Step 2: Run** `bun test test/roles` → FAIL.
- [ ] **Step 3: Implement** the JSON files and the modules.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(roles): six shipped role profiles, content hash, local overrides, per-must-have fit`.

---

### Task 5: Invite tokens and the invite log

**Files:**
- Create: `src/trust/{invite,invite-log}.ts`, `test/trust/invite.test.ts`

**Interfaces:**
- **Consumes:** Task 2's helpers; Task 3's `Company`, `ProfilerHome` and `writePrivate`.
```ts
export const INVITE_PREFIX = "aiprof-inv1";
export const OPTIONAL_FIELDS = ["config", "exhibits", "exposure", "fingerprints", "identity", "personas", "projects", "risk", "signals", "stack"] as const;
export type InviteField = (typeof OPTIONAL_FIELDS)[number];
export const CLOCK_SKEW_S = 300; export const MAX_INVITE_S = 90 * 86400; export const DEFAULT_INVITE_S = 14 * 86400;
export interface InviteClaims { v: 1; id: string; company: { name: string; pub: string }; role: string; roleHash: string; nonce: string;
  iat: number; exp: number; fields: InviteField[]; sealTo: string | null }
export interface Invite { token: string; claims: InviteClaims; companyPub: Uint8Array; companyFp: string; nonce: Uint8Array; sealTo: Uint8Array | null; displayId: string }
export function mintInvite(c: Company, o: { role: string; roleHash: string; now: number; expiresS: number; fields?: readonly InviteField[]; seal: boolean; rand?: Rand }): Invite;
export function parseInvite(token: string): Invite;                    // F4; TrustError("bad-invite", reason)
export function inviteStatus(i: Invite, nowMs: number): "valid" | "expired" | "not-yet-valid";
export function parseExpires(s: string): number;                       // "14d" | "36h" → seconds; from 1 h to 90 d; Error otherwise
export function parseFields(s: string): InviteField[];                 // comma list → sorted, unique; Error on an unknown field
// invite-log.ts
export interface InviteLogEntry { id: string; name: string | null; role: string; roleHash: string; iat: number; exp: number; sealed: boolean; fields: InviteField[] }
export function appendInviteLog(h: ProfilerHome, e: InviteLogEntry): void;       // JSON Lines, 0600
export function readInviteLog(h: ProfilerHome): Map<string, InviteLogEntry>;     // malformed lines skipped
```

- [ ] **Step 1: Write the failing tests.**
  - **V6:**
    - the token's SHA-256 and signature;
    - `parseInvite(V6)` gives the claims deep-equal, `displayId` `A1B2` and `companyFp` `21fe31dfa154a261`.
  - **Tamper:**
    - every one-character substitution in V6 (to another base64url character) → `bad-invite`.
    - These cases → `bad-invite`, one each:
      - an extra `.` part;
      - a missing part;
      - prefix `aiprof-inv2`;
      - `=` padding;
      - the claims re-encoded with spaces (not canonical);
      - an extra claim key;
      - `exp − iat` of 91 days;
      - unsorted `fields`;
      - a 31-byte `sealTo`;
      - 4097 chars.
  - **Status** (Review Focus 1):
    - `exp` exactly → valid;
    - `exp + 1 s` → expired;
    - `iat − 300 s` → valid;
    - `iat − 301 s` → not-yet-valid.
  - **`parseExpires`:** `14d` → 1209600 and `36h` → 129600; `0d`, `91d`, `2w` and `""` are errors.
  - **`parseFields`:** `stack,signals,stack` → `["signals","stack"]`; `x` is an error.
  - **Log:**
    - two appends read back as two entries;
    - a garbage line is skipped;
    - the file is 0600 (POSIX).
- [ ] **Step 2: Run** `bun test test/trust/invite.test.ts` → FAIL.
- [ ] **Step 3: Implement.** `mintInvite` draws `rand(12)`, then `rand(16)`, and uses the defaults `fields = OPTIONAL_FIELDS` and `iat = floor(now / 1000)`.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(trust): signed invite tokens with expiry and requested fields; local invite log`.

---

### Task 6: Bundles — assemble, sections, sign, canonical file bytes; the tamper suite

**Files:**
- Create: `src/trust/{sections,bundle}.ts`, `test/trust/bundle.test.ts`, `test/kit/bundles.ts`

**Interfaces:**
- **Consumes:** B's `ExportResult` (Plan 2 Task 14); Task 3's `Signer` and `testSigner`; Task 5's `Invite`, `InviteField` and `OPTIONAL_FIELDS`; `src/version.ts`.
```ts
// sections.ts
export const REQUIRED_KEYS: readonly string[];                         // builder's call 4
export const SECTION_KEYS: Readonly<Record<Exclude<InviteField, "exhibits" | "fingerprints">, readonly string[]>>;
  // one key each, except projects → ["projects", "otherProjects"] when Task 1 found otherProjects at top level
export function filterPayload(value: Readonly<Record<string, unknown>>, fields: readonly InviteField[]): Record<string, unknown>;
  // REQUIRED_KEYS ∪ the requested sections; never forensics, nothing undeclared
// bundle.ts
export const FORMAT = "aiprof/2"; export const BUNDLE_READ_MAX = 8 * 1024 * 1024; export const BUNDLE_BUDGET = 400_000;
export interface BundleMeta { profiler: string; core: string; coreSha: string; createdAt: string; keyId: string; build: "release" | "dev"; devKey?: string }
export interface Fingerprint { fp: string; day: string; tool: ToolId; size: "S" | "M" | "L" | "XL" }
export interface ExclusionCounts { tools: number; projects: number; sessions: number }
export interface UnsignedBundle { format: "aiprof/2"; meta: BundleMeta; invite: string | null; subject: { name: string | null };
  payload: Record<string, unknown>; exhibits: Record<string, unknown> | null; integrity: Record<string, unknown>;
  fingerprints: Fingerprint[]; exclusions: ExclusionCounts; timestamp: null; sealed: null }
export interface SignedBundle extends UnsignedBundle { signature: { alg: "Ed25519"; keyId: string; sig: string } }
export interface AssembleInput { exported: ExportResult; invite: Invite | null; name: string | null; exhibits: Record<string, unknown> | null;
  fingerprints: Fingerprint[]; exclusions: ExclusionCounts; signer: Pick<Signer, "keyId" | "build" | "pub">; createdAt: number }
export function assemble(i: AssembleInput): UnsignedBundle;            // F5; meta.profiler/core/coreSha from src/version.ts
export function signingInput(b: UnsignedBundle | SignedBundle): Uint8Array;
export function signBundle(b: UnsignedBundle, s: Signer): SignedBundle;   // Error when b.meta.keyId !== s.keyId
export function bundleBytes(b: SignedBundle): Uint8Array;
export function readSigned(bytes: Uint8Array): SignedBundle;           // parseCanonical, then F5's shape
export function checkSignature(b: SignedBundle, pub: Uint8Array): boolean;
export function payloadHash(b: UnsignedBundle | SignedBundle): string; // F8
export function dossierNo(b: UnsignedBundle | SignedBundle): string;   // F8
// test/kit/bundles.ts
export function vectorBundle(): SignedBundle;                          // V7
export function personaBundle(kind: "novice" | "intermediate" | "expert", o?: { invite?: Invite | null; name?: string; signer?: Signer }): { bundle: SignedBundle; bytes: Uint8Array };
```

**Rules.**
- **`assemble`:**
  - Lifts `exported.value.forensics` into `integrity`.
  - Filters the payload by the invite's `fields`, or by all of them when unbound.
  - Sets `exhibits` to `null` unless the invite requests them or the run is unbound, and `fingerprints` to `[]` unless the invite requests them. An unbound run therefore ships `exhibits`, but its `fingerprints` are always `[]`, since it has no nonce (pre-flight G9).
  - `createdAt` is ISO to the second, in UTC.
  - Sets `devKey` exactly for a dev signer.
- **`readSigned`'s shape check:**
  - the exact top-level keys;
  - `format`;
  - the exact `meta` keys;
  - `alg` is `Ed25519`;
  - `meta.keyId === signature.keyId`;
  - `timestamp === null`, else `timestamp-unsupported`;
  - `sealed === null`;
  - at most 8 fingerprints, each matching F7;
  - exclusion counts are non-negative integers;
  - `subject.name` is null or 1–80 chars.

  Any other failure is `bad-format`. The payload's contents are left to Task 8.

- [ ] **Step 1: Write the failing tests.**
  - **V7:** the signing input's length and SHA-256, the signature, the file's length and SHA-256, and `dossierNo`. They are (pre-flight G2):
    - signing input: 1204 bytes, with no `timestamp` key, SHA-256 `9282a29039f7641355b7dd3d08bb19095f0ba7d7e6f3764b77bd6d97efaac575`;
    - sig: `xboFqdBnign8mQMslWGpHAzzOZ3kdrv-CP5h2crNAb1Il0wYVBlfnUkt3LKvESQAd-dAVMy3rPrcGOcK_sgEDg`;
    - file: 1370 bytes, SHA-256 `a68461f60fddb4a8dbcdc9ca7c3265241c6320e2f3c1586c1d3bf02a7cdfb414`;
    - `dossierNo`: `9282-A290`.
  - **`assemble`** on the expert persona's export:
    - the payload has no `forensics`, and `integrity` deep-equals it;
    - with an invite requesting `["fingerprints"]`, the payload keys equal `REQUIRED_KEYS` and `exhibits` is null;
    - an unbound bundle has every section;
    - every key of the export is in `REQUIRED_KEYS` ∪ the `SECTION_KEYS` values ∪ `{forensics}`;
    - a dev signer sets `devKey`, and a release signer does not.
  - **Tamper suite** (§10):
    - XOR every byte of the V7 file with `0x01`: each result makes `readSigned` throw or `checkSignature` return false;
    - for the expert persona bundle, do the same at 500 seeded positions × the masks `0x01`, `0x20` and `0x80`;
    - the strict base64url case from Task 2's tests, applied to `signature.sig`.
  - **Re-saves** → `not-canonical`: 2-space indent, a trailing `\n`, a BOM, CRLF.
  - **Size:**
    - 8 MiB + 1 byte → `too-large`;
    - the expert persona bundle is at most `BUNDLE_BUDGET`.
- [ ] **Step 2: Run** `bun test test/trust/bundle.test.ts` → FAIL.
- [ ] **Step 3: Implement** the modules and the kit. `personaBundle` uses `fingerprints: []` until Task 9, and `testSigner()` by default.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(trust): aiprof/2 bundles — sections, signing input, canonical file bytes, byte-flip tamper suite`.

---

### Task 7: Sealing to the company key

**Files:**
- Create: `src/trust/seal.ts`, `test/trust/seal.test.ts`
- Modify: `test/kit/bundles.ts`, adding `sealedPersonaBundle(kind, o)`

**Interfaces:**
- **Consumes:** Task 2's `x25519`, `jcsBytes`, `parseCanonical` and `fingerprint`; Task 6's `SignedBundle` and `BundleMeta`.
```ts
export const SEAL_ALG = "X25519-HKDF-SHA256-A256GCM"; export const SEAL_INFO = "aiprof/2 seal v1";
export interface SealedBundle { format: "aiprof/2"; meta: BundleMeta; invite: string; sealed: { alg: typeof SEAL_ALG; kid: string; epk: string; ct: string } }
export function sealBundle(b: SignedBundle, recipientPub: Uint8Array, o?: { ephemeral?: XKey; rand?: Rand }): SealedBundle;   // F6; Error when b.invite is null
export function sealedBytes(s: SealedBundle): Uint8Array;
export function readSealed(bytes: Uint8Array): SealedBundle;           // parseCanonical, then shape
export function openSealed(s: SealedBundle, key: XKey & { kid: string }): SignedBundle;   // F6
```

- [ ] **Step 1: Write the failing tests.**
  - **V8:** with `ephemeral = VEC.alice` and recipient `VEC.bob`, every value in the V8 row. Key, iv, SHA-256(aad) and every length are as before. The values that depend on the V7 signature are (pre-flight G2):
    - SHA-256(plaintext): `47bfe8a269abc4156bf99a4f5186c799c5556c2cc9692afff35e6b8439e42792`;
    - tag: `779b49da1986483d750f0899e4f05228`;
    - file SHA-256: `7d339148e66e59b2ce285ff839fff87749b8f373a5efc53eab92013e5816725f`.
  - **Round trip:**
    - `openSealed` with bob gives back the signed bundle deep-equal;
    - its signature verifies.
  - **Only the company key opens it:**
    - a fresh X key → `sealed-other-key`, and the message names both display fingerprints (Review Focus 3);
    - a header rewritten to the other key's `kid` and re-serialized → `seal-failed`.
  - **Tamper:** XOR every byte of the V8 file with `0x01`. Each result must fail in `readSealed`, in `openSealed`, or in the inner signature check.
  - **Binding** — each of these is `seal-failed`:
    - the clear `invite` swapped for another valid token, then re-serialized;
    - `meta.createdAt` edited, then re-serialized;
    - the last 4 characters of `ct` removed (or `bad-base64`).
  - **Other cases:**
    - a plaintext sealed by hand with 2-space indent → `not-canonical`;
    - `invite: null` → Error;
    - a recipient of 32 zero bytes → `bad-key`.
- [ ] **Step 2: Run** `bun test test/trust/seal.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Use `createCipheriv("aes-256-gcm", key, iv)`, then `setAAD`, then `getAuthTag()`. The decipher sets the tag before `final()`.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(trust): seal bundles to the company X25519 key (HKDF-SHA256, AES-256-GCM), header bound as AAD`.

---

### Task 8: Verify — classify, authenticate, bind to the invite, read deny-by-default

**Files:**
- Create:
  - `src/payload/view.ts` and `src/trust/{verify,banner}.ts`;
  - `test/fixtures/v1-report.html`: synthetic, about 1 KB, holding v1's two markers around a made-up payload;
  - `test/payload/view.test.ts` and `test/trust/verify.test.ts`.

**Interfaces:**
- **Consumes:** Task 3's `TrustedKey` and `Company`; Task 5's `parseInvite` and `InviteLogEntry`; Task 6's `readSigned`, `checkSignature`, `REQUIRED_KEYS` and `SECTION_KEYS`; Task 7's `readSealed` and `openSealed`; B's `DimensionId`, `Confidence`, `Band`, `CheckId`, `CheckStatus` and `ToolId`.
```ts
// src/payload/view.ts — reads only these fields, type-checks each, ignores everything else
export interface ComponentView { id: string; status: "ok" | "not-measurable" | "not-measured"; x: number | null; z: number | null; n: number; weight: number }
export interface DimView { id: DimensionId; status: "scored" | "insufficient" | "not-measurable" | "not-measured"; score: number | null;
  interval: [number, number] | null; openTail: boolean; confidence: Confidence | null; n: number; needs: number | null; window: "detail" | "lifetime"; components: ComponentView[] }
export interface MetricView { value: number | null; n: number; window: "detail" | "lifetime" }
export interface PayloadView { core: string; reference: string;
  overall: { status: "scored" | "insufficient"; score: number | null; interval: [number, number] | null; band: Band; coverage: string | null };
  dimensions: DimView[]; coverage: CoverageView[]; exclusions: ExclusionCounts; otherProjects: number;
  personas: string[] | null; signals: Record<string, MetricView> | null; exposure: ExposureView | null; stack: StackView | null;
  risk: RiskView | null; config: ConfigView | null; projects: ProjectView[] | null; identity: { accounts: number } | null }
  // CoverageView, ExposureView, StackView, RiskView, ConfigView, ProjectView: exactly the fields Plan 2 Task 14's tables list for that section, typed as listed there
export interface IntegrityView { band: "consistent" | "consistent-with-notes" | "inconsistent" | "unverifiable"; serverBacked: number | null;
  anchorable: ToolId[]; notAnchorable: ToolId[]; checks: Array<{ id: CheckId; status: CheckStatus; reason: string; askAbout: string | null; values: Record<string, number | string> }> }
export function readPayload(v: unknown): PayloadView;                  // TrustError("payload-malformed", "<path>: <why>")
export function readIntegrity(v: unknown): IntegrityView;
// src/trust/verify.ts
export type InputKind = "signed" | "sealed" | "self-reported" | "v1-html" | "html" | "unknown";
export function classify(bytes: Uint8Array): { kind: InputKind; value: unknown; reason: TrustCode | null };   // F9; never throws
export type Authenticity = { kind: "release" | "trusted-env" | "dev"; keyId: string; fingerprint: string } | { kind: "self-reported" };
export interface Failure { code: TrustCode; message: string }
export interface InviteCheck { invite: Invite; companyMatches: boolean | null; localName: string | null; withinWindow: boolean }
export interface Verified { kind: "signed" | "self-reported"; sealed: boolean; meta: BundleMeta | null; invite: Invite | null; subject: { name: string | null };
  payload: PayloadView; integrity: IntegrityView | null; exhibits: unknown; fingerprints: Fingerprint[]; exclusions: ExclusionCounts;
  payloadHash: string; dossierNo: string; fileSha256: string; bytes: number }
export interface VerifyReport { file: string; kind: InputKind; exit: 0 | 1 | 3; failures: Failure[]; notes: string[];
  authenticity: Authenticity | null; inviteCheck: InviteCheck | null; verified: Verified | null }
export interface VerifyContext { trust: ReadonlyMap<string, TrustedKey>; company: Company | null; invites: ReadonlyMap<string, InviteLogEntry>; expectInvite: Invite | null }
export function verifyBytes(file: string, bytes: Uint8Array, ctx: VerifyContext): VerifyReport;
// src/trust/banner.ts
export function bannerLines(r: VerifyReport): string[];
```

**Algorithm (in this order):**
1. **Classify (F9).**
   - `v1-html`: exit 3, with the note "v1 report — unverifiable: v1 files are editable HTML; ask for a v2 run with your invite".
   - `html`: exit 1, `bad-format`, "an HTML file, not an .aiprof bundle; ai-profiler never opens candidate HTML".
   - `unknown`: exit 1, with its reason.
2. **Sealed.**
   - Without `ctx.company` → `no-company-key`.
   - Otherwise `readSealed`, then `openSealed(ctx.company.x)`.
   - The inner bundle continues, with `sealed` set.
3. **Signed:** `readSigned`.
4. **Authenticity.**
   - **build `dev`:**
     - `devKey` must be present;
     - `keyId` must equal `dev-` plus the first 8 characters of `fingerprint(devKey)`;
     - `checkSignature(devKey)` must hold, else `bad-signature`;
     - result: `dev`.
   - **build `release`:**
     - the key is looked up in `ctx.trust`: missing → `unknown-key`;
     - a revoked key → `revoked-key`, with its date and reason;
     - a bad signature → `bad-signature`;
     - result: `release` for a shipped key, `trusted-env` for an env key.
5. **Invite binding.** This step applies when `invite` is not null.
   - `parseInvite`, else `bad-invite`.
   - `companyMatches` compares `invite.companyPub` with `ctx.company.ed.pub`, or is null without a company key. False → `invite-other-company`.
   - `ctx.expectInvite` with a different `claims.id` → `invite-mismatch`.
   - `createdAt` must lie in `[iat − 300, exp]`, else `outside-invite-window`.
   - The payload holds only `REQUIRED_KEYS` ∪ the requested sections. `exhibits` and `fingerprints` must be empty unless requested. Otherwise → `fields-exceed-request`.
   - A sealing invite (`sealTo` set) with an unsealed file → `bad-format`, "the invite asked for a sealed file". A sealed file whose invite has no `sealTo` → `bad-format` as well.
   - Notes:
     - no invite → "not bound to an invite: nothing ties this file to a request you made";
     - no company key → "this machine has no company key, so the invite's issuer was not checked";
     - an id missing from the invite log → "this invite is not in this machine's invite log".
6. **Read:** `readPayload(payload)` and `readIntegrity(integrity)`.
7. **Exit:**
   - any failure → 1, with `verified` null;
   - `dev` → 3;
   - otherwise → 0.

**Banner** (terminal text). Line 1 is ASCII apart from `·`. The `note:` and `failed:` lines may keep the spec's wording, such as the em dash in "v1 report — unverifiable" (pre-flight G23). Line 1 starts with one of:
- `Signed v<profiler> (release key <keyId>)`
- `Signed by a key you trust (AIPROF_RELEASE_PUBKEYS: <keyId>)`
- `DEV BUILD: signed by a one-time key, not by a release key`
- `v1 report: unverifiable`
- `NOT VERIFIED: <message> (<code>)`

When there is verified data, line 1 continues:
- ` · invite <displayId>`, with ` (<local name>)` when the invite log names it, or ` · no invite`;
- ` · Consistent`, or ` · Consistent with notes (<k>)`, or ` · Inconsistent (<k> failed)`, or ` · Unverifiable`;
- ` · <share> server-backed`, or ` · no server-backed data`.

`<share>` is `round(100x)%`, or `<1%` when 0 < x < 0.005. After line 1 come one `note: …` line per note and one `failed: …` line per further failure.

- [ ] **Step 1: Write the failing tests** (§10 round trips; Review Focus 1–3).
  - **Happy paths.** The expert persona bundle, signed by `testSigner`, with the invite minted by `testCompany()`, and a context of `testTrust()` plus that company:
    - signed → exit 0, `trusted-env`, `companyMatches: true`, 7 dimensions;
    - sealed → exit 0, `sealed`;
    - unbound → exit 0, with the not-bound note;
    - a dev signer → exit 3, `dev`.
  - **Keys:** an unknown key → `unknown-key`; an injected revoked shipped key → `revoked-key`.
  - **Binding:**
    - a bundle for invite X checked against Y → `invite-mismatch`;
    - the invite swapped inside a signed bundle → `bad-signature`;
    - another company's key here → `invite-other-company`;
    - no company key: an unsealed bundle gives exit 0 with the note, and a sealed one gives `no-company-key`.
  - **Windows** (Review Focus 1):
    - `createdAt = exp + 1 s` → `outside-invite-window`;
    - `createdAt = iat − 299 s` → passes;
    - the result never depends on when the test runs (fake the clock and assert the same report).
  - **Fields:**
    - fields `["signals"]` with `projects` present → `fields-exceed-request`;
    - an unsealed file for a sealing invite → `bad-format`.
  - **v1 and HTML:**
    - the v1 fixture → exit 3, `v1-html`;
    - `<!doctype html><title>x</title>` → exit 1, `html`.
  - **Hostile input** (Review Focus 2):
    - 9 MiB → `too-large`;
    - 100,000 nested arrays → exit 1 with no throw: as a bare array, `unknown` (`bad-format`); wrapped inside a signed-shaped object, `not-canonical` (pre-flight G3);
    - `"__proto__":{"polluted":true}` inside a test-signed payload → exit 0, and `({} as Record<string, unknown>).polluted` is undefined;
    - `1e309`, a BOM, CRLF or a trailing newline → `not-canonical`, with "re-saved or edited" in the message;
    - a token with an extra dot → `bad-invite`;
    - a truncated sealed `ct` → `seal-failed`;
    - a dimension without `status` → `payload-malformed`, naming `dimensions[0].status`;
    - a 10,000-char project label → cut to 200 in the view.
  - **`view`** on a real persona export: every section non-null; and a missing optional section gives `null`, not an error.
  - **Banner:** the exact line 1 for each authenticity case, and for a failure.
- [ ] **Step 2: Run** `bun test test/trust/verify.test.ts test/payload` → FAIL.
- [ ] **Step 3: Implement** `view.ts`, `verify.ts` and `banner.ts`. `classify` reads at most `BUNDLE_READ_MAX` and never evaluates anything.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(trust): verify — classify, authenticate, bind to the invite, deny-by-default payload view, banner`.

---

### Task 9: Consent — names, exclusions, fingerprints, the exact bytes, the terminal menu

**Files:**
- Create: `src/consent/{names,state,fingerprints,prepare,terminal}.ts`, `test/consent/{names,state,fingerprints,prepare,terminal}.test.ts`
- Modify: `test/kit/bundles.ts`, so that `personaBundle` and `sealedPersonaBundle` go through `prepare`

**Interfaces:**
- **Consumes:** B's `scan` types, `analyze`, `AnalyzeOptions` and `exportPayload` (Plan 2 Tasks 13–14); Task 2's `hmac256` and `fromUtf8`; Task 3's `Signer`; Task 5's `Invite`; Task 6's `assemble`, `signingInput` and `Fingerprint`.
```ts
// names.ts
export interface ProjectRow { label: string; key: string; name: string; sessions: number; tools: ToolId[] }
export function cleanName(s: string): string;            // control chars → "?", whitespace collapsed, at most 40 chars ending "…"
export function projectTable(raw: ScanResult, a: Analysis, home: string): ProjectRow[];   // a.projects order
export function matchProjects(rows: readonly ProjectRow[], spec: string, raw: ScanResult, home: string): ProjectRow[];
  // a label from rows · a folder name (every match) · a path ("~" expanded) that equals the normalized cwd or is its prefix on a path-segment
  // boundary; both sides are normalized as B's normalizePath does: "\" → "/", "."/".." resolved, trailing "/" dropped, drive letter lower-cased (pre-flight G22)
// state.ts
export interface ConsentState { tools: ToolId[]; projects: string[] /* keys */; from: number | null; to: number | null;
  reveal: Array<{ label: string; name: string }>; repoSignals: boolean }
export const OPEN_STATE: ConsentState;
export function toExclude(s: ConsentState): NonNullable<AnalyzeOptions["exclude"]>;
export function describeState(s: ConsentState, a: Analysis): string;   // "2 projects and 1 tool left out; 14 sessions dropped"
// fingerprints.ts
export const FP_DOMAIN = "aiprof-fp1\n"; export const MAX_FINGERPRINTS = 8;
export function sessionFingerprint(nonce: Uint8Array, sessionId: string): string;   // F7
export function sizeBucket(actions: number): Fingerprint["size"];
export function pickFingerprints(raw: ScanResult, o: { nonce: Uint8Array; timeZone: string; exclude: NonNullable<AnalyzeOptions["exclude"]> }): Fingerprint[];
export interface FoundSession { tool: ToolId; sessionId: string; start: number; end: number; projectName: string | null }
export function findSessions(raw: ScanResult, nonce: Uint8Array, fp: string, home: string): FoundSession[];   // fp: all 32 hex, or a prefix of at least 8
// prepare.ts
export type ExhibitsFn = (raw: ScanResult, a: Analysis, exclude: NonNullable<AnalyzeOptions["exclude"]>) => Record<string, unknown> | null;
export interface ReadSummary { sources: number; read: number; files: number; records: number; repoSignals: string; tools: Array<{ tool: ToolId; sessions: number }> }
export interface PrepareInput { raw: ScanResult; invite: Invite | null; name: string | null; signer: Pick<Signer, "keyId" | "build" | "pub">;
  createdAt: number; timeZone?: string; exhibits?: ExhibitsFn; home: string }
export interface Prepared { state: ConsentState; analysis: Analysis; exported: ExportResult; bundle: UnsignedBundle; bytes: Uint8Array;
  table: ProjectRow[]; read: ReadSummary; rejectedReveals: string[] }
export function repoSignalsOff(raw: ScanResult): ScanResult;   // repos = { status: "off", repos: [], roots: new Map(), skipped: {}, ms: 0 }
export function prepare(i: PrepareInput, s: ConsentState): Prepared;
// terminal.ts
export interface ConsentIO { write(s: string): void; readLine(prompt: string): Promise<string | null> }
export type ConsentOutcome = { action: "confirm"; prepared: Prepared } | { action: "quit" };
export async function consentLoop(io: ConsentIO, first: Prepared, o: { sealed: boolean; previewPath: string;
  rebuild(s: ConsentState): Prepared; onChange(p: Prepared): void; raw: ScanResult; home: string }): Promise<ConsentOutcome>;
```

**Rules.**
- **Names** follow Plan 3's builder's call 7:
  - the last segment of the cwd, or `~` for the home folder;
  - cleaned;
  - with ` · <label>` appended when two names are equal.
- **`prepare`:**
  1. `raw′` is `repoSignalsOff(raw)` when `repoSignals` is off; otherwise `raw`.
  2. `a = analyze(raw′, { exclude: toExclude(s), timeZone })`.
  3. Keep the reveals whose label is in `a.projects`.
  4. `exportPayload(a, { schema: "aiprof/2", reveal })`. A reveal that the export dropped, because B's schema rejected the name, goes into `rejectedReveals`.
  5. Fingerprints come from the invite's nonce, or are `[]` without an invite.
  6. `exhibits?.(…) ?? null`.
  7. `assemble`.
  8. `bytes = signingInput(bundle)`.
- **The menu** writes to `io.write`. Its lines are exact:
```
What you will share — the preview is open at <previewPath>
  [1] leave out tools          now: <none | ids>
  [2] leave out projects       now: <none | k of n>
  [3] limit the date range     now: <all | YYYY-MM-DD..YYYY-MM-DD>
  [4] reveal a project name    now: <none | labels>
  [5] timestamp (network)      not available in this version
  [6] repo signals             now: <on | off>
  [c] confirm and <seal | sign>     [q] quit (nothing is written)
```
  - **[1] and [2]** take numbers, ids, labels, folder names or paths, separated by commas.
    - The answer replaces the set.
    - An empty answer keeps it.
    - `none` clears it.
    - [2] and [4] first print the table: `#`, label, name, sessions, tools. **This table is the only place where names appear.**
  - **[3]** takes `A..B`, `A..`, `..B` or `all`. Dates are local midnight; `B` covers its whole day. A bad date prints "not a date: …" and changes nothing.
  - **[4]** takes a label or number, then the name to show. The default is the folder name, and `none` clears all reveals. A rejected name prints: "that name was not accepted by the export; choose a simpler one".
  - **[6]** toggles.
  - **`c`** confirms, and **`q`** or end of input quits.
  - **Anything else** prints "unknown choice".
  - **After each change:** call `rebuild`, then `onChange`, then print `Preview updated: <describeState>`.

- [ ] **Step 1: Write the failing tests.**
  - **`names`,** as in Plan 3's cases:
    - `/Users/x/clients/AcmeSecretProject` → `AcmeSecretProject`;
    - the home folder → `~`;
    - two `web` folders get labels appended;
    - 300 chars → 40, ending in `…`;
    - control chars → `?`;
    - HTML is kept raw (escaping is the renderer's job).
  - **`matchProjects`:** a label, a folder name with 2 matches, a `~/…` path prefix, and no match → `[]`. `~/work` does not match `~/workshop`, and `C:\Users\x\Work` matches the cwd `c:/Users/x/Work/app` (pre-flight G22).
  - **`fingerprints`:**
    - V9;
    - `sizeBucket` at 19, 20, 99, 100, 399 and 400;
    - on `personaScan("expert")`: at most 8, distinct, holding the most-overlapped, the largest and the newest session;
    - sorted by day, then fp;
    - an excluded tool's sessions are never picked;
    - deterministic;
    - `expectNoCanaries` on the canaries persona;
    - `findSessions`: a known session's fp, or its 8-hex prefix, finds it with its project name; 7 hex → Error; unknown → `[]`.
  - **`prepare`:**
    - `bytes` equals `signingInput(bundle)`, and `JSON.parse(fromUtf8(bytes))` deep-equals `bundle` (the preview contract);
    - excluding a project by label gives `exclusions.projects === 1`, and it is absent from `payload.projects`;
    - a reveal names that project only;
    - repo signals off → Delivery is `not-measured`;
    - the same state twice, with a fixed `createdAt`, gives identical bytes;
    - on the canaries persona with no reveal, `expectNoCanaries(fromUtf8(bytes))`.
  - **`terminal`,** with scripted IO:
    - `["2","1","c"]` → one `onChange`, and the first table row is excluded;
    - `["q"]` → quit;
    - `[null]` → quit (Review Focus 4);
    - `["5","c"]` → "not available in this version";
    - `["3","2026-02-30..","c"]` → "not a date", and the state is unchanged;
    - `["4","1","","c"]` → revealed with the folder name;
    - `["x","c"]` → "unknown choice";
    - names appear only in the table output that follows `2` or `4`, never in the menu lines.
- [ ] **Step 2: Run** `bun test test/consent` → FAIL.
- [ ] **Step 3: Implement** the modules. Update the bundle kit to use `prepare` with `OPEN_STATE`.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(consent): label ↔ name table, exclusions and reveals, session fingerprints, exact signing bytes, terminal menu`.

---

### Task 10: The interview kit — probe bank and generator

**Files:**
- Create:
  - `probes/{leverage,orchestration,steering,verification,delivery,context,judgment,variants,unknowns}.json`;
  - `src/payload/checks.ts`;
  - `src/kit/{bank,generate}.ts`;
  - `test/interview/{bank,checks,generate}.test.ts`.

**Interfaces:**
- **Consumes:** Task 1's catalog; Task 4's `RoleFit`, `LoadedRole` and `TargetBand`; Task 6's `Fingerprint`; Task 8's `PayloadView` and `IntegrityView`.
```ts
// src/payload/checks.ts
export const CHECK_LABEL: Readonly<Record<CheckId, string>>;    // Plan 3 Task 9's CHECK_LABEL list, verbatim; Task 14 pins it against B's (pre-flight G16)
export const REASON_TEXT: Readonly<Record<string, string>>;     // one neutral sentence per CheckResult.reason code that the installed core/forensics emits
export function reasonText(code: string): string;               // REASON_TEXT[code], else "see the check's values (<code>)"
// bank.ts
export interface Probe { id: string; dimension: DimensionId | null; title: string; targets: DimensionId[]; ask: string; listen: string; flags: string; follow: string }
export const BANK: ReadonlyMap<string, Probe>;                  // probes/*.json, JSON-imported, validated at load
// generate.ts
export type Because =
  | { kind: "component"; component: string; value: number | null; n: number; cite: ExhibitLetter }
  | { kind: "status"; status: "insufficient" | "not-measurable" | "not-measured"; n: number; needs: number | null }
  | { kind: "fit"; fit: "below" | "partial"; band: TargetBand; role: string }
  | { kind: "check"; check: CheckId; reason: string }
  | { kind: "unknown"; topic: "outside" | "quality" };
export interface ProbeCard { n: number; kind: "dimension" | "integrity" | "unknown"; probeId: string | null; dimension: DimensionId | null; title: string;
  targets: Array<{ dimension: DimensionId; confidence: Confidence | null }>; because: Because[]; ask: string; listen: string; flags: string; follow: string; priority: number }
export interface KitModel { agenda: readonly string[]; walkthrough: { fingerprints: Fingerprint[]; command: string }; cards: ProbeCard[] }
export const AGENDA: readonly string[]; export const INTEGRITY_PROBE: { listen: string; flags: string; follow: string }; export const MAX_DIMENSION_CARDS = 6;
export function generateKit(i: { payload: PayloadView; integrity: IntegrityView | null; fingerprints: readonly Fingerprint[]; fit: RoleFit | null; role: LoadedRole | null }): KitModel;
```

**Generator rules** ("uncertainty × dimension weight"):
- **Order of the cards:**
  1. integrity checks that failed;
  2. dimension cards, by priority;
  3. integrity checks with status `warn` or `note` that have an `askAbout`;
  4. `unknown.outside`, then `unknown.quality`.

  The cards are numbered from 1.
- **The weight `w`:**
  - a must-have's weight;
  - else `DIMENSION_WEIGHTS[d] × 0.5` when a role is present;
  - else `DIMENSION_WEIGHTS[d]`.
- **The uncertainty `u`:**
  - 1 when the dimension is not scored;
  - else `min(1, (hi − lo)/100 + gap)`, where the width is 50 without an interval, and `gap` is:
    - with a role: 0.5 for `below`, 0.3 for `partial`, and 0 otherwise;
    - without a role: 0.3 when the score is below 50, and 0 otherwise.
- **Which dimensions get a card:** a dimension is kept when it is a must-have or `u ≥ 0.3`.
  - `priority = u × w`, sorted descending, with ties in `DIMENSIONS` order.
  - At most `MAX_DIMENSION_CARDS` cards.
- **The probe for a dimension:** the role's `probeBank` probe for that dimension, else `<dimension>.default`.
- **`because` for a dimension card:**
  - unscored: the status;
  - scored: the fit (when below or partial), then the `ok` component with the lowest `z` (ties by id), with its value from `payload.signals`.
- **Integrity cards:**
  - `ask` is the check's `askAbout`, and `because` is its reason code. A `CheckResult.reason` is a code, not prose (Plan 3 pre-flight F24); every surface shows it through `reasonText`;
  - `listen`, `flags` and `follow` come from `INTEGRITY_PROBE`.
- **`walkthrough.command`:** `ai-profiler find <fingerprint> --invite <the invite token you sent>`.

**Pinned copy.**
- **`AGENDA`:**
  1. "10 min: the candidate walks through one fingerprinted session on screen share."
  2. "15 min: the probes below, in order."
  3. "20 min: pairing on a real task with their own agent setup."
- **`INTEGRITY_PROBE`:**
  - listen: "a concrete explanation that can be checked, such as a restored backup, a new machine or a synced folder";
  - flags: "no explanation, or one that changes when asked again";
  - follow: "Can you show me that history on your machine now?"
- **The `verification.default` card,** from the spec:
  - title: "Deciding it is done";
  - targets: verification, delivery;
  - ask: "Show me how you decide an agent's change is done.";
  - listen: "names concrete gates (tests, typecheck, diff review) and a time one caught a confident-but-wrong agent";
  - flags: "\"the model's usually right\"; can't recall a single failure";
  - follow: "What did you change in your setup afterwards?"

**The other asks** (id · title · targets · ask):

| id | title | targets | ask |
|---|---|---|---|
| leverage.default | Long agent runs | leverage, steering | "Walk me through a long agent run you did not have to undo. How did you set it up?" |
| orchestration.default | Several agents at once | orchestration, delivery | "When do you run more than one agent at a time, and how do you keep their work apart?" |
| steering.default | Steering | steering, leverage | "Tell me about a time an agent went the wrong way. When did you notice, and what did you say?" |
| delivery.default | Landing the work | delivery, verification | "Take one agent change from the first prompt to a merged PR. What happens between the edit and the merge?" |
| context.default | Briefing the agent | context, steering | "What does your agent know about this codebase before you type anything? Show me." |
| judgment.default | Choosing the model | judgment, context | "How do you pick a model or effort level for a task? Give an example where you switched." |
| verification.platform | Checking infrastructure changes | verification, context | "How do you check an agent's change to CI, infrastructure or deploy config before it runs anywhere real?" |
| orchestration.lead | Splitting work across agents and people | orchestration, steering | "How would you split one feature across several agents and several people, and who reviews what?" |
| unknown.outside | Work these histories cannot show | — | "What important work of yours with AI agents would not show up here: cloud agents, another machine, or a tool this version cannot read?" |
| unknown.quality | The quality of the result | — | "Pick a change an agent made that you are proud of, and one you threw away. What made the difference?" |

The implementer writes the remaining `listen`, `flags` and `follow` fields, within these limits:
- each field is 1–220 chars;
- no field contains "hire", "reject", "pass/fail" or "% match".

- [ ] **Step 1: Write the failing tests.**
  - **`bank`:**
    - each dimension has `<d>.default`, with `targets[0] = d`;
    - every id and field is valid;
    - the word lint passes;
    - every field uses only the font-covered characters named under `checks` below;
    - the unknown probes have `dimension: null`.
  - **`checks`:**
    - every `CheckId` has a label;
    - every `reason` that `analyze` emits for the three personas and for an empty `scanResultOf([])` has a `REASON_TEXT` entry;
    - an unknown code falls back;
    - every label and sentence uses only U+0020–00FF, U+2000–206F and `−`, the characters Plan 3's fonts cover (the kit itself arrives in Task 14).
  - **`generate`,** on the expert and novice personas and on an empty `scanResultOf([])`, each through `analyze`, `exportPayload` and `readPayload`, with the shipped `backend` role and with no role:
    - the four groups come in order;
    - at most 6 dimension cards;
    - the dimension cards follow `priority = u × w`, descending, with ties in `DIMENSIONS` order. On the empty `scanResultOf([])`, card 1 is verification, both with the `backend` role and without a role. No check fails there, so card 1 is the first dimension card (pre-flight G11);
    - with a failing hand-built integrity view, card 1 is integrity, and the warn and note cards follow the dimension cards;
    - the unknown cards are last;
    - priorities do not increase within the dimension cards;
    - `platform-infra` uses `verification.platform`;
    - `because.value` equals the payload's signal value;
    - deterministic;
    - no string anywhere contains "NaN" or "undefined".
- [ ] **Step 2: Run** `bun test test/interview` → FAIL.
- [ ] **Step 3: Implement** the probe files, the labels, the reason sentences and the generator. Collect the reason codes from the installed `node_modules/ai-practice-report/core/forensics/*.ts`.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(kit): probe bank and an interview kit ordered by uncertainty × weight`.

---

### Task 11: Compare model and CSV (data only; Task 18 renders it)

**Files:**
- Create: `src/console/{model,csv}.ts`, `test/console/{model,csv}.test.ts`

**Interfaces:**
- **Consumes:** Task 4's `roleFit`, `LoadedRole` and `Fit`; Task 5's `InviteLogEntry`; Task 8's `VerifyReport`, `Authenticity`, `InputKind` and the views; Task 9's `cleanName`.
```ts
export interface ConsoleRow { order: number; file: string; label: string; dossierNo: string; inviteId: string | null; role: string | null; roleDiffers: boolean;
  authenticity: Authenticity["kind"]; band: IntegrityView["band"] | null; serverBacked: number | null; overall: PayloadView["overall"];
  dims: Array<{ id: DimensionId; status: DimView["status"]; score: number | null; interval: [number, number] | null; confidence: Confidence | null }>;
  fit: Array<{ dimension: DimensionId; fit: Fit }> | null; duplicateOf: number | null }
export interface ConsoleModel { role: { id: string; title: string; hash: string; mustHaves: Array<{ dimension: DimensionId; targetBand: TargetBand }> } | null; rows: ConsoleRow[];
  rejected: Array<{ file: string; kind: InputKind; reason: string }>; note: string }
export function chooseRole(reports: readonly VerifyReport[], roles: ReadonlyMap<string, LoadedRole>, requested?: string): LoadedRole | null;
export function buildConsole(reports: readonly VerifyReport[], o: { role: LoadedRole | null; invites: ReadonlyMap<string, InviteLogEntry> }): ConsoleModel;
export interface CsvTable { header: string[]; rows: string[][]; keys: string[] /* dossierNo per row */ }
export function csvTable(m: ConsoleModel): CsvTable;
export function csvFor(t: CsvTable, notes: Readonly<Record<string, string>>, shortlist: Readonly<Record<string, boolean>>): string;
  // self-contained, with no outer reference: Task 18's client embeds csvFor.toString()
```

**Rules.**
- **Rows** come from the reports with exit 0 or 3 that have `verified`, in the order the files were given. The others go into `rejected`, with their first failure's message, or "v1 report — unverifiable".
- **`label`** is the first of: the invite log's name, `subject.name`, `Candidate <displayId>`, the cleaned file stem.
- **`duplicateOf`** is the earlier row with the same invite id.
- **`roleDiffers`** is set when the row's invite role differs from the console's role.
- **`chooseRole`:** `requested`, else the first invite role that has a loaded profile, else null.
- **`note`:** "Rows are in the order the files were given. Sort by any column; nothing is ranked for you." This pinned negation is exempt from the copy lints of Task 16 (pre-flight G7).
- **CSV header:**
  1. `order`, `candidate`, `invite`, `authenticity`, `integrity`, `server_backed`, `overall_band`, `overall_score`, `overall_low`, `overall_high`;
  2. then `<dim>_score`, `<dim>_low` and `<dim>_high` per dimension, in `DIMENSIONS` order;
  3. then `fit_<dim>` per must-have;
  4. then `shortlisted` and `notes`.

  Formatting follows builder's call 12.

- [ ] **Step 1: Write the failing tests.**
  - **Model:**
    - five persona bundles → 5 rows, in input order;
    - a bundle with one flipped byte → `rejected` with `bad-signature`;
    - the v1 fixture → `rejected` with the v1 text;
    - two bundles from one invite → the second has `duplicateOf: 1`;
    - a `frontend` invite in a `backend` console → `roleDiffers`;
    - no object in the model has a key containing "rank".
  - **CSV:**
    - the exact header for `backend`;
    - quoting of `,`, `"` and CR/LF;
    - `=SUM(A1)` → `'=SUM(A1)`;
    - CRLF line ends;
    - deterministic;
    - `new Function("return " + csvFor.toString())()` works on the same table (it is self-contained).
- [ ] **Step 2: Run** `bun test test/console` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(console): compare model in import order, duplicate invites, role fit, CSV with a formula guard`.

---

### Task 12: CLI I — arguments, help, explain, recruiter commands, find

**Files:**
- Create:
  - `src/cli.ts`;
  - `src/copy.ts`;
  - `src/cli/{args,help,explain,main,deps,io,keys,invite,roles,find}.ts`;
  - `test/cli/{args,help,explain,recruiter,find}.test.ts`.

**Interfaces:**
- **Consumes:** B's `registry`, `REPO_SIGNALS_DESCRIBE`, `scan` and `ScanOptions`; Tasks 3–5 (keys, roles, invites); Task 9's `findSessions`, `Prepared`; Task 6's `SignedBundle`.
```ts
// src/copy.ts
export const PRIVACY_STATEMENT: readonly string[];   // exact (Spec values)
export const TRUST_STATEMENT: readonly string[];     // exact (Spec values)
// src/cli/args.ts
export interface RunOptions { invite: string | null; name: string | null; out: string | null; json: boolean; open: boolean; yes: boolean;
  excludeTools: ToolId[]; excludeProjects: string[]; since: number | null; until: number | null; reveal: string[]; repoSignals: boolean; notices: string[] }
export type Command = { k: "run"; o: RunOptions } | { k: "explain" } | { k: "find"; fp: string; invite: string }
  | { k: "keys-init"; name: string; force: boolean } | { k: "keys-show" }
  | { k: "invite"; role: string; name: string | null; expiresS: number; fields: InviteField[] | null; seal: boolean }
  | { k: "roles-list" } | { k: "roles-export"; id: string }
  | { k: "verify"; file: string; invite: string | null; out: string | null; open: boolean }
  | { k: "compare"; files: string[]; role: string | null; out: string | null; open: boolean }
  | { k: "help" } | { k: "version" } | { k: "error"; message: string };
export function parseArgs(argv: readonly string[], o: { tools: readonly ToolId[]; now: number }): Command;
// src/cli/main.ts
export interface Renderers { preview(p: Prepared, o: { sealed: boolean }): string; candidateCopy(p: Prepared, signed: SignedBundle): string }   // Tasks 17–18 add dossier and console
export interface Deps { sys: Sys; cwd: string; stdout(s: string): void; stderr(s: string): void; tty(s: string): void; isTTY: boolean;
  readLine(prompt: string): Promise<string | null>; open(path: string): void; now(): number; rand?: Rand; signer?: Signer;
  scanEnv?: ScanOptions["env"]; renderers: Renderers; onSignal(handler: () => void): () => void }
export async function main(argv: readonly string[], d: Deps): Promise<number>;
// src/cli/deps.ts
export function productionDeps(renderers: Renderers): Deps;   // process, os.homedir, node:readline on stdin, tty = stderr, SIGINT
  // isTTY = process.stdin.isTTY === true && process.stderr.isTTY === true, so the names table never reaches a redirected stderr (pre-flight G10)
// src/cli/io.ts
export function tildify(path: string, home: string): string;
export function openInBrowser(path: string, platform: Sys["platform"]): void;   // darwin open · linux xdg-open · win32 explorer.exe; argv only, detached
  // it throws on failure; callers print "note: could not open a browser (<code>)" to stderr and keep their exit code (as Plan 3 pre-flight F23)
// src/cli/explain.ts · help.ts
export function explainText(): string; export function helpText(tools: readonly ToolId[]): string;
// src/cli/find.ts
export async function runFind(o: { fp: string; invite: string }, d: Deps): Promise<number>;
```

**Flags.**
- Values are written `--flag value` or `--flag=value`.
- **A candidate run** (no subcommand) takes:
  - `--invite`, `--name`, `--out`, `--json`, `--no-open` and `--yes`;
  - `--exclude-tool ID`: repeatable, comma lists allowed, ids from `registry`;
  - `--exclude-project SPEC` and `--reveal-projects SPEC[,SPEC]`: both repeatable;
  - `--since DATE` and `--until DATE`: a real date, not in the future;
  - `--no-repo-signals`;
  - `--redact`: kept, and adds the notice "--redact is the default now: projects are labels unless you reveal one";
  - `--explain`.
- **Subcommands:**
  - `find FP --invite TOKEN`;
  - `keys init --name COMPANY [--force]` and `keys show`;
  - `invite --role ID [--name TEXT] [--expires DUR] [--fields LIST] [--no-seal]`;
  - `roles [list]` and `roles export ID`;
  - `verify FILE [--invite TOKEN] [--out PATH] [--no-open]`;
  - `compare FILE… [--role ID] [--out PATH] [--no-open]`.
- **Usage errors** exit 2, printing `error: <message>` and then `Run ai-profiler --help for options.`:
  - an unknown flag, or a missing value;
  - a bad id or date;
  - `--name` over 80 chars, or holding a control char;
  - `--timestamp`, `session`, `calibrate` and `--brief`, which say "… is not available in this version".
- **Dispatch.** In this task `main` dispatches everything except `run`, `verify` and `compare`. Those three exit 2 with "… is not available in this version" until Tasks 13 and 18 wire them.

**Commands.**
- **`keys init`:**
  - prints the path, the signing-key fingerprint ("give this to candidates so they can check your invites") and the sealing-key fingerprint;
  - when keys already exist → exit 1, with "company keys already exist at <path>; --force replaces them, and older invites then stop verifying".
- **`keys show`:** prints the fingerprints, or exits 1 with "no company keys: run ai-profiler keys init".
- **`invite`:**
  - needs company keys (exit 1 without them) and a known role (exit 2 otherwise, listing the role ids);
  - writes **only the token** to stdout;
  - writes a summary to stderr: `Invite <ID> for <role> (<title>), expires <date>, sealed to <fp>`;
  - appends to the invite log.
- **`roles`:** one line per role: id, title, source, the first 12 hex characters of the hash, and the must-haves. Then each `loadRoles` error goes to stderr as a `note:` line (pre-flight G25).
- **`find`:**
  1. Parse the invite; an expired one is accepted for `find`.
  2. `scan({ env: d.scanEnv, repoSignals: false })`, then `findSessions`.
  3. Print the tool, the session id, the local start (`YYYY-MM-DD HH:MM`), the minutes it ran and the project name.

  Exit 0 when found, else 1 with "no session on this machine matches; it may have been pruned since the run". `find` prints the only real names outside the consent table.
- **`--explain`:**
  - header: `ai-profiler <version>: what a run would read (nothing has been read)`;
  - per plugin: its id, tier, `beta`, `describe.reads` and `describe.neverReads`;
  - repo signals, from `REPO_SIGNALS_DESCRIBE`, plus "only in the repositories your sessions ran in, found from the sessions themselves";
  - what is never opened;
  - what is written, and when;
  - "Network: none";
  - the privacy statement.

  It imports no scan or file-reading code.
- **Help:**
  - one line per command and flag;
  - the valid tool ids;
  - `PRIVACY_STATEMENT`, then `TRUST_STATEMENT`, wrapped at word boundaries;
  - no line longer than 100 columns.

- [ ] **Step 1: Write the failing tests.**
  - **`args`,** one case each:
    - the defaults;
    - every v1 flag;
    - `--redact` adds its notice;
    - `--exclude-tool codex,claude-code`, and `nope` (an error listing the ids);
    - `--since 2026-02-30`, and a future date;
    - an 81-char `--name`;
    - `--timestamp`, `session start` and `calibrate`;
    - `--out` with no value;
    - each subcommand's shape;
    - `-h` and `--version`.
  - **`help`:**
    - holds every command and every registry tool id;
    - once runs of whitespace are collapsed to one space, it holds every sentence of both statements;
    - every line is at most 100 columns.
  - **`explain`:**
    - holds every plugin id and `REPO_SIGNALS_DESCRIBE.reads`;
    - a static check: `explain.ts` imports only `registry`, `REPO_SIGNALS_DESCRIBE`, `src/copy.ts` and `src/version.ts`.
  - **`recruiter`,** through `main` with `testSys`:
    - `keys init --name "Example Co"` → exit 0, two fingerprints, and the files' modes (POSIX);
    - a second init → exit 1 (Review Focus 3);
    - `invite --role backend --name "Jordan Example"` → stdout is one line, `parseInvite(stdout)` succeeds, `sealTo` is the company's X25519 key, and the log has 1 entry;
    - `--no-seal` gives `sealTo: null`;
    - an unknown role → exit 2;
    - no keys → exit 1;
    - `roles` lists 6, and with a malformed local role file it also prints a `note:` line on stderr (pre-flight G25);
    - `roles export backend` → a path, and a second export → exit 1.
  - **`find`,** on a `fakeHome` with `allBuilders`:
    - take the first top-level detail session of a `scan` of that home; its `sessionFingerprint` under the invite's nonce → exit 0, printing its id and project name;
    - `deadbeef` → exit 1.
- [ ] **Step 2: Run** `bun test test/cli` → FAIL.
- [ ] **Step 3: Implement.**
  - `src/cli.ts` is `#!/usr/bin/env bun` plus `process.exitCode = await main(process.argv.slice(2), productionDeps(RENDERERS))`.
  - `RENDERERS` comes from Task 13. Until then, `src/cli.ts` passes renderers whose functions throw "not available".
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(cli): arguments, help, explain, company keys, invites, roles and find`.

---

### Task 13: CLI II — the candidate run and verify

**Files:**
- Create: `src/cli/{outputs,run,verify}.ts`, `src/render/{raw,index}.ts`, `test/cli/{run,verify}.test.ts`
- Modify: `src/cli/main.ts` (dispatches `run` and `verify`), `src/cli.ts` (uses `RENDERERS`)

**Interfaces:**
- **Consumes:** Task 12's `Deps`, `Renderers`, `RunOptions` and `main`; Task 3's `resolveSigner`, `loadTrust` and `loadCompany`; Task 5's invite functions; Tasks 6–8 (sign, seal, verify, banner); Task 9's `prepare`, `matchProjects` and `consentLoop`.
```ts
// outputs.ts
export interface OutputPaths { dir: string; stem: string; bundle: string; copy: string; json: string | null; preview: string }
export function slug(name: string | null): string;                     // lower-case [a-z0-9]+ joined by "-", at most 40; "candidate" when empty
export function outputPaths(cwd: string, o: RunOptions, day: string, s: Sys): OutputPaths | { error: string };
  // stem: --out without .aiprof/.html, else <cwd>/ai-profile-<slug>-<day>; files <stem>.aiprof, .candidate-copy.html, .json, .preview.html
export function writeAll(files: ReadonlyArray<{ path: string; data: string | Uint8Array }>): { ok: true } | { ok: false; path: string; code: string };
  // 0600 in order; on a failure it removes what it wrote
// run.ts · verify.ts
export async function runCandidate(o: RunOptions, d: Deps): Promise<number>;
export async function runVerify(o: { file: string; invite: string | null; out: string | null; open: boolean }, d: Deps): Promise<number>;
// render/raw.ts — the interim renderer, until Task 17
export function rawJsonPage(title: string, banner: string, json: string): string;   // escaped <pre>; CSP default-src 'none' plus the style hash; no script
// render/index.ts
export const RENDERERS: Renderers;
```

**The candidate run, in order:**
1. **The invite.**
   - Parse it.
   - When it has expired → exit 1, with "this invite expired on <YYYY-MM-DD>; ask the recruiter for a new one". Nothing is scanned.
   - When it is not yet valid → exit 1, with "this invite is not valid yet; check your computer's clock".
   - Print to `tty`: `Invite <ID> from "<company>" (key <display fingerprint>) for <role>, valid until <date>. Check the key with the person who sent it.`
2. **Without `--yes`, and unless stdin and stderr are both TTYs (`d.isTTY`)** → exit 2, with "the consent step needs a terminal; run in one, or add --yes to accept the preview without the menu" (pre-flight G10).
3. **The signer:** `d.signer ?? resolveSigner()`.
4. **The scan:** `scan({ env: d.scanEnv, repoSignals: o.repoSignals, handleSignals: true, onProgress })`.
   - On a TTY, stderr shows `Scanning… <done>/<total>` in place.
   - Without one, there is no `\r` and no escape code.
   - Then: `Read <k> of <m> sources in <s> s`.
5. **The first state.**
   - The options are resolved through `matchProjects`. No match → exit 2, with "no project matches <spec>".
   - Then `prepare`.
6. **Interactive.**
   1. Register `d.onSignal` before the preview is written: on SIGINT, remove the preview and exit 130 (pre-flight G21).
   2. Write the preview, `renderers.preview(prepared)`, and open it unless `--no-open`.
   3. Run `consentLoop` with `io.write = d.tty`, and rewrite the preview on each change.
   4. On quit or end of input: remove the preview, print "Nothing was written.", and exit 0.
7. **Sign, then seal** when the invite has `sealTo`.
8. **Write,** with `writeAll`:
   - the `.aiprof` file;
   - the candidate copy, `renderers.candidateCopy`;
   - with `--json`, the exact signing bytes.

   On a failure → exit 1, with `could not write <tildified path> (<code>)`.
9. **Finish.** Remove the preview, then print to stdout:
   - `Wrote <bundle path>  (sealed to <company> | signed, not sealed)`;
   - the copy's path;
   - "Send the .aiprof file to the recruiter. The candidate copy is for you; it is not evidence."
   - Exit 0.

**Verify.**
1. `stat` the file first. Larger than `BUNDLE_READ_MAX` → exit 1, `too-large`, and the file is never read. Otherwise read it. Failure → exit 1, with "could not read <path> (<code>)" (pre-flight G14).
2. Build the context:
   - `loadTrust`: an `error` → exit 2;
   - `loadCompany`, with its warnings sent to stderr;
   - `readInviteLog`;
   - `--invite`, parsed.
3. Print `bannerLines(verifyBytes(…))`.
4. Exit with the report's exit code.

The dossier output arrives in Task 17.

- [ ] **Step 1: Write the failing tests.** They run through `main`, with:
  - `testSys`;
  - `scanEnv` from a `fakeHome` with `allBuilders` and two `makeRepo` repos;
  - `signer: testSigner()`;
  - `AIPROF_RELEASE_PUBKEYS` holding the test key;
  - company keys from `keys init`.

  The cases:
  - **Sealed, `--yes --no-open`:**
    - exit 0;
    - `<stem>.aiprof` passes `readSealed` and `openSealed` with the company key;
    - `verify` on it → exit 0;
    - the candidate copy exists, and no preview remains;
    - stdout holds the tildified paths;
    - no `\r` or `\x1b` without a TTY;
    - the files are 0600 (POSIX).
  - **`--json`:** its bytes equal the opened bundle's signing input.
  - **Interactive,** with `isTTY` and the script `["2","1","c"]`:
    - the preview is written, opened once, then removed;
    - `exclusions.projects === 1`;
    - with an opener that throws, the run still exits 0 and stderr holds `note: could not open a browser (<code>)`.
  - **Leaving early** (Review Focus 4):
    - `["q"]` and `[null]` → exit 0, nothing written, the preview removed;
    - `onSignal` fired at the menu → exit 130, nothing written, the preview removed. The handler is registered before the preview file exists (pre-flight G21);
    - no TTY and no `--yes` → exit 2.
  - **An expired invite** (Review Focus 1): exit 1 with that message, nothing written, and `onProgress` never called.
  - **Output folders** (Review Focus 4):
    - `--out <missing>/x.aiprof` → exit 1;
    - a 0555 folder (POSIX) → exit 1, with `(EACCES)` and no file left;
    - the same day run twice → exit 0, overwritten;
    - `--name "a/b 😀"` → a stem ending `ai-profile-a-b-<day>`.
  - **Projects:**
    - `--exclude-project <folder name>` → excluded;
    - `nope` → exit 2;
    - `--reveal-projects <folder name>` → that name is in the payload;
    - without it, no project name is in the bundle.
  - **Unbound:** a signed, unsealed bundle; `verify` → exit 0, with the not-bound note.
  - **No injected signer:** `verify` → exit 3, `DEV BUILD`.
  - **`verify` command:**
    - one flipped byte → exit 1, `NOT VERIFIED`;
    - a missing file → exit 1;
    - a 9 MiB file → exit 1, `too-large`, and it is never read (pre-flight G14);
    - a malformed `AIPROF_RELEASE_PUBKEYS` → exit 2.
- [ ] **Step 2: Run** `bun test test/cli` → FAIL.
- [ ] **Step 3: Implement.** `RENDERERS.preview` and `RENDERERS.candidateCopy` return `rawJsonPage` of the exact bytes, until Task 17 replaces them.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(cli): the candidate run — consent, sign, seal, write — and verify with its banner and exit codes`.

---

### Task 14: Bump the pin to B's `main` with the viz kit, and pin Plan 3's names

**Files:**
- Create: `test/contract/plan3.test.ts`
- Modify:
  - `package.json` (the dependency and `corePin`) and `bun.lock`;
  - `test/kit/core.ts`. It re-exports B's `WEIGHTS` (`core/scoring/overall.ts`) and B's `app/copy.ts` and `app/names.ts` by relative path, as it does the test kits, for the contract test only (pre-flight G16).

**Interfaces:**
- **Consumes,** exactly as Plan 3 states:
  - its "Interfaces for Plan 4" block: `renderKit` with its exact key list, and the kit types `LedgerRow`, `LedgerGroup`, `LedgerComponent`, `SealInput`, `FigureOptions`, `CoverageRow`, `CoverageCell`, `BarItem` and `FunnelLabels`. A imports them from `ai-practice-report/viz`; only the `viz/types` ones are also exported by `ai-practice-report/core` (pre-flight G5);
  - Task 6: `computeExhibits`, `Exhibits`, `ExhibitId`, `DayLoupe`, `LoupeLane`, `Spans` (flat `[from, to, …]` bin pairs), `DelegationExhibit`, `DelegationGroup`, `VerificationExhibit`, `HabitExhibit`, `ThenNow` and `ThenNowRow`, and the caps `LOUPE_MAX_BINS`, `LOUPE_MAX_LANES`, `LOUPE_MAX_CHILDREN`, `DELEGATION_MAX_GROUPS`, `DELEGATION_MAX_TOTAL`, `HABIT_MAX_TOOLS` and `THEN_NOW_NEEDS_DAYS`;
  - Task 10: `selfReportedBundle`, `isSelfReported` and `SelfReportedBundle`.
- **Produces:** the new pin, plus the test-only bridge re-exports of B's `WEIGHTS` and app copy (pre-flight G16), and nothing else.

- [ ] **Step 1: Check.**
  - Plan 3's PR is merged (`gh pr list --repo build-with-bala/ai-practice-report --state merged`). If not, report BLOCKED: the controller waits.
  - Read the new `main` SHA with `git ls-remote`.
- [ ] **Step 2: Bump.**
  - Update the dependency and `corePin` (`ref: "main (Plan 3 merged)"`, or B's tag once one exists).
  - Run `bun install`, with the network.
  - Read `node_modules/ai-practice-report/core/viz/index.ts`, `core/exhibits/types.ts` and `core/privacy/bundle.ts`.
- [ ] **Step 3: Write the contract test.**
  - **The kit object:**
    - `Object.keys(renderKit).sort()` equals Plan 3's list;
    - `ai-practice-report/viz` and `ai-practice-report/core` give the same `renderKit`.
  - **Exhibits:** `computeExhibits(personaScan("expert"), a)` has `exhibits.a`–`e` and `local.activeRepoKeys`.
  - **Self-reported:** `isSelfReported(selfReportedBundle(exportPayload(a, …), { version: "1.0.0", core: "1.0.0", createdAt: "2026-11-18" }).value)` holds.
  - **Render as A will:** seal + ledger + `figure(habitLanes(exhibits.d))` through `renderKit.page`. The audit is clean, and a second render is byte-identical.
  - **The kit types** compile when imported from `ai-practice-report/viz`, which is where `src/` takes them from (pre-flight G5).
    - The `viz/types` types (`LedgerRow`, `LedgerGroup`, `LedgerComponent`, `SealInput`, `FigureOptions`) and the exhibit types also compile from `ai-practice-report/core`.
    - `FunnelLabels`, `BarItem`, `CoverageRow` and `CoverageCell` come from `/viz` only.
  - **Copied constants** (pre-flight G16), through `test/kit/core.ts`:
    - `DIMENSION_WEIGHTS` deep-equals B's `WEIGHTS`;
    - `DIMENSION_LABEL`, `LEDGER_GROUPS` and `CHECK_LABEL` deep-equal B's in `app/copy.ts`, and `REASON_TEXT` has exactly B's keys;
    - for every `COMPONENTS` row, `unit` and `cite` equal B's `COMPONENT[id].unit` and `.cites`;
    - `cleanName` gives the same result as B's `app/names.ts` `cleanName` on Plan 3 Task 9's name cases.
  - Plan 2's contract still passes.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS. On a failure, report BLOCKED with the difference.
- [ ] **Step 5: Commit and push.** Commit `build: pin the core to ai-practice-report main with the viz kit`. Run the EtherHiding scan, then `git push`.

---

### Task 15: Exhibits in bundles; self-reported bundles in verify

**Files:**
- Create: `src/payload/exhibits.ts`, `test/payload/exhibits.test.ts`
- Modify:
  - `src/consent/prepare.ts`: the default `exhibits` becomes `exhibitsForBundle`;
  - `src/trust/verify.ts`: self-reported files, and `Verified.exhibits` becomes `Exhibits | null`;
  - `test/kit/bundles.ts` and `test/trust/verify.test.ts`.

**Interfaces:**
- **Consumes:** Task 14's pinned names (`computeExhibits`, `Exhibits`, the caps, `isSelfReported`, `renderKit.labels`); Task 9's `ExhibitsFn`; Task 8's `classify` and `verifyBytes`.
```ts
export function readExhibits(v: unknown): Exhibits | null;   // deny-by-default copy, built field by field; null when malformed
export const exhibitsForBundle: ExhibitsFn;                  // (raw, a, ex) => readExhibits(JSON.parse(JSON.stringify(computeExhibits(raw, a, { exclude: ex }).exhibits)))
```

**Rules.**
- **`readExhibits`** copies only the fields of Plan 3 Task 6's types.
  - **Numbers:** finite.
  - **Enums:**
    - `ToolId` from `registry`;
    - child types from `renderKit.labels.child`;
    - features from `renderKit.labels.feature`;
    - `Origin` from the core's types.
  - **Caps:** Plan 3's constants, with weeks at most 52 and `DELEGATION_MAX_TOTAL` groups in the whole tree.
  - **`Spans`:** an even number of integers, each pair with `0 ≤ from ≤ to < bins`.
  - **Order:** arrays keep their order.
- **Malformed exhibits in a verified bundle.** `exhibits` is not null, but `readExhibits` returns null. `verify` then adds the note "exhibit data in an unexpected format; not shown" and keeps its exit code. Nothing is dropped silently (pre-flight G15).
- **Self-reported files.**
  - `classify` recognizes them with `isSelfReported`.
  - `verify` reads the payload, ignores B's `forensics` ("no integrity band", §7.5), and sets `integrity: null`, `exhibits: null` and `authenticity: { kind: "self-reported" }`. Exit 3.
  - Note: "Self-reported, not verified: made with ai-practice-report, and nothing ties it to a person, a machine or an invite".
  - The banner's line 1 is `Self-reported: not verified`.
  - `dossierNo` is computed over the file bytes.

- [ ] **Step 1: Write the failing tests.**
  - **Exhibits in the bundle:**
    - the expert bundle's `exhibits` has `a`–`e`;
    - a property planted on `computeExhibits` output (`a[0].lanes[0].secret = CANARY.prompt`) is not in the bundle;
    - bins over 600, an odd-length `Spans`, a span past `bins`, an unknown tool id, or `NaN` → `null`;
    - `readExhibits` is idempotent;
    - `expectNoCanaries` on the canaries persona;
    - the bundle stays within `BUNDLE_BUDGET` on `synthStore(300_000)`, and with both loupes replaced by Plan 3 Task 7's worst case (12 lanes, 600 bins, alternating work bins, 120 prompts and 24 children per lane);
    - an invite without `exhibits` → `null`;
    - an unbound run ships `exhibits` with `a`–`e`, and `fingerprints: []` (pre-flight G9);
    - a test-signed bundle whose `exhibits` holds an odd-length `Spans` → exit 0, `Verified.exhibits` null, and the note "exhibit data in an unexpected format; not shown" (pre-flight G15).
  - **Self-reported:**
    - B's export → exit 3, `self-reported`, `integrity: null`, a valid payload view;
    - the same file with `signature: "x"` → exit 1.
- [ ] **Step 2: Run** `bun test test/payload test/trust` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(bundle): signed exhibit data through a deny-by-default copy; self-reported exports read as unverifiable`.

---

### Task 16: The dossier model

**Files:**
- Create:
  - `src/dossier/{copy,model,findings,method}.ts`;
  - `test/kit/dossiers.ts`;
  - `test/dossier/{copy,model}.test.ts`, with snapshots.
- Modify: `test/contract/plan3.test.ts`, adding the pins on the dossier copy copied from B (pre-flight G16).

**Interfaces:**
- **Consumes:** B's kit types, imported from `ai-practice-report/viz` (pre-flight G5), and `renderKit.fmt`/`uncoveredChars` (Task 14); Task 1's catalog; Task 4's `roleFit`; Task 8's views and `VerifyReport`; Task 9's `Prepared` and `ReadSummary`; Task 10's `generateKit` and `reasonText`; Task 15's `readExhibits`.
```ts
// copy.ts
export const COMPONENT_COPY: Readonly<Record<string, { label: string; evidence: string }>>;
  // Plan 3 Task 9's component labels and evidence templates, with "your" → "their" and "you" → "they"; placeholders {v} {inv} {n} {apt}
export function componentValue(id: string, value: number | null): string;   // by unit, as Plan 3's componentValue, through renderKit.fmt
export const VERDICT_PHRASE: Readonly<Record<DimensionId, string>>; export const BAND_LABEL: Readonly<Record<Band, string>>;
export const HEALTH_TEXT: Readonly<Record<IntegrityView["band"], string>>; export const FUNNEL_LABELS: FunnelLabels;
export const THEN_NOW_LABEL: Readonly<Record<ThenNowRow["id"], string>>; export const UNKNOWN_FINDINGS: readonly [string, string];
// model.ts
export type DossierMode = "recruiter" | "preview" | "candidate-copy";
export interface DossierInput { mode: DossierMode; report: VerifyReport | null; prepared: Prepared | null; signed: SignedBundle | null;
  role: LoadedRole | null; invites: ReadonlyMap<string, InviteLogEntry> }
  // recruiter: report · preview: prepared · candidate-copy: prepared and signed. The last two read prepared.bundle through
  // readPayload, readIntegrity and readExhibits, so the candidate sees what the recruiter's verify will read
export interface Finding { text: string; cite: ExhibitLetter | "s6" | null }
export interface DossierModel {
  meta: { title: string; dossierNo: string; date: string; profiler: string; core: string; coreSha: string; reference: string; footerLeft: string; mode: DossierMode };
  banners: Array<{ kind: "flagged" | "dev" | "self-reported" | "trusted-env" | "unbound" | "no-company-key" | "preview" | "candidate-copy"; text: string }>;
  certificate: { name: string; readsAs: string[]; role: string | null; verdict: string; seal: SealInput; evidence: { detail: string; lifetime: string };
    integrity: { text: string; checks: string; serverBacked: string | null } | null; roleFit: RoleFit | null; why: Finding[]; watch: Finding[]; ask: Finding | null };
  ledger: LedgerGroup[];
  exhibits: { a: DayLoupe[] | null; b: DelegationExhibit | null; c: VerificationExhibit | null; d: HabitExhibit | null; e: ThenNow | null; f: RangeModel; flagged: boolean };
  findings: { strengths: Finding[]; watch: Finding[]; unknowns: string[] }; kit: KitModel | null;
  method: Array<{ section: string; rows: Array<[string, string]> }>; consent: { read: ReadSummary; json: string; bytes: number } | null }
export interface RangeModel { languages: BarItem[]; toolchains: BarItem[]; techCategories: BarItem[];
  tools: Array<{ tool: ToolId; window: string; sessions: number; prompts: number; actions: number; span: string }>;
  projects: Array<{ label: string; name: string | null; sessions: number; activeWeeks: number; tools: ToolId[]; inRepo: boolean }>; config: Array<[string, string]>; notShared: string[] }
export function sealState(i: DossierInput): SealInput["state"];
export function verdict(p: PayloadView): string;
export function buildDossier(i: DossierInput): DossierModel;
// test/kit/dossiers.ts
export type DossierKind = "expert" | "intermediate" | "novice" | "empty" | "flagged" | "unverifiable" | "self-reported" | "dev" | "sealed" | "unbound" | "odd-names" | "preview" | "candidate-copy";
export function dossierFixture(kind: DossierKind): { input: DossierInput; model: DossierModel };
  // personas through prepare → sign (testSigner, or a dev signer for "dev") → [seal] → verifyBytes; "empty" is scanResultOf([]);
  // "flagged" and "unverifiable" set the expert export's forensics (a failed C1, or every check n/a) before assemble.
  // Every fixture pins timeZone "UTC", a fixed createdAt and a fixed Rand (invite, ephemeral key, dev key). Each kind is built once and cached,
  // so the two-zone and build-twice tests compare the same input (pre-flight G18).
```

**Rules.**
- **Name.** The first of:
  - the invite log's name;
  - `subject.name`;
  - "Candidate <displayId>";
  - "Candidate".
- **Seal.**
  - **Label** (the first rule that applies; integrity is tested first, as spec §8.4 requires, pre-flight G24):
    - integrity `inconsistent` → flagged, "FLAGGED";
    - self-reported → provisional, "SELF-REPORTED";
    - dev → provisional, "DEV BUILD";
    - overall insufficient → provisional, "PROVISIONAL";
    - otherwise struck, with `BAND_LABEL[band]` upper-cased.

    An `unverifiable` band never blocks the struck seal (§13.15).
  - **Interval and coverage:** the overall's.
  - **`ringText`:** "AI LEVERAGE ASSAY · No. <dossierNo>".
- **Verdict.** In the third person, with Plan 3's rules:
  - choose up to 2 dimensions scored at medium or high, with a score of at least 60, by score and then `DIMENSIONS` order;
  - add the habit clause, from `exposure`;
  - join the clauses.

  The phrases:
  - leverage: "gets long runs of useful agent work from each prompt";
  - orchestration: "runs several agents at once";
  - verification: "checks agent edits with tests and builds";
  - steering: "steers early and rarely needs to correct";
  - context: "keeps agents briefed with maintained instructions and their own tools";
  - judgment: "matches the model to the size of the task";
  - delivery: "lands agent work as commits and PRs".

  The habit clauses: "has kept that up most weeks for {m} months", or "over {active} active weeks".

  The fallbacks:
  - "Not enough evidence for a reading yet: the exhibits show what was measured, and the interview kit covers the rest.";
  - "No dimension stands out yet: the interview kit starts where the evidence is thinnest."
- **Evidence lines.**
  - **detail:** "<sessions> sessions · <prompts> typed turns · <runs> subagent runs", from the `exposure.tools` detail rows, and from the sum of `exhibits.b.byType` for the runs.
  - **lifetime:** "<months> months · <ever> tools (<active90d> active) · <weeks> active weeks".
  - A section that was not shared reads "not shared".
- **Integrity line.**
  - `HEALTH_TEXT`. Wording:
    - consistent: "every check that could run passed";
    - consistent-with-notes: "nothing failed; the notes are worth asking about";
    - inconsistent: "at least one check failed; restored or copied history explains most failures, so ask before concluding";
    - unverifiable: "none of these tools keep server-issued ids that can be checked; that is neutral, not a problem".
  - `"<passed>/<ran> checks"`, where `ran` excludes `n/a` and `info`.
  - The share, labelled "server-backed (shown, never scored)".
  - Every check's reason, on every surface, is `reasonText(check.reason)`.
- **Coverage strip:** one cell per tool × window, holding the worst status of its rows in Plan 3's order: drift, present-undecodable, error, ok, empty, absent (Plan 3 pre-flight F24).
- **WHY.** At most 3, one per dimension: the `ok` components of medium- or high-confidence scored dimensions with `z > 0`, by `z` descending. Each reads "<label>: <evidence>", citing its exhibit.
- **WATCH.** At most 2:
  - first, the first failed or warned check (citing `s6`);
  - then components with `z ≤ −0.5`, lowest first.
- **ASK:** card 1 of the kit.
- **§4 Findings.**
  - Strengths: at most 5, with `z ≥ 0.5`.
  - Watch: at most 5 components with `z ≤ −0.5`, plus every failed or warned check.
  - Unknowns: each unscored dimension's note, then `UNKNOWN_FINDINGS`, which are:
    1. "Work outside these local histories: cloud agents, other machines, and tools this version cannot read."
    2. "The quality of the code itself: the history shows how agents were used, not whether the result was good."
- **Ledger.** `LEDGER_GROUPS`, with Plan 3 Task 11's notes for rows that are not scored. The component `value` is `componentValue`, with `cites: [cite]`.
  - The not-measured note cannot use `a.meta.repoSignals`, which the payload does not carry (pre-flight G12):
    - when the bundle ships exhibits, it reads `exhibits.c.repoSignals`: `off` → "not measured — repo signals were off", `git-missing` → "not measured — git was not found";
    - otherwise it is the one neutral note "not measured — repo signals were off or git was not found".
- **Exhibits.**
  - **When `exhibits` is null:** each of A–E is `null`, and the renderer shows its empty state.
  - **`flagged`** is set when any check failed. It puts ⚑ on every exhibit header, linking to §6.
- **Banners,** in this order:
  1. flagged;
  2. dev, self-reported or trusted-env;
  3. unbound;
  4. no-company-key;
  5. preview or candidate-copy.

  Their texts are the corresponding verify notes. Two are specific to their mode:
  - **preview:** "PREVIEW: nothing has been shared. These are the exact bytes that get signed.";
  - **candidate-copy:** "Candidate copy, not evidence. The recruiter checks the .aiprof file with their own copy of ai-profiler."
- **Modes.**
  - **recruiter:** includes `kit`, built with `generateKit`, and `roleFit`, from the invite's role.
  - **preview and candidate-copy:** include neither.
  - **preview:** fills `consent` with `prepared.read`, `fromUtf8(prepared.bytes)` and the byte count.
- **Method rows** (§6, chain of custody):
  - **file:** its name, bytes and SHA-256;
  - **signature:** the algorithm, key id, fingerprint and source;
  - **build:** the profiler, core, core commit and reference;
  - **invite:**
    - its display id and full id;
    - the role and its hash, with whether it matches;
    - the company fingerprint, with whether it matches this machine;
    - issued, expires and created at, "by the candidate's clock", and whether `createdAt` lay within the window;
  - **seal:** to `<kid>`, or "not sealed";
  - **timestamp:** "not timestamped in this version";
  - **payload:** the payload hash and the dossier number;
  - **exclusions;**
  - **sources and windows:** from `coverage`;
  - **checks:** id, label, status, reason and ask-about;
  - **weights:** `DIMENSION_WEIGHTS`, plus "the overall is a band with an interval, never a ranking" (a pinned negation, exempt from the copy lint, pre-flight G7);
  - `PRIVACY_STATEMENT`, `TRUST_STATEMENT` and the font licences.
- **Dates and numbers** go through `renderKit.fmt`, in UTC.

- [ ] **Step 1: Write the failing tests.**
  - **`copy`:**
    - `COMPONENT_COPY` covers every id in `COMPONENTS`;
    - no string in `src/dossier/copy.ts` matches `\byou(r)?\b`. The probe asks speak to the candidate, and `PRIVACY_STATEMENT` is second person by design, so both are exempt. So are exactly the candidate-facing "What you are sharing" and the pinned negation "nothing is ranked for you" (pre-flight G7);
    - `uncoveredChars` is `[]` over every copy string and every probe field;
    - no string contains "% match", "recommend", "rank" or "hire". The exceptions are exactly `TRUST_STATEMENT`'s last sentence and the pinned negations "never a ranking" and "nothing is ranked for you" (pre-flight G7);
    - in `test/contract/plan3.test.ts`, through `test/kit/core.ts`: every `COMPONENT_COPY[id].label` equals B's component label in `app/copy.ts`, and `BAND_LABEL` deep-equals B's (pre-flight G16).
  - **`model`,** for each `DossierKind`:
    - built twice, the models are deep-equal;
    - finite numbers only;
    - the same model under `TZ=Pacific/Auckland` and `UTC`;
    - no string other than `consent.json` and the font licence texts contains "NaN", "undefined", "null" or "[object" (Review Focus 5). JSON nulls and the OFL's "null and void" belong there.
  - **Per kind:**
    - empty → provisional, every row with its note, A–E null, and `why` empty;
    - unverifiable → struck, with the neutral integrity text;
    - flagged → flagged, its banner first, and `exhibits.flagged`;
    - a dev-build bundle with the "flagged" fixture's failed C1 → flagged, "FLAGGED", not "DEV BUILD" (pre-flight G24);
    - Delivery `not-measured`: with exhibits shipped, the note follows `exhibits.c.repoSignals`; without them, it is the neutral note (pre-flight G12);
    - self-reported → "SELF-REPORTED", with no integrity line;
    - dev → "DEV BUILD";
    - recruiter → has a kit and role fit;
    - preview and candidate copy → neither, and preview holds `consent.json` equal to the signing bytes;
    - odd-names → names kept raw (escaping is the renderer's job).
  - **Snapshot:** the intermediate model.
- [ ] **Step 2: Run** `bun test test/dossier` → FAIL.
- [ ] **Step 3: Implement** the modules and the fixture kit.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS. Commit the snapshot.
- [ ] **Step 5: Commit** `feat(dossier): the assay-certificate model — seal, verdict, ledger, findings, kit, chain of custody`.

---

### Task 17: Render the dossier, preview and candidate copy; wire them in

**Files:**
- Create: `src/dossier/{render,css}.ts`, `src/dossier/sections/{masthead,certificate,work,habit,range,findings,kit,method,consent}.ts`, `test/dossier/render.test.ts`, with a snapshot
- Modify:
  - `src/render/index.ts`: real `preview`, `candidateCopy` and `dossier`;
  - `src/cli/main.ts`: `Renderers.dossier`;
  - `src/cli/verify.ts`: writes the dossier;
  - `test/cli/verify.test.ts`.

**Interfaces:**
- **Consumes:** Task 16's `DossierModel` and `buildDossier`; `renderKit` (Task 14); Task 13's `runVerify` and `RENDERERS`.
```ts
export const DOSSIER_CSS: string;                     // A's layout; only the kit's custom properties and mark classes, no colour literals
export function renderDossier(m: DossierModel, o?: { fonts?: "embed" | "none" }): string;   // renderKit.page({ title, footerLeft, body, css })
// Renderers gains: dossier(r: VerifyReport, o: { role: LoadedRole | null; invites: ReadonlyMap<string, InviteLogEntry> }): string
```

**Rules.**
- **Chapters,** in this order, each a `<section class="chapter">`:
  - preview only: `consent`, "What you are sharing" (candidate-facing, so exempt from Task 16's `you` lint, pre-flight G7);
  - `s0` Certificate, `s1` How they work, `s2` Habit & trajectory, `s3` Range, `s4` Findings;
  - `s5` Interview kit, in recruiter mode only;
  - `s6` Method & chain of custody.

  The contents rail and chapter bar are the kit's.
- **§0** follows the spec's certificate mock:
  - the masthead: "AI LEVERAGE ASSAY", the No., the date and the version, plus the kit's theme and print buttons;
  - the banners above everything;
  - the h1 name, through `displayText`;
  - `reads as`, the role, the verdict (`t-serif-20`) and the seal;
  - EVIDENCE, INTEGRITY and ROLE FIT;
  - the ledger and its legend;
  - WHY, WATCH and ASK.

  Every mark is a kit icon or a CSS shape: no `→`, `⚑`, `①` or `☐` glyph.
- **The exhibits** use `figure` with the tag `<WINDOW> · n=<n>`:
  - **A:** `swimlanes`, typical then peak, behind a labelled `<details>`;
  - **B:** `delegationOutline`;
  - **C:** `verificationFunnel(FUNNEL_LABELS)`;
  - **D:** `habitLanes`;
  - **E:** `thenNowTable(THEN_NOW_LABEL)`;
  - **F:** `smallMultiples` of `barList`s, plus the tools, projects and config tables.

  An exhibit with no data uses its empty state, with `n` and `needs`.
- **§5,** the probe cards. Each card shows: PROBE n · DIMENSION, targets with `confidenceDots`, Because (with its cite), Ask, Listen, Flags, Follow, then `Score` with four CSS boxes and three write-in lines. Cards print `break-inside: avoid`. The walkthrough table lists `fp`, day, tool, size and the find command.
- **§6:** the method rows; the CSP, from `page`'s `body` callback; the font licences in `<details data-print="skip">`.
- **Preview:** the read-versus-shared table, then `<details data-print="skip">` holding a `<pre>` with exactly `consent.json` and its byte count.
- **`verify` output.**
  - For exit 0 or 3, and not `v1-html`: write `<cwd>/<input stem>.dossier.html`, or `--out`, at 0600.
  - Print `Dossier <tildified path>`, and open it unless `--no-open`.
  - A failure writes nothing.
  - The role comes from `loadRoles`; each of its errors goes to stderr as a `note:` line (pre-flight G25).

- [ ] **Step 1: Write the failing tests.**
  - **Audit,** for every `DossierKind` and a `synthStore(300_000)` dossier, with fonts embedded:
    - `cspOk`;
    - `externalRefs` is `[]`;
    - `styleAttrs` 0 and `inlineHandlers` 0;
    - `elements < 5000`;
    - `uncovered` is `[]`, except for the odd-names kind, where it holds only the characters of its injected names;
    - at most 1,500,000 bytes.
  - **Structure:**
    - the chapter ids in order;
    - one `h1`;
    - the landmarks;
    - every `figure` has one `figcaption`;
    - every `data-cite` and `#` target exists;
    - every `svg[role=img]` is labelled;
    - the raw-JSON `<details>` carries `data-print="skip"`.
  - **Modes:** preview and candidate copy contain neither `s5` nor "must-haves".
  - **Preview contract:** the `<pre>` text, unescaped, equals `fromUtf8(prepared.bytes)`, and the shown count equals its byte length.
  - **Escaping** (Review Focus 5): `subject.name` `<img src=x onerror=alert(1)>`, an invite-log name `"; } body{display:none} "`, and a second fixture named `</style><script>x()</script>`:
    - no `<img src=x` appears;
    - the `@bottom-left` content equals `cssString(footerLeft)`, and the `<style>` holds no raw `</style` or `<script` (as Plan 3 pre-flight F6);
    - RTL, emoji and CJK names appear, and `uncovered` lists only their characters.
  - **Text scan:** with tags stripped, and with the contents of `<pre>`, `<script>` and `<style>` and the OFL texts left out, no dossier's text contains `NaN`, `undefined`, `null` or `[object`.
  - **CSS:** `DOSSIER_CSS` has no `#hex`, `rgb(` or `hsl(`.
  - **Determinism:**
    - byte-identical under two time zones;
    - two renders identical;
    - a snapshot of the intermediate body with `fonts: "none"`.
  - **CLI:**
    - verify writes the dossier and opens it once;
    - an opener that throws leaves the exit code unchanged and prints the browser note;
    - `--no-open` opens nothing;
    - a flipped byte writes no dossier;
    - the v1 fixture writes no dossier.
- [ ] **Step 2: Run** `bun test test/dossier test/cli` → FAIL.
- [ ] **Step 3: Implement** the sections and the CSS. Swap `RENDERERS` to `renderDossier` in its three modes, and delete `src/render/raw.ts`.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS. Commit the snapshot.
- [ ] **Step 5: Commit** `feat(dossier): render the certificate, exhibits, kit and chain of custody; preview and candidate copy`.

---

### Task 18: The compare console — render, client, command

**Files:**
- Create: `src/console/{render,css,client}.ts`, `src/cli/compare.ts`, `test/console/render.test.ts`, `test/cli/compare.test.ts`
- Modify: `src/render/index.ts` and `src/cli/main.ts` (`Renderers.console`, and the `compare` dispatch)

**Interfaces:**
- **Consumes:** Task 11's `ConsoleModel`, `buildConsole`, `chooseRole`, `csvTable` and `csvFor`; Task 8's `verifyBytes`; `renderKit` (Task 14); Task 12's `Deps`.
```ts
export const CONSOLE_CSS: string; export const CONSOLE_CLIENT: string;   // ES2020; embeds csvFor.toString()
export function renderConsole(m: ConsoleModel, o: { date: string; fonts?: "embed" | "none" }): string;   // Renderers gains console: the same signature
export async function runCompare(o: { files: string[]; role: string | null; out: string | null; open: boolean }, d: Deps): Promise<number>;
```

**Rules.**
- **Header:**
  - "AI LEVERAGE ASSAY · COMPARE";
  - the role and its must-haves;
  - `note`;
  - `TRUST_STATEMENT`.
- **Overlay.** Seven small multiples, one per dimension, each a 0–100 rule (the kit ledger's scale, `x(s) = 8 + 3.84·s`). Each candidate is one interval line and one ◆, labelled with its row number, drawn with one `<path>` per class.
- **Table.** Its columns:
  - #, Candidate, Invite (with the duplicate mark), Authenticity, Integrity, Server-backed;
  - Overall (band and interval);
  - one fit pill per must-have;
  - the seven dimensions as `score [lo–hi]` plus confidence dots;
  - Notes, as a `<textarea data-key=dossierNo>`;
  - Shortlist, as a checkbox.

  Every header is a `<button data-sort>` that starts with `aria-sort="none"`. Rows come in import order. The table sits in `.scroll-x`.
- **Rejected files** follow the table: file, kind and reason.
- **`CONSOLE_CLIENT`:**
  - **sort:** stable, toggling ascending and descending, setting `aria-sort`;
  - **notes and shortlist:** in `localStorage` under `aiprof:<dossierNo>:notes` and `…:short`, inside try/catch;
  - **"Export CSV":** `csvFor` over the `jsonIsland("console-csv", csvTable(m))`, downloaded as a `data:text/csv` link named `ai-profiler-console-<date>.csv`.

  It uses no `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `import(`, `eval` or `innerHTML`.
- **The command:**
  1. Verify every file with one context. Each file is `stat`ed first, as in Task 13's verify, so one over `BUNDLE_READ_MAX` is `too-large` and never read (pre-flight G14).
  2. `loadRoles`, printing each of its errors to stderr as a `note:` line (pre-flight G25); then `chooseRole`, then `buildConsole`.
  3. Write `<cwd>/ai-profiler-console-<YYYY-MM-DD>.html`, or `--out`.
  4. Print one line per file (`<tildified file>: <banner line 1>`), then `Console <tildified path>` (pre-flight G8).

  Exit:
  - 1 when any file failed;
  - else 3 when any file was unverifiable;
  - else 0.

  The console still renders whatever verified.

- [ ] **Step 1: Write the failing tests.**
  - **5 bundles** (P3') → 5 rows, in import order; the audit is clean; no `aria-sort` other than `none` when the page loads.
  - **20 bundles across mixed roles** (Review Focus 5):
    - `elements < 5000`;
    - the audit is clean;
    - `roleDiffers` rows are marked;
    - duplicate invites are marked.
  - **The client:**
    - none of the forbidden tokens appears;
    - it contains `csvFor.toString()`.
  - **No colour literals** in `CONSOLE_CSS`.
  - **`compare` exit codes:**
    - 5 good files → 0;
    - plus a v1 file → 3;
    - plus a tampered file → 1, and the console is still written with the good rows;
    - every path in stdout is tildified, so no line holds the home path (pre-flight G8).
- [ ] **Step 2: Run** `bun test test/console test/cli/compare.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(console): offline compare console — overlaid intervals, explicit sorting, notes, shortlist, CSV`.

---

### Task 19: Canary harness — one rule per surface

**Files:**
- Create: `test/canary.surfaces.test.ts`

**Interfaces:**
- **Consumes:** `main`, `Deps`, `testSys`, `testSigner`, `allBuilders`, `makeRepo`, `CANARY` and `findCanaries`, plus `CcTranscript`, `ccSid` and `slug` from `test/kit/core.ts` for the extra transcript (pre-flight G13).
- **Setup.** As Plan 3 Task 14's:
  - a `fakeHome` with every builder;
  - two repos whose paths, file names and commit messages embed `CANARY.project`, `CANARY.prompt` and `CANARY.email`;
  - one extra Claude Code transcript inside repo 1;
  - `keys init`, and a sealing invite.
- **Runs:**
  1. an interactive candidate run, with the script `["2", "", "c"]` and a wrapped `preview` renderer that keeps every page it renders;
  2. the same run with `--yes --json`;
  3. `verify` on run 1's output;
  4. `compare` on the outputs of runs 1 and 2;
  5. `find` for one of run 1's fingerprints.

**The rules:**

| # | Surface | Rule |
|---|---|---|
| R1 | every preview page of run 1 | `findCanaries` is `[]` |
| R2 | the bundles: the sealed files, their opened plaintexts, and the `--json` sidecar | `[]` |
| R3 | the candidate copies | `[]` |
| R4 | the dossier | `[]` |
| R5 | the console | `[]` |
| R6 | logs: stdout and stderr of runs 1–4; only `tty` is exempt, under R7 (pre-flight G20) | `[]`; neither `h.root` nor the home path appears |
| R7 | the consent table (`tty` of run 1) and `find`'s stdout | a subset of {`project`, `slug`}, the folder-name canaries; never `path`, `email`, `host`, `secret`, `token`, `prompt`, `code` or `mcp` |

**Positive control:** R7's output must contain `CANARY.project`. This proves the canaries reached the run, so no rule passes vacuously.

- [ ] **Step 1: Write the rules.**
- [ ] **Step 2: Run** `bun test test/canary.surfaces.test.ts`. It passes if Tasks 9–18 hold. A failure is a privacy bug: fix it in the module that owns the surface, never in the rule.
- [ ] **Step 3: Commit** `test(privacy): canary rules for the preview, bundle, candidate copy, dossier, console, logs and consent table`.

---

### Task 20: Visual QA of the dossier and the console (controller gate)

**Files:**
- Create: `scripts/{qa-dossiers,visual-qa}.ts`, `test/scripts/qa-dossiers.test.ts`

**Interfaces:**
- **Consumes:** Task 16's `dossierFixture`; Tasks 17–18's renderers; Task 11's `buildConsole`.
```ts
// scripts/qa-dossiers.ts — synthetic fixtures only
export async function writeQaFiles(dir: string): Promise<Array<{ id: string; file: string; kind: "dossier" | "console" }>>;
  // one dossier per DossierKind (preview and candidate copy included), plus console-5 and console-20
// scripts/visual-qa.ts — CLI: bun scripts/visual-qa.ts --playwright <path of an installed playwright package> --in <dir> --out <dir>
export interface QaResult { file: string; theme: "dark" | "light"; width: 1440 | 390; png: string; checks: Record<string, boolean | number> }
```

**Checks,** for each file, theme and width, in Chromium with `colorScheme` emulated:
- no console errors;
- zero `securitypolicyviolation` events;
- every request is aborted and counted, and the count is 0 for anything other than `data:` and `about:`;
- `document.fonts.check()` holds for all three families;
- at 390 px, `scrollWidth ≤ innerWidth`;
- fewer than 5,000 elements;
- the theme button flips `data-theme`.

Per dossier, also: a light `page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true })` with more than one page.

Per console, also:
- clicking the Overall header reorders the rows, and sets `aria-sort`;
- a typed note and a ticked shortlist survive a reload;
- "Export CSV" downloads a file whose first line is the header.

Everything goes under `--out`, outside the repo, with a `summary.json`.

- [ ] **Step 1: Write the failing test** `qa-dossiers.test.ts`, which needs no browser. `writeQaFiles(tmp)` writes every file, each with a clean `auditHtml`: `cspOk`, no external refs, 0 style attributes, 0 inline handlers, fewer than 5,000 elements, at most 1,500,000 bytes, and `uncovered` holding only the odd-names fixture's injected characters (so `[]` everywhere else).
- [ ] **Step 2: Run** it → FAIL. **Step 3: Implement** both scripts. `visual-qa.ts` loads Playwright with a dynamic `import(pathToFileURL(<dir>/index.mjs))`, never from the repo.
- [ ] **Step 4: Run the QA.**
  - Write the files into a folder outside the repo.
  - Run Playwright from an install outside the repo: either the Playwright MCP tools, taking the same shots, or an existing package with `npx playwright install chromium`, with the network.
  - Every check must pass.
- [ ] **Step 5: Controller review (gate).** The controller opens every PNG and PDF.
  - **Hierarchy:** the seal, the verdict and the ledger are on the first screen at 1440. At 390, the name and the seal share a row, then come the verdict and the ledger.
  - **Seal states:** struck, provisional and flagged are each unmistakable. The flagged banner sits above everything.
  - **Type roles:** mono for measurements, Archivo caps for structure, Newsreader for interpretation. No fallback glyphs, except in the names the odd-names fixture injects.
  - **Contrast** in both themes.
  - **Layout:** no overlap or clipping. The console table scrolls inside its box, never the page.
  - **Print:** a break before each chapter, the footer, open details, kit cards with their write-in lines, light fills only, and no raw JSON.

  Issues go back to the owning task's files as fix-ups, and the QA runs again. The task is accepted only once the controller approves.
- [ ] **Step 6: Commit** the scripts and the test, never the images: `test(qa): visual QA of synthetic dossiers and consoles — two themes, two widths, print`.

---

### Task 21: Integration, compiled binary, local P3' acceptance, PR

**Files:**
- Create: `scripts/{build,profiler-smoke}.ts`, `test/{integration,compile}.test.ts`, `test/scripts/profiler-smoke.test.ts`
- Modify:
  - `package.json`: the script `"build": "bun scripts/build.ts"`;
  - `README.md`: one short note at the top, "v2.0.0 is in development on `main`; the latest release is v1.5.0", with a pointer to the spec. Plan 6 rewrites the rest.

**Interfaces:**
- **Consumes:** everything above, through `main` and `buildHost`.
```ts
// scripts/build.ts — the host target only; Plan 6 adds the five release targets and the CI secret
export async function buildHost(o: { outDir: string; signingKey?: string /* "<keyId>:<b64u seed>" */ }): Promise<string>;
  // bun build --compile src/cli.ts --outfile <outDir>/ai-profiler(.exe) [--define AIPROF_RELEASE_SIGNING_KEY=<JSON string>]
```
- **`scripts/profiler-smoke.ts`** runs `main()` on the real HOME. It uses a test signer generated at run time, and a temporary `AIPROF_HOME` and output folder under `$TMPDIR/ai-profiler-smoke-*`, a name outside the core's `aipr-*` glob. It removes them in `finally`.
  - It prints only `key=PASS|FAIL` lines, plus `elapsed=<s>` and `peak-rss-mb=<n>`, and exits 1 when any key is FAIL.
  - The keys:
    - `exit`;
    - `bundle-verifies`;
    - `sealed-opens-only-with-company-key`;
    - `tamper-detected` (200 seeded byte flips);
    - `other-invite-fails`;
    - `dossier-audit`;
    - `elements-under-5000`;
    - `bundle-under-400kb`;
    - `no-raw-paths` (neither the bundle nor the dossier holds the home path, a cwd from `raw.cwds` or a root from `raw.repos.roots`);
    - `preview-removed`;
    - `temp-clean`: no `$TMPDIR/aipr-scan-*` folder exists after the run that did not exist before it;
    - `under-60s` (scan through dossier) and `rss-under-1gib` (spec §10).

- [ ] **Step 1: Write the failing tests.**
  - **`integration.test.ts`,** the §8.1 loop through `main` on a `fakeHome` with every builder:
    1. `keys init`;
    2. `invite --role backend --name "Jordan Example"`;
    3. the candidate run with `--invite --yes`;
    4. `verify` → exit 0, and a dossier whose audit is clean, whose name is "Jordan Example", whose role fit has 3 items, and whose kit has a walkthrough with at least one fingerprint;
    5. one flipped byte → exit 1;
    6. a second company's keys → `sealed-other-key`;
    7. `compare` of 5 runs → 5 rows.
  - **`compile.test.ts`,** with a 180 s timeout. It generates a release key at test time, never on disk in the repo, then builds twice into a temp folder: once with `signingKey` and once without. With `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `XDG_*`, `TMPDIR`, `TEMP`, `TMP` and `AIPROF_HOME` pointed into a `fakeHome`:
    - `--version`;
    - `keys init` and `invite`;
    - a candidate run with `--yes --no-open`;
    - `verify` with `AIPROF_RELEASE_PUBKEYS` → exit 0, with "Signed by a key you trust", and a dossier whose fonts are embedded and whose audit is clean;
    - the binary built without the key → `verify` exits 3, with "DEV BUILD".

    The temp folder is removed afterwards. The Windows binary is `ai-profiler.exe`.
  - **`profiler-smoke.test.ts`,** with `HOME` and the rest pointed into a `fakeHome`:
    - exit 0;
    - every line matches `/^[a-z0-9-]+=(PASS|FAIL|\d+(\.\d+)?)$/`;
    - `expectNoCanaries(stdout + stderr)`;
    - no line contains `h.root`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Local acceptance (P3').**
  - Run `bun scripts/profiler-smoke.ts` against the real HOME, outside the sandbox if it blocks reads. Expect exit 0, and every line `PASS`.
  - `temp-clean=PASS` covers temp files: other processes' `aipr-home-*` folders do not count.
  - Keep only the pass/fail lines for the PR. No value, name or report from the owner's machine goes into the repo, the PR or a report.
- [ ] **Step 6: Commit, push, open the PR.** Do not merge: the final whole-branch review comes first.
```bash
git add -A && git commit -m "feat: v2 integration, compiled-binary smoke and P3' acceptance

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
# EtherHiding config scan → nothing printed
git fetch origin && git merge-base --is-ancestor origin/main feat/v2   # exit 0, else BLOCKED: the PR needs history shared with main (pre-flight G1)
git push
gh pr create --base main --title "AI Candidate Profiler v2: trust stack, consent, verify, dossier, interview kit, compare console" --body "<summary + P3' acceptance pass/fail lines + visual QA approved by the controller; no figures from the owner's machine>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch   # green on ubuntu, macos and windows, plus the security guard, which first runs here (pre-flight G4)
```
- [ ] **Step 7: After the merge** (following the final review): `git branch -D backup/feat-v2-pre-scrub`.
