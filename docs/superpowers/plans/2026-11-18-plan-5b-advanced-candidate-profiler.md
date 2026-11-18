# Plan 5b — AI Candidate Profiler v2, advanced: pairing recorder, RFC 3161 timestamps, `verify --brief`, `calibrate` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Paths.** `<A>` and `<B>` stand for the roots of the local checkouts of A (`build-with-bala/ai-candidate-profiler`) and B (`build-with-bala/ai-practice-report`). `<research>` stands for the private research notes, which are in neither repo. `<scratch>` stands for the session scratchpad, a folder outside both repos. The controller gives the concrete paths at dispatch.

**Goal:** Add the spec's P4 items that live in A (`ai-profiler`):
- the pairing-session recorder (`session start` / `session end`), which writes a signed `pairing.aiprof` that the recruiter renders as Exhibit P;
- optional RFC 3161 timestamps, the only network feature: opt-in, and it sends a hash and a nonce only;
- `verify --brief`, which runs the recruiter's own `claude` or `codex` on a minimal, structural digest, only after the recruiter has seen the exact bytes;
- `calibrate`, a rubric and outcome log that reports relationships with n and intervals, and suggests role-profile weights only at n ≥ 20, with no ranking and no decision.

**Architecture:**
- **Timestamps** run on A's own strict DER code plus `node:crypto`:
  - `src/trust/der.ts` reads and writes DER;
  - `src/trust/x509.ts` parses certificates and verifies their signatures;
  - `src/trust/tsp.ts` speaks RFC 3161 and verifies RFC 5652 tokens against pinned roots (`src/trust/tsa.json`).
  
  A stored token is in a pinned normal form (F12), so flipping any byte of a timestamped file still fails verification. `src/trust/tsa-client.ts` is the only caller of the injected `fetch`, which `src/cli/deps.ts` wires to `globalThis.fetch` (pre-flight J3).
- **The pairing recorder** runs no background process. `session start` notes the time. `session end` rescans, slices the scan to the window, and runs B's own `analyze` and `computeExhibits` on the slice, so Exhibit P matches exhibits A–C. It then signs (and seals) an `aiprof-pair/1` file (F10, F11). That file binds to the invite (its nonce keys every fingerprint), to the `.aiprof` file (by hash), and to the machine (a continuity set of session fingerprints).
- **`--brief`** builds an allowlisted digest from verified views only, shows the exact stdin bytes, asks, spawns the CLI in an empty temp folder, and sanitizes the reply. A pattern guard drops any line that reads as a recommendation.
- **`calibrate`** keeps a local JSON Lines log. Its report holds only aggregates: Spearman ρ with a seeded bootstrap interval, n and caveats.

**Tech Stack:**
- Bun 1.3.11, TypeScript 5 (`strict`), `bun test`.
- `node:crypto`: Ed25519, ECDSA (P-256, P-384), RSA PKCS#1 v1.5, SHA-1, SHA-256, SHA-384 and SHA-512, plus everything Plan 4 uses.
- B's core and viz kit at Plan 4's pin.
- `Bun.serve`, for the fake TSA in tests only.
- No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-17-ai-leverage-suite-v2-design.md` (repo-relative).
- **Implements:**
  - §8.2's timestamp;
  - the §8.3 menu item [5] and `--timestamp`;
  - §8.4's `verify --brief`;
  - §8.5's pairing recorder;
  - §8.6's calibration;
  - §13.1 and §13.9;
  - the A-side half of the §11 P4 acceptance.
- **Bind every task:** §2, §3, §6.7, §8, §10 and §13–§16.

**Builds on:**
- **Plan 4** (`docs/superpowers/plans/2026-11-18-plan-4-candidate-profiler-app.md`), as merged into A's `main`. It provides:
  - its Global Constraints, Spec values, Formats F1–F9 and builder's calls;
  - the modules its Interfaces blocks name.

  Task 1 pins these.
- **Plan 3** (`…/2026-11-18-plan-3-practice-report-app.md`): `renderKit` and `computeExhibits` with their exhibit types.
- **Plan 2** (`…/2026-11-17-plan-2-core-analysis.md`): `analyze`, `buildSessionTable`, `isAction`, `childType` and `modelExportId`.

**Research (private):** the notes `03-trust-privacy.md` and `04-product-workflow.md`. They sit outside both repos, and the controller knows where. Never commit them, and never quote values from them.

**Repo and branch:**
- **A** is `build-with-bala/ai-candidate-profiler`, which is public. The controller confirms that Plan 4's PR is merged into `main`. Task 1 then creates `feat/v2-advanced` from `main`, and Task 16 opens the PR into `main`, merged only after the final whole-branch review.
- **B** is read-only here: read its code in `node_modules/ai-practice-report/`, which is exactly the pinned commit.

**Out of scope:**
- **Plan 5a (B):** the new tools, WSL, the coach and history.
- **Plan 6:** release workflows, the release-key secret, docs polish, publishing, and the pin bump to B after Plan 5a, with its A-side list (Plan 6 Task 7, pre-flight J7).

## Global Constraints

Plan 4's Global Constraints, and through them Plan 2's and Plan 3's **Reports** rules, carry over. This plan adds the lines marked ✚ and amends the lines marked ✎.

**Network and processes**
- ✎ Plan 4's "No network requests" becomes this: A makes exactly one kind of network request, the F13 timestamp request.
  - It goes to a shipped authority's URL.
  - It is sent only after the candidate turns it on, with menu item [5] or `--timestamp`.
  - It carries the F13 bytes and nothing else.
- ✚ A's own code starts exactly two kinds of process; B's core also runs read-only git in session repos when repo signals are on (pre-flight J11):
  - the browser opener (Plan 4);
  - with `verify --brief`, after the recruiter confirms the exact bytes, the recruiter's own `claude` or `codex`.
- ✚ `test/repo/touchpoints.test.ts` (Task 1) pins which `src/` files may touch the network or spawn. Each task that adds such a file adds it to the allowlist in the same commit.
- ✎ `--timestamp`, `session`, `--brief` and `calibrate` stop being "not available in this version" in Tasks 7, 10, 14 and 15.

**What leaves a machine**
- ✚ **A pairing file** holds:
  - counts and enums;
  - keyed hashes (fingerprints);
  - relative bins;
  - the recording's start and end, which the interviewer witnessed, plus its start code.

  It holds no free text, name, label, path, session id, project key or tool-call name, and the canary harness proves it (Task 16).
- ✚ **The TSA** receives the 77 bytes of F13 and the candidate's IP address. The copy says so.
- ✚ **The recruiter's LLM** receives F17's bytes, built from verified views only. They never include:
  - names: the subject, the invite log, the company, revealed projects;
  - labels, invite ids, fingerprints or dossier numbers;
  - file names or dates.

**Legal posture**
- ✚ No surface ranks people or makes a hire, no-hire or advance recommendation. That includes the brief's text: lines matching `RECOMMENDATION` are dropped.
- ✚ `calibrate` prints aggregates only, never a per-candidate row. Every statistic shows its n and an interval or a "too few" note, and nothing it prints applies itself.

**Files**
- ✚ The new local files are `$AIPROF_HOME/pairing.json` (the open recording, deleted by `session end`) and `$AIPROF_HOME/calibration.jsonl`. Both are 0600, in a 0700 folder.
- ✚ The brief works in a fresh 0700 folder under the OS temp folder, named `ai-profiler-brief-*`. It is removed in `finally`.

**Crypto and parsing**
- ✚ Use `node:crypto` only. DER, X.509 and CMS parsing are A's own code (`src/trust/{der,x509,tsp}.ts`), with no library.
- ✚ Every random byte comes from the injectable `Rand`, including TSA nonces and start codes.

**Tests and scripts**
- ✚ The fake TSA listens on `127.0.0.1` only.
- ✚ No test reaches a public TSA or an LLM. `scripts/{tsa-roundtrip,pairing-smoke,brief-smoke}.ts` touch the network or a real CLI and run by hand only, with `dangerouslyDisableSandbox: true`.
- ✚ The fake CLIs are POSIX scripts, so their tests skip on win32.

**Public repo:** ✚ this plan and everything it adds hold no value from the owner's machine. Paths are repo-relative.

## Spec values (verbatim — tasks cite these and never restate them differently)

- **§8.2:**
  - "Signature over RFC 8785 (JCS) canonical JSON of everything except `signature`/`timestamp`."
  - "**Timestamp (opt-in network):** RFC 3161 request over the payload hash to a public TSA; stores the token; `verify` checks the CMS signature and that `genTime ≤ invite.exp`. Off by default; the candidate is told exactly what is sent (a hash + nonce)."
- **§8.1:**
  - "interview (45'): 10' walkthrough of a fingerprinted session · 15' kit probes · 20' pairing"
  - "candidate: ai-profiler session start/end ─► pairing.aiprof (Exhibit P)"
  - "ai-profiler calibrate ─► rubric + outcome log → role-profile weight suggestions"
- **§8.4:** "`verify --brief` (opt-in): the **recruiter's** own `claude -p`/`codex exec` drafts prep notes and extra probes from the verified, sanitized payload; labelled as AI-drafted; never alters scores."
- **§8.5:** "**Pairing recorder:** `ai-profiler session start --invite <token>` snapshots source cursors; `session end` analyses only new events → `pairing.aiprof` (signed) → Exhibit P: agents run, delegation, verification loop during the live exercise. Pairing exercise packs are stretch (P6)."
- **§8.6:** "**Calibration log:** `~/.ai-profiler/calibration.jsonl` (rubric scores per probe, decision, optional later outcome); `calibrate` reports per-dimension relationships with n and caveats, and suggests role-profile weight changes only when n ≥ 20."
- **§13.1:** "Offline-only by default in both; the only network feature is A's opt-in RFC 3161 timestamp (hash + nonce only)."
- **§13.9:** "Recruiter-side `--brief` (own LLM) allowed in A; candidate-side coach only in B, never scored."
- **§2 anti-goals:**
  - "A hire/no-hire recommendation, or ranking candidates by one number (NYC LL144 / EU AI Act exposure; also just wrong)."
  - "Any network request by default; any opt-in network use that sends more than a hash."
  - "Privacy or trust claims that overstate what the code does."
- **§3:**
  - "**Legal posture:** evidence + human rubric; the tool never decides."
  - "only the live walkthrough/pairing ties evidence to a person."
- **§11 P4 acceptance (A's half):** "pairing recorder produces Exhibit P; TSA round-trip verified against a public TSA (manual, opt-in)".

**Copy pinned by this plan** (exact):
- **`PRIVACY_STATEMENT[1]`** (Plan 4's sentence 2), amended in Task 7: "It keeps none of the text, never opens credential files, and makes no network requests unless you turn on the timestamp, which sends only a hash of your file and a random number to a public timestamp authority."
- **`TSA_NOTICE`:**
  - "The timestamp sends a 77-byte request to {name} ({url}): a SHA-256 hash of the file you are about to send, and a random number."
  - "The authority also sees your IP address and the time. It never receives the file or anything in it."
- **`EXPLAIN_NETWORK`** (`--explain`'s network line, pre-flight J4): "Network: none, unless you turn on the timestamp ([5] or --timestamp): 77 bytes to a public timestamp authority"
- **`PAIRING_NOTICE`:**
  1. "session start only notes the time. At session end, ai-profiler reads your local agent history for the time in between and keeps only its shape: which agent tools ran, when, how many actions and subagents, and whether checks passed."
  2. "It never keeps your prompts, replies, code, file names, paths or project names."
  3. "The pairing file also lists one-way fingerprints of the sessions already on your computer, so the interviewer can check it is the computer your .aiprof came from."
  4. "Nothing is shared until you approve the file at session end and send it yourself."
- **`BRIEF_LABEL`:** "AI-drafted by {cli} ({model}) on the recruiter's computer, from the verified data shown below (input SHA-256 {sha16}). It is not evidence: it changes no score and makes no decision."
- **`CALIBRATE_CAVEATS`:**
  1. "Outcomes exist only for people who were advanced, which narrows the range and weakens every relationship shown."
  2. "These are correlations in a small sample of your own past interviews: they are not causes, and they are not a model of candidates."
  3. "This log holds no demographic data, so it cannot check for adverse impact; your hiring process still needs that review."
  4. "Nothing here ranks candidates or makes a decision; suggested weights change nothing until you edit a role file yourself."
- **`AGENDA[2]`** (Plan 4's), amended in Task 12: "20 min: pairing on a real task with their own agent setup, recorded with ai-profiler session start and session end."

## Formats (pinned; every vector must reproduce exactly)

**F5′ — the bundle, amended for timestamps.**
- `timestamp` is `null` or a timestamp member (F12). Every other F5 rule stands.
- **Signing input:** `jcsBytes` of the bundle without `signature` and `timestamp`. The key `"timestamp"` therefore never appears in it. Plan 4 (G2) already uses this rule; V7′/V8′ = V7/V8 (pre-flight J14).
- **File:** `jcsBytes(bundle)`, including the member when present.
- **Sealing (F6)** is unchanged, because `timestamp` is already one of its eight plaintext keys.
- **The candidate run's order:** sign, then timestamp, then seal.

**F9′ — classifying input.** Insert before F9's step 6: an object with `format: "aiprof-pair/1"` is:
- `sealed-pairing` when `sealed` is an object;
- else `pairing` when `signature` is an object;
- else `unknown` (`bad-format`).

`InputKind` gains `"pairing"` and `"sealed-pairing"`.

**F10 — the pairing bundle `aiprof-pair/1`.** Exactly these keys:

| key | value |
|---|---|
| `format` | `"aiprof-pair/1"` |
| `meta` | F5's `meta`, with F5's rules (including `devKey`) |
| `invite` | the invite token; never `null` |
| `bundle` | `{ fileSha256: 64 lower-case hex }` (the SHA-256 of the `.aiprof` file the candidate named), or `null` |
| `window` | `{ startedAt, endedAt, code }`: both times are `YYYY-MM-DDTHH:MM:SSZ` with `0 < endedAt − startedAt ≤ 4 h`; `code` matches `^[0-9A-F]{4}-[0-9A-F]{4}$` |
| `continuity` | `{ fps, more }`: `fps` is at most 4,096 strings of 12 lower-case hex, sorted ascending and unique; `more` is an integer ≥ 0 |
| `sessions` | at most 12 of `{ fp: 32 hex (F7), tool: ToolId, kind: "new" or "resumed", size: S, M, L or XL }`, sorted by `fp` |
| `exhibit` | Exhibit P: `{ loupe, delegation, verification, totals }` (Task 8) |
| `timestamp` | `null` or F12 |
| `signature` | as F5 |
| `sealed` | `null` |

- **Signing input:** `jcsBytes` without `signature` and `timestamp`.
- **File:** `jcsBytes(bundle)`.
- `meta.keyId` equals `signature.keyId`.
- **`pairingNo`** is the first 8 hex characters of the signing input's SHA-256, upper-cased, written `XXXX-XXXX` (as F8).

**F11 — the sealed pairing.** F6 exactly, except:
- `info = ascii("aiprof-pair/1 seal v1")`;
- the plaintext's keys are `bundle`, `continuity`, `exhibit`, `sessions`, `signature`, `timestamp` and `window`;
- opening rebuilds `{ format, meta, invite, ...inner, sealed: null }`.

**F12 — the timestamp member and its token.**
- **Member:** exactly `{ tsa, genTime, token }`.
  - `tsa` is an authority id (`^[a-z][a-z0-9-]{1,31}$`).
  - `genTime` is the token's genTime, truncated to the second, as `YYYY-MM-DDTHH:MM:SSZ`.
  - `token` is the F1 base64url of the TimeStampToken (a CMS `ContentInfo`), at most 65,536 bytes, in normal form.
- **The imprint** is the SHA-256 of the signing input: the payload hash of F8, or the pairing's.
- **Normal form:**
  - `ContentInfo{ id-signedData, [0] SignedData{ version, digestAlgorithms, encapContentInfo, [0] certificates, signerInfos } }`;
  - `certificates` holds exactly the verified path: the signer first, then each issuer in turn, ending with the cert that a pinned root issued. The root itself, its copies and its cross-certificates never stay.
  - There is no `[1]` CRL set and no `unsignedAttrs`.
  - Every other byte is copied from the TSA's token, with lengths re-encoded minimally.
  - The client normalizes before storing (Task 7); `verify` requires the normal form.
- **Verification**, `verifyToken(token, { imprint, nonce?, trust, normalForm })`. Each check gives the failure code in brackets.
  1. F14 DER [`malformed`].
  2. `ContentInfo` has exactly 2 elements, with OID id-signedData [`malformed`].
  3. `SignedData`:
     - version 3;
     - `digestAlgorithms` has exactly one element, equal to the signer's;
     - `encapContentInfo` is `{ id-ct-TSTInfo, [0] OCTET STRING }` [`not-tstinfo`];
     - `signerInfos` has exactly 1 element [`malformed`].
  4. `TSTInfo`:
     - version 1;
     - `messageImprint` is sha256 (parameters absent or NULL) with exactly `imprint` [`imprint-mismatch`];
     - when `nonce` is given, its INTEGER content bytes equal it [`nonce-mismatch`].
  5. `SignerInfo`:
     - version 1, with `sid = issuerAndSerialNumber` (a version 3 SKI `sid` is `unsupported-algorithm`);
     - `digestAlgorithm` is sha256, sha384 or sha512 (sha1 is `weak-digest`);
     - `signedAttrs` are present.
  6. The attributes have unique types, each with a SET of exactly one value:
     - `contentType` = id-ct-TSTInfo;
     - `messageDigest` = H(the TSTInfo octets) [`digest-mismatch`];
     - at least one of `signingCertificate` (ESSCertID, whose certHash is SHA-1) and `signingCertificateV2` (ESSCertIDv2, sha256 when the hash algorithm is absent) [`missing-attribute`].
  7. **The signer cert** is the one certificate in the token whose hash equals the first ESSCertID's `certHash` (RFC 2634: later ids are ignored) [`no-signer-cert`].
     - When both attributes are present, both first ids name the same cert.
     - When the first id carries `issuerSerial`, its directoryName and serial equal the cert's.
     - `sid`'s issuer Name bytes and serial bytes equal the cert's [`sid-mismatch`].
  8. **The signer's EKU** is present, critical, and exactly `[id-kp-timeStamping]` [`not-a-tsa-cert`]. Its validity covers genTime [`outside-cert-validity`].
  9. **The signature** is over `signedAttrs` with its first byte changed from `0xA0` to `0x31`, verified with `verifySig` [`bad-signature`; an unknown algorithm is `unsupported-algorithm`]:
     - `rsaEncryption` takes the digest algorithm's hash;
     - `sha{256,384,512}WithRSAEncryption` and `ecdsa-with-SHA{256,384,512}` take their own hash;
     - Ed25519 takes none, and the digest must be sha512 (RFC 8419).
  10. **The path:** from the signer, repeatedly:
      - if a pinned root's subject bytes equal the current cert's issuer bytes and `verifyCertSig(current, root.spki)` holds → anchored at that root's authority;
      - else push the unique token cert whose subject bytes equal the issuer bytes, that is a CA (`basicConstraints` cA true), that covers genTime, and that verifies the current cert's signature;
      - stop at a depth of 4 [`untrusted`].
  11. **Normal form** (when `normalForm`): the token equals `normalizeToken(token, path)` byte for byte [`not-normal-form`].
- **In a bundle,** `verify` also requires:
  - `check.authority === tsa`;
  - `iso(check.genTime) === genTime`;
  - with an invite: `iat − 300 s ≤ genTime`, and `genTime ≤ exp` for an `aiprof/2` bundle (pairings have no upper bound) [`outside-invite-window`].

  Any other failure is `bad-timestamp`, carrying the code.

**F13 — the TimeStampReq and its HTTP request.**
- **DER:** `SEQUENCE { INTEGER 1, SEQUENCE { SEQUENCE { OID sha256, NULL }, OCTET STRING imprint }, INTEGER nonce, BOOLEAN TRUE }`. It has no `reqPolicy` and no extensions, and is 77 bytes.
- **Nonce:** `rand(16)` with `byte0 = (byte0 & 0x3f) | 0x40`, so the INTEGER is positive, minimal and always 16 bytes.
- **HTTP:**
  - `POST <authority.url>`, with exactly the headers `content-type: application/timestamp-query`, `accept: application/timestamp-reply` and `user-agent: ai-profiler`;
  - `redirect: "manual"`, where any 3xx is a failure;
  - a 15 s timeout;
  - a reply body of at most 65,536 bytes, read with a running count;
  - the reply is HTTP 200 with a `TimeStampResp` whose `PKIStatusInfo.status` is 0 or 1.

**F14 — DER rules** (`src/trust/der.ts`). Any other input is a `DerError` that names the offset.
- Input at most 65,536 bytes, depth ≤ 32, exactly one TLV, and no trailing bytes at any level.
- Definite lengths only. Lengths of 128 or more use the minimal long form, and lengths below 128 use the short form.
- Low tag numbers only (< 31).
- SEQUENCE and SET are constructed. Every other universal type is primitive.
- INTEGER is minimal (no redundant leading `00` or `FF`). BOOLEAN is `00` or `FF`. NULL is empty. A BIT STRING has 0 unused bits.
- OID arcs are minimal (no `80` lead byte).
- **GeneralizedTime** is `YYYYMMDDHHMMSS[.f+]Z`, with no trailing zero in the fraction. **UTCTime** is `YYMMDDHHMMSSZ`: `YY` < 50 is 20YY, else 19YY.

**F15 — the pairing state, `$AIPROF_HOME/pairing.json`.**
- Exactly `{ v: 1, code, startedAt: epoch ms, invite: token, bundle: { fileSha256 } | null, tools: ToolId[] | null }`.
- It is written by `session start` and deleted by `session end`.
- Any other shape is "the open recording's state is damaged; run ai-profiler session end --discard".

**F16 — the calibration log, `$AIPROF_HOME/calibration.jsonl`.** One JSON object per line.
- **`rubric`:** `{ v: 1, kind: "rubric", at: "YYYY-MM-DD", dossierNo, role: id | null, roleHash: 64 hex | null, dims, probes, decision }`.
  - `dims` holds 7 entries in `DIMENSIONS` order, each `{ id, status, score, lo, hi, confidence }`.
  - `probes` holds 1–20 entries, each `{ card, probeId, dimension, score: 1–4 }`.
  - `decision` is `"advanced"`, `"not-advanced"`, `"withdrew"` or `null`.
- **`outcome`:** `{ v: 1, kind: "outcome", at, dossierNo, decision: … | null, rating: 1–4 | null, months: 1–120 | null }`. `rating` and `months` are set together.
- **Merge, per `dossierNo`:**
  - the last rubric line in file order;
  - the last non-null decision among its rubric and outcome lines;
  - the last rating, with its months.
- **Damaged lines:** malformed lines and outcomes with no rubric are skipped and counted.
- **Names:** no entry ever holds a name, label, invite id or fingerprint.

**F17 — the brief's bytes.**
- **Prompt (stdin):** `BRIEF_INSTRUCTIONS.join("\n") + "\n\nDATA:\n" + jcs(digest) + "\n"`, at most 32,768 bytes. `BRIEF_INSTRUCTIONS` are these exact lines:
  ```
  You help an interviewer prepare for an interview about how a candidate works with AI coding agents.
  The DATA below is verified, structural evidence from the candidate's own agent history: scores with intervals, evidence counts and integrity checks. It holds no text written by the candidate.
  Write short preparation notes and at most four extra interview questions.
  Rules:
  - Use only the DATA. When it does not say, write "unclear from the data".
  - Do not recommend hiring, rejecting or advancing the candidate, do not rank or compare people, and do not judge character.
  - Each question names one dimension id from the DATA and says what a strong answer would show.
  - Reply with one JSON object only: {"notes": [string], "probes": [{"dimension": string, "ask": string, "listen": string}], "cautions": [string]}.
  ```
- **`BRIEF_SCHEMA`:**
  ```json
  {"type":"object","additionalProperties":false,"required":["notes","probes","cautions"],"properties":{
   "notes":{"type":"array","items":{"type":"string"}},
   "probes":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["dimension","ask","listen"],"properties":{
     "dimension":{"type":"string","enum":["leverage","orchestration","steering","verification","delivery","context","judgment"]},
     "ask":{"type":"string"},"listen":{"type":"string"}}}},
   "cautions":{"type":"array","items":{"type":"string"}}}}
  ```
  It is kept to the keywords both CLIs accept. A enforces the limits after parsing.
- **Argv,** where `<dir>` is the brief's temp folder and also the `cwd`. Both are Plan 5a Task 19's `AGENTS` argv, token for token, with A's schema in place of the coach's and, for codex, `--output-last-message` added (pre-flight J6):
  - **claude:** `[<abs path>, "-p", "Follow the instructions on standard input.", "--output-format", "json", "--tools", "", "--disallowedTools=mcp__*", "--strict-mcp-config", "--disable-slash-commands", "--permission-mode", "dontAsk", "--max-turns", "3", "--no-session-persistence", "--json-schema", jcs(BRIEF_SCHEMA)]`;
  - **codex:** `[<abs path>, "exec", "--json", "--output-schema", "<dir>/brief.schema.json", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "--color", "never", "-c", "web_search=disabled", "-c", "features.shell_tool=false", "-c", "features.view_image=false", "-c", "features.apps=false", "-c", "features.multi_agent=false", "-c", "features.hooks=false", "-c", "history.persistence=none", "--output-last-message", "<dir>/brief.reply.txt", "-"]`.
- **Env,** on top of `vars`, as Plan 5a Task 19's table (pre-flight J6): claude gets `ENABLE_CLAUDEAI_MCP_SERVERS=false`, `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1`, `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` and `CLAUDE_CODE_SKIP_PROMPT_HISTORY=1`; both CLIs get `NO_COLOR=1`. Re-check the flags and variables against Plan 5a Task 19's sources before coding.

**Vectors.** The keys are the published RFC vector keys (`VEC`, as in Plan 4).

| id | input | expected |
|---|---|---|
| V7′ | Plan 4's V7 input, signed under F5′ | signing input 1204 bytes, SHA-256 `9282a29039f7641355b7dd3d08bb19095f0ba7d7e6f3764b77bd6d97efaac575`; sig `xboFqdBnign8mQMslWGpHAzzOZ3kdrv-CP5h2crNAb1Il0wYVBlfnUkt3LKvESQAd-dAVMy3rPrcGOcK_sgEDg`; file 1370 bytes, SHA-256 `a68461f60fddb4a8dbcdc9ca7c3265241c6320e2f3c1586c1d3bf02a7cdfb414`; `dossierNo` `9282-A290` |
| V8′ | V7′ sealed to bob, ephemeral alice | key, iv and SHA-256(aad) as Plan 4's V8; SHA-256(plaintext) `47bfe8a269abc4156bf99a4f5186c799c5556c2cc9692afff35e6b8439e42792`; ct 561 bytes, tag `779b49da1986483d750f0899e4f05228`; file 1691 bytes, SHA-256 `7d339148e66e59b2ce285ff839fff87749b8f373a5efc53eab92013e5816725f` |
| T1 | `tsaRequest(V7′ payload hash, tsaNonce(rand → 000102…0f))` | 77 bytes: `304b0201013031300d0609608648016503040201050004209282a29039f7641355b7dd3d08bb19095f0ba7d7e6f3764b77bd6d97efaac5750210400102030405060708090a0b0c0d0e0f0101ff`, SHA-256 `588aba74b6cb8312bb7fef9add164531eae146fb50527e607fa70db9ea0b2aed` |
| V10 | the pairing below, `VEC.t2` under `test-39f713d0` | signing input 1685 bytes, SHA-256 `a1b78db845f7bba3184abd96671a83cc633a0f68458a6989a78eb8fbae8eee66`; sig `Uggl-ppTmmghlg7rX4jPUQWm5Esp7vsjQQn_hT-CkITfEGrX4ECMZYnyCN_f_qtpx4pc5Efezkv2H5jPJO35Ag`; file 1851 bytes, SHA-256 `62993ba1e67742a4226d3aca476aaf23539200586a8ebafb5e03369c7c0ea91a`; `pairingNo` `A1B7-8DB8` |
| V11 | V10 sealed to bob, ephemeral alice (F11) | key `5f405c295e64de802e96b34b3829bec503dda162a0e059cb9622cde1e1d3f7b4`, iv `febac4c87b7defe30f06ed97`; SHA-256(aad) `d51c4178110c7e2ed75878b8710471179f47fe0f89d5c56cd659dcf3b239a374`; SHA-256(plaintext) `d59ec5d71cab06bac2b60ade19ae16e9187733b0cee10376da791ac829edde72`; ct 1037 bytes, tag `882eb04f551e7a651bb24e6368be2e05`; file 2331 bytes, SHA-256 `da631ecab64cada67cf1d17a3036aa0105d28cccca1c7d2beb607305204e3648` |

**V10 input.** `<V6>` is Plan 4's V6 token. `bundle.fileSha256` is V7′'s file hash, and the one continuity entry is V7's fingerprint's first 12 hex characters, so linking V10 to V7′ gives continuity 1 of 1. The window lies after V6's expiry on purpose.
```json
{"format":"aiprof-pair/1","meta":{"profiler":"2.0.0-dev","core":"1.0.0","coreSha":"0000000000000000000000000000000000000000","createdAt":"2026-12-01T11:03:20Z","keyId":"test-39f713d0","build":"release"},
 "invite":"<V6>","bundle":{"fileSha256":"a68461f60fddb4a8dbcdc9ca7c3265241c6320e2f3c1586c1d3bf02a7cdfb414"},
 "window":{"startedAt":"2026-12-01T10:42:00Z","endedAt":"2026-12-01T11:03:00Z","code":"A1B2-C3D4"},
 "continuity":{"fps":["c1f6af6c44d0"],"more":0},"sessions":[],
 "exhibit":{"loupe":null,"delegation":{"root":null,"byType":{},"sessionsWithChildren":0,"n":0},
  "verification":{"editTurns":0,"checked":null,"failing":0,"closed":null,"medianFixCycles":null,"guardrails":null,"landed":null,"reworked":null,"prsPerWeek":null,"repoSignals":"off"},
  "totals":{"spanMs":1260000,"activeMs":0,"sessions":0,"resumed":0,"byTool":{},"byOrigin":{},"humanTurns":0,"actions":0,"subagents":0,"byChildType":{},"background":0,"maxDepth":0,
   "edits":0,"linesAdded":0,"linesRemoved":0,"checks":{"run":0,"passed":0,"failed":0,"byKind":{}},"interrupts":0,"corrections":0,"denials":0,"models":[]}},
 "timestamp":null,"sealed":null}
```

**OIDs** (full TLV hex):

| name | dotted | TLV |
|---|---|---|
| id-signedData | 1.2.840.113549.1.7.2 | `06092a864886f70d010702` |
| id-ct-TSTInfo | 1.2.840.113549.1.9.16.1.4 | `060b2a864886f70d0109100104` |
| contentType | 1.2.840.113549.1.9.3 | `06092a864886f70d010903` |
| messageDigest | 1.2.840.113549.1.9.4 | `06092a864886f70d010904` |
| signingCertificate | 1.2.840.113549.1.9.16.2.12 | `060b2a864886f70d010910020c` |
| signingCertificateV2 | 1.2.840.113549.1.9.16.2.47 | `060b2a864886f70d010910022f` |
| sha1 · sha256 · sha384 · sha512 | 1.3.14.3.2.26 · 2.16.840.1.101.3.4.2.1 · .2 · .3 | `06052b0e03021a` · `0609608648016503040201` · `…0202` · `…0203` |
| rsaEncryption · sha256WithRSA · sha384WithRSA · sha512WithRSA · RSA-PSS | 1.2.840.113549.1.1.1 · .11 · .12 · .13 · .10 | `06092a864886f70d010101` · `…01010b` · `…01010c` · `…01010d` · `…01010a` |
| ecdsa-with-SHA256 · ecdsa-with-SHA384 · ecdsa-with-SHA512 | 1.2.840.10045.4.3.2 · .3 · .4 | `06082a8648ce3d040302` · `…0303` · `…0304` |
| Ed25519 | 1.3.101.112 | `06032b6570` |
| extKeyUsage · basicConstraints · id-kp-timeStamping | 2.5.29.37 · 2.5.29.19 · 1.3.6.1.5.5.7.3.8 | `0603551d25` · `0603551d13` · `06082b06010505070308` |

**Shipped authorities.** The root fingerprints are public constants (SHA-256 of the root certificate's DER).

| id | name | url | root (subject CN) | root SHA-256 |
|---|---|---|---|---|
| `digicert` (default) | DigiCert | `http://timestamp.digicert.com` | DigiCert Trusted Root G4 | `552f7bdcf1a7af9e6ce672017f4f12abf77240c78e761ac203d1d9d20ac89988` |
| `sectigo` | Sectigo | `http://timestamp.sectigo.com` | Sectigo Public Time Stamping Root R46 | `4941b001b8a97e961b7817c9d9e960ec4b056bfc915a8c1aabf6ef6b3ac046a5` |
| `sslcom` | SSL.com | `http://ts.ssl.com` | SSL.com Root Certification Authority RSA | `85666a562ee0be5ce925c1d8890a6f76a87ec16d4d7d5f29ea7419cf20123b69` |

**Statistics vectors** (Task 15):
- **S1:** `spearman([10,20,30,40,50], [1,3,2,4,4])` = `0.872081599272381`.
- **S2:** `spearman([1,2,3,4,5], [2,2,2,2,2])` = `null`.
- **M1:** `mulberry32(0x5eed)`'s first three values = `0.710032036994`, `0.286336648511`, `0.951902626548` (to 12 decimals).
- **W1:** `suggestWeights` on (0.40, 0.35, 0.25), with ρ (0.6, 0, −0.2) and n 20 each, gives (0.50, 0.30, 0.20).
- **W2:** ρ (0.31, 0.12, −0.05) with n 26 gives (0.45, 0.35, 0.20).
- **W3:** (0.35, 0.35, 0.30), with ρ (null, 0.5, 0.5) and n 30, gives (0.30, 0.40, 0.30).
- **W4:** (0.90, 0.10), with ρ (0.8, −0.9) and n 200, gives (0.95, 0.05).

## Builder's calls (binding here; spec §14 leaves them open)

1. **What gets timestamped** is the signing input's SHA-256, the "payload hash" of §8.2. The token sits outside the signature, so a timestamp can be added after signing or stripped. Stripping leaves a valid file with no timestamp.
2. **Normal form for tokens.** A token's certificate set, CRLs and unsigned attributes are not covered by any signature. The client drops everything off the verified path, and `verify` accepts only that form. So every byte of a timestamped file stays tamper-evident, as P3' promises.
3. **Anchors** are self-signed roots, matched by issuer-name bytes plus a signature check.
   - Real chains carry cross-signed copies of their roots (DigiCert, Sectigo) or the root itself (SSL.com). Both drop out under normal form.
   - Both ESSCertID versions occur in practice. Only the signature digest must not be SHA-1, which leaves out Apple's TSA.
   - Revocation is not checked (offline). The method row says so.
4. **Shipped authorities:** DigiCert (the default), Sectigo and SSL.com. Together they cover RSA and P-256 signers, SHA-256 and SHA-384 digests, and ESSCertID v1-only, v2-only and both. Recruiters may add roots with `AIPROF_TSA_ROOTS`, but the URLs come only from the shipped list.
5. **genTime after expiry.** The client never attaches a token whose genTime is after the invite's `exp`: it treats such a token as a failed request. So `verify` treats it as a hard failure, as §8.2 says.
6. **The pairing cursor** is the start instant. There is no background process, and no byte cursor, which would need core changes in B (Plan 5a's repo). `session end` rescans, within the spec's 60 s budget, and keeps only events with `startedAt ≤ ts ≤ endedAt`. A recording lasts at most 4 h.
7. **Exhibit P comes from the core.** It is `computeExhibits(slice, analyze(slice))` plus A's own totals. They are computed in a fixed-offset zone (`pairingZone`) that keeps the window on one local day, so a session across midnight still gives one loupe. The loupe holds only relative bins.
8. **Continuity** is the 12-hex prefixes of F7 fingerprints of F7 candidates (no exclusions) that started before the window. It keeps the 4,096 latest. It works for sealed bundles, which the candidate cannot open. A count of 0 is a ⚑ note, never a failure. Only sessions whose ids pass `isStableId` count, here and in F7's picks, until Plan 6 swaps in core's `stableSessionId` (pre-flight J9).
9. **Pairing windows:** a pairing file needs only `createdAt ≥ iat − 300 s`. Interviews often happen after the invite has expired.
10. **The brief** runs only on exit-0 reports, and only after a TTY confirmation. Its digest is an allowlist, and its reply is cut to fixed limits, cleaned to font-covered characters and screened by `RECOMMENDATION`. On win32, it runs a CLI only when it resolves to an `.exe`.
11. **Calibration** uses Spearman ρ with average ranks for ties, and a B = 1000 percentile bootstrap seeded `0x5eed`. It shows statistics only at n ≥ 5, and weight suggestions only when every must-have of the role has n ≥ 20 outcomes.
    - Suggestions are `w·exp(ρ·n/(n+20))`, normalized and rounded to 0.05 by largest remainder, with ties going to the earlier must-have. A must-have never drops below 0.05.
    - Decisions are counted, never related to scores.
12. **Times** follow Plan 4's call 11. The terminal shows `YYYY-MM-DD HH:MM UTC`. HTML shows `renderKit.fmt.day(ms, "UTC")` plus `HH:MM` (UTC), followed by "(UTC)".

## Review Focus

1. **A TSA that misbehaves.** Cases:
   - unreachable, a connection refused, or a reply that never comes;
   - HTTP 500, or a 302 to another host;
   - a 70 KiB body, a `rejection` status;
   - a token for another hash or nonce, or a genTime after the invite expired.

   Expected: the run waits at most 15 s and never follows the redirect. It names the reason, returns to the menu (interactive) or exits 1 (`--yes`), and leaves nothing half-written. Pinned by Task 7.
2. **Clock edges.** Cases:
   - a candidate clock 10 min off from the TSA;
   - a pairing that crosses local midnight or a DST change;
   - a pairing held weeks after the invite expired;
   - a recording left open past 4 h, or a clock moved back.

   Expected:
   - the TSA time is shown beside the candidate's clock, with no failure;
   - one loupe;
   - the pairing is accepted, with its dates shown;
   - `session end` refuses, naming `--discard`.

   Pinned by Tasks 6, 8 and 10.
3. **Other agent activity during the pairing.** Cases: a scheduled agent, a second tool, a background subagent, a session resumed from before the start. Expected: each is included and labelled by origin and as `resumed`. Only events inside the window count, and nothing from before the start leaks in. Pinned by Task 8.
4. **A brief CLI that misbehaves.** Cases:
   - not installed, or exits non-zero;
   - prints prose, hangs, or floods stdout;
   - replies in emoji or CJK, or writes "we recommend hiring".

   Expected:
   - nothing is sent before the confirmation;
   - the dossier is still written, and the exit code reflects verification only;
   - the recommendation line is dropped and counted;
   - uncovered characters become `?`, so the audit stays clean.

   Pinned by Tasks 13 and 14.
5. **Degenerate calibration logs.** Cases:
   - n = 19 and n = 20;
   - every rating equal;
   - one dossier logged twice;
   - a hand-edited or truncated line;
   - a role whose hash changed between entries;
   - an empty log.

   Expected:
   - no NaN anywhere;
   - no suggestion below 20;
   - the latest entry wins;
   - the hash change is noted;
   - skipped lines are counted;
   - "The calibration log is empty."

   Pinned by Task 15.

## File map

```
test/contract/plan4.test.ts · test/repo/touchpoints.test.ts                                             1
src/trust/der.ts                                                                                         2
src/trust/{x509,tsa-trust}.ts · src/trust/tsa.json · test/kit/pki.ts                                     3
src/trust/tsp.ts · test/kit/tsa.ts                                                                       4
scripts/tsa-roundtrip.ts · test/fixtures/tsa/{digicert,sectigo,sslcom}.tsr · src/trust/tsa.json (fill)   5
src/trust/{errors,bundle,verify,banner}.ts · src/dossier/method.ts (amend)                               6
src/trust/tsa-client.ts · src/consent/terminal.ts · src/cli/{args,run,main,deps}.ts · src/copy.ts        7
src/session/{window,exhibit}.ts · src/payload/exhibits.ts (amend)                                        8
src/session/bundle.ts · src/trust/seal.ts (envelope) · test/kit/pairing.ts                              9
src/session/{state,continuity}.ts · src/cli/{session,scan-options}.ts · src/consent/fingerprints.ts · src/home.ts      10
src/trust/verify-pairing.ts · src/cli/verify.ts · src/console/model.ts (amend)                          11
src/dossier/pairing.ts · src/dossier/sections/pairing.ts · src/kit/generate.ts · src/render/index.ts    12
src/brief/{digest,prompt,runner,reply}.ts · test/kit/fake-cli.ts                                        13
src/cli/brief.ts · src/dossier/sections/brief.ts · src/dossier/{model,render}.ts                        14
src/calibrate/{log,stats,report}.ts · src/cli/calibrate.ts                                              15
scripts/{pairing-smoke,brief-smoke}.ts · test/{canary.surfaces,integration}.test.ts · scripts/qa-dossiers.ts   16
```

---

### Task 1: Pre-flight — pin Plan 4's contract, verify V7′/V8′, and add the touchpoint ratchet

**Files:**
- Create: `test/contract/plan4.test.ts`, `test/repo/touchpoints.test.ts`
- Modify: nothing. Plan 4 (G2) already signs F5′, so the V7′/V8′ pins are a regression test (pre-flight J14).

**Interfaces:**
- **Consumes,** exactly as Plan 4's Interfaces blocks state:
  - `trust/{errors,bytes,jcs,keys,signer,invite,bundle,seal,verify,banner}`;
  - `consent/{prepare,terminal,fingerprints}` and `payload/{view,exhibits}`;
  - `kit/generate`, `roles/*` and `dossier/{model,render,method}`;
  - `cli/{main,args,run,verify,outputs,io,deps}`, `home` and `copy`;
  - the test kits `keys`, `bundles`, `dossiers` and `core`.
- **Consumes from B,** through `ai-practice-report/core`:
  - the values `EventStore`, `analyze`, `computeExhibits`, `buildSessionTable`, `isAction`, `childType`, `modelExportId` and `renderKit` (Plan 2 Task 16 exports `buildSessionTable`, `isAction`, `childType` and `modelExportId` as values, pre-flight J5);
  - the types `DayLoupe`, `DelegationExhibit`, `VerificationExhibit`, `ChildType`, `SessionTable`, `Origin`, `CheckKind` and `ToolId`.
- **Produces:**
```ts
// test/repo/touchpoints.test.ts
export const NETWORK: RegExp;   // /\bfetch\s*\(|globalThis\.fetch|node:(http|https|http2|net|tls|dgram|dns)\b|\bWebSocket\b|\bXMLHttpRequest\b|\bEventSource\b|Bun\.(connect|listen|serve|udpSocket)\b|sendBeacon/
export const SPAWN: RegExp;     // /Bun\.(spawn|spawnSync)\b|node:child_process|\bchild_process\b|Bun\.\$/
export const ALLOW: { network: string[]; spawn: string[] };   // starts { network: [], spawn: ["src/cli/io.ts"] }
```

- [ ] **Step 1: Check the precondition and branch.**
  1. Confirm with `gh pr list --state merged` that Plan 4's PR is merged into `main`.
  2. Run the EtherHiding config scan (workspace CLAUDE.md), then `git fetch origin`, with the sandbox off. Confirm that Plan 4's merge commit is on `origin/main`. Never use the local `main`, which is the stale history from before the rewrite (Plan 4 G1).
  3. `git switch -c feat/v2-advanced origin/main` (pre-flight J1).
- [ ] **Step 2: Read.**
  - The Plan 4 modules above, and B's installed `core/index.ts`, `core/exhibits/types.ts`, `core/analysis/{types,walk,tiers}.ts` and `core/privacy/allowlists.ts`.
  - Confirm that every consumed name exists with its stated type, and that `EventStore` is exported as a value. If anything differs, stop and report BLOCKED with the difference.
- [ ] **Step 3: Write `plan4.test.ts`.**
  - **Compile-time pins:** typed assignments for every consumed name.
  - **At run time:**
    - V6 is unchanged.
    - V7′: `signingInput(vectorBundle())` is 1204 bytes, with V7′'s SHA-256, and `fromUtf8` of it does not contain `"timestamp"`.
    - The V7′ signature, file and `dossierNo` match.
    - V8′'s plaintext hash, tag and file hash match.
    - `new EventStore()` accepts `add`.
    - `computeExhibits(personaScan("expert"), analyze(…)).exhibits` has `a`, `b` and `c`.
    - `childType("Explore") === "explore"`, and `modelExportId("ft:x:y:z:w") === "fine-tuned"`.
- [ ] **Step 4: Run** `bun test test/contract/plan4.test.ts` → PASS at once, because Plan 4 (G2) already signs F5′; a failure means BLOCKED (pre-flight J14). Then run `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Write `touchpoints.test.ts`.**
  - It reads every `src/**/*.ts`, with block and line comments stripped.
  - Every file matching `NETWORK` (or `SPAWN`) is in `ALLOW.network` (or `ALLOW.spawn`).
  - Every allowlisted file matches its pattern, so no stale entry passes.
  - **Run** it → PASS with the initial allowlist.
- [ ] **Step 6: Commit and push.** Commit `test: pin the Plan 4 contract, the F5′ signing input, and the network/process touchpoints`. Run the EtherHiding scan and `git fetch origin && git merge-base --is-ancestor origin/main feat/v2-advanced` (exit 0, else BLOCKED; pre-flight J1), then `git push -u origin feat/v2-advanced` with the sandbox off, and confirm CI is green on three OSes plus the guard.

---

### Task 2: Strict DER reader and writer

**Files:**
- Create: `src/trust/der.ts`, `test/trust/der.test.ts`

**Interfaces:**
- **Consumes:** nothing.
- **Produces:**
```ts
export class DerError extends Error { readonly at: number; constructor(message: string, at: number) }
export interface Der { tag: number; constructed: boolean; start: number; end: number; bytes: Uint8Array /* whole TLV */; content: Uint8Array; kids: Der[] }
export const DER_MAX_BYTES = 65_536; export const DER_MAX_DEPTH = 32;
export const T: { readonly BOOLEAN: 0x01; INTEGER: 0x02; BIT_STRING: 0x03; OCTETS: 0x04; NULL: 0x05; OID: 0x06; UTF8: 0x0c; PRINTABLE: 0x13;
  IA5: 0x16; UTC_TIME: 0x17; GEN_TIME: 0x18; SEQUENCE: 0x30; SET: 0x31 };
export function ctx(n: number, constructed?: boolean): number;                 // 0xa0 | n (default) or 0x80 | n
export function parseDer(b: Uint8Array, o?: { maxBytes?: number }): Der;       // F14, the whole tree, eagerly
export function expectTag(d: Der, tag: number, what: string): Der;             // DerError("<what>: expected tag 0x.., got 0x..")
export function readInt(d: Der): Uint8Array; export function readSmallInt(d: Der): number;   // the latter: 0 ≤ n < 2^31
export function readOid(d: Der): string; export function readOctets(d: Der): Uint8Array; export function readBool(d: Der): boolean;
export function readNull(d: Der): void; export function readBits(d: Der): Uint8Array; export function readTime(d: Der): number;   // epoch ms
export function readText(d: Der): string;                                     // UTF8, Printable or IA5 String
export function tlv(tag: number, content: Uint8Array): Uint8Array; export function seq(...parts: Uint8Array[]): Uint8Array;
export function set(...parts: Uint8Array[]): Uint8Array; export function int(magnitude: Uint8Array): Uint8Array;   // positive, minimal
export function oid(dotted: string): Uint8Array; export function octets(b: Uint8Array): Uint8Array;
export const NULL_DER: Uint8Array; export const TRUE_DER: Uint8Array;
```

- [ ] **Step 1: Write the failing tests.**
  - **Encoding:**
    - every OID row of Formats, both ways;
    - `int(80)` → `02020080`, and `int(007f)` → `02017f`;
    - `tlv(0x04, 200 bytes)` starts `0481c8`, and 300 bytes starts `0482012c`;
    - T1's request, assembled from `seq`, `int`, `oid`, `octets`, `NULL_DER` and `TRUE_DER`, equals its hex.
  - **Rejection,** each with a `DerError` and an `at`:
    - `3080 0000` (indefinite length);
    - `0481 05 …` and `048200 05 …` (lengths that are not minimal);
    - `0500 00` (trailing bytes);
    - `020200 7f` (an INTEGER that is not minimal);
    - `010101` (BOOLEAN), `050100` (NULL);
    - `1f…` (a high tag);
    - `24 …` (a constructed OCTET STRING);
    - a truncated SEQUENCE;
    - 33 nested SEQUENCEs;
    - 65,537 bytes;
    - `0603 2a 80 01` (an OID arc that is not minimal);
    - a BIT STRING with unused bits.
  - **Times:**
    - `20261118100332Z` → `Date.UTC(2026, 10, 18, 10, 3, 32)`, and `.5Z` → +500 ms;
    - `.50Z`, `202611181003Z`, `20261118100332+0100` and `20261118100332` are rejected;
    - UTCTime `491231235959Z` → 2049, and `500101000000Z` → 1950.
  - **Round trip:** `parseDer(seq(oid(x), octets(y)))` gives `kids` whose readers return `x` and `y`.
- [ ] **Step 2: Run** `bun test test/trust/der.test.ts` → FAIL. **Step 3: Implement.**
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(trust): strict DER reader and writer (definite minimal lengths, depth and size caps)`.

---

### Task 3: X.509 certificates and the TSA trust anchors

**Files:**
- Create:
  - `src/trust/{x509,tsa-trust}.ts`;
  - `src/trust/tsa.json`, holding exactly `{"v":1,"default":null,"authorities":[]}`;
  - `test/kit/pki.ts`;
  - `test/trust/{x509,tsa-trust}.test.ts`.
- Modify: `test/repo/no-private-keys.test.ts` (Plan 4 Task 3). No `tsa.json` root may hold a `VEC` public key or the kit's fixed names.

**Interfaces:**
- **Consumes:** Task 2's DER helpers; Plan 4's `unb64u` and `Sys`; `VEC` from `test/kit/keys.ts`.
- **Produces:**
```ts
// src/trust/x509.ts
export const OID: Readonly<Record<"sha1" | "sha256" | "sha384" | "sha512" | "rsaEncryption" | "sha256WithRSA" | "sha384WithRSA" | "sha512WithRSA" | "rsaPss"
  | "ecdsaSha256" | "ecdsaSha384" | "ecdsaSha512" | "ed25519" | "basicConstraints" | "extKeyUsage" | "timeStamping" | "commonName" | "signedData" | "tstInfo"
  | "contentType" | "messageDigest" | "signingCertificate" | "signingCertificateV2", string>>;   // dotted, as the Formats table
export interface Cert { der: Uint8Array; tbs: Uint8Array; serial: Uint8Array; issuer: Uint8Array /* Name DER */; subject: Uint8Array; notBefore: number; notAfter: number;
  spki: Uint8Array; sigAlg: string; signature: Uint8Array; ca: boolean | null; eku: { critical: boolean; purposes: string[] } | null; commonName: string | null }
export function parseCert(der: Uint8Array): Cert;                                // DerError when malformed
export function hashOf(digestOid: string): "sha1" | "sha256" | "sha384" | "sha512" | null;
export function verifySig(o: { sigAlg: string; digestAlg?: string; spki: Uint8Array; data: Uint8Array; sig: Uint8Array }): boolean;   // never throws
export function verifyCertSig(c: Cert, issuerSpki: Uint8Array): boolean;
// src/trust/tsa-trust.ts
export const TSA_ID: RegExp;                                                     // /^[a-z][a-z0-9-]{1,31}$/
export interface TsaFile { v: 1; default: string | null; authorities: Array<{ id: string; name: string; url: string; roots: string[] /* b64u DER */ }> }
export interface TsaAuthority { id: string; name: string; url: string | null; roots: Cert[]; source: "shipped" | "env" }
export interface TsaTrust { authorities: readonly TsaAuthority[]; defaultId: string | null; error: string | null }
export function loadTsaTrust(vars: Sys["vars"], o?: { shipped?: TsaFile }): TsaTrust;   // tsa.json (JSON-imported), plus AIPROF_TSA_ROOTS
export function issuedByAnchor(t: TsaTrust, c: Cert): TsaAuthority | null;
// test/kit/pki.ts
export type KitAlg = "ed25519" | "p256" | "rsa";
export interface KitKey { alg: KitAlg; spki: Uint8Array; sigAlg: string; sign(data: Uint8Array): Uint8Array }
export function kitKey(alg: KitAlg, seed?: Uint8Array): KitKey;     // ed25519 from a VEC seed (deterministic); p256 and rsa (2048) generated at test time
export interface CertSpec { serial: number; issuerCn: string; subjectCn: string; notBefore: number; notAfter: number; ca: boolean;
  eku?: { critical: boolean; purposes: string[] } | null }
export function makeCert(spec: CertSpec, subject: KitKey, issuer: KitKey): Uint8Array;
export const KIT_VALIDITY: { notBefore: number; notAfter: number }; // 2026-01-01T00:00:00Z to 2036-01-01T00:00:00Z
export interface FakePki { alg: KitAlg; root: Cert; signer: Cert; signerKey: KitKey; trust: TsaTrust; envRoots: string }
export function fakePki(o?: { alg?: KitAlg; eku?: "timestamping" | "none" | "extra" | "non-critical"; signerValidity?: { notBefore: number; notAfter: number } }): FakePki;
```

**Rules.**
- **Certificates** are parsed by RFC 5280's structure:
  - `tbs` is the raw TBSCertificate TLV;
  - extensions: `basicConstraints` (cA) and `extKeyUsage`, with its critical flag;
  - `commonName` is the subject's first CN, cleaned (control characters become `?`, at most 80 characters).
- **`verifySig`:**
  - **Key types:** the key from `createPublicKey({ format: "der", type: "spki" })` must be `rsa` for the RSA algorithms, `ec` for ECDSA (P-256, P-384 or P-521), and `ed25519` for Ed25519.
  - **Hashes:** per F12 step 9.
  - **Anything else is false,** including RSA-PSS and SHA-1 signatures.
- **`tsa.json`:**
  - ids unique and `TSA_ID`;
  - names 1–40 characters;
  - `url` an absolute `http:` or `https:` URL;
  - each root parses and has cA true;
  - `default` null or a listed id.
- **`AIPROF_TSA_ROOTS`** is a JSON array of `{ id, name, roots }`, with ids that follow `TSA_ID` and do not repeat a shipped id. These authorities have `url: null` and `source: "env"`. Any other shape sets `error`, and callers exit 2 with it.
- **The fake PKI,** for `ed25519`:
  - root `VEC.t1`, CN "ai-profiler test root", serial 1, cA true;
  - signer `VEC.t2`, CN "ai-profiler test TSA", serial 2, cA false, EKU critical `[timeStamping]`;
  - both valid for `KIT_VALIDITY`;
  - authority id `test-tsa`, name "Test TSA".

  `envRoots` is that root's `AIPROF_TSA_ROOTS` value.

- [ ] **Step 1: Write the failing tests.**
  - **`parseCert`** on the ed25519 fake PKI gives every field, with `verifyCertSig(signer, root.spki)` true. It is false:
    - with `VEC.alice`'s key;
    - with one TBS byte flipped;
    - for a hand-built cert with the RSA-PSS OID, with no throw.
  - **`p256` and `rsa`** fake PKIs verify.
  - **`loadTsaTrust`:**
    - the shipped file gives zero authorities;
    - `envRoots` gives `test-tsa` with source `env`;
    - `error` is set for bad JSON, a duplicate id, a root that is not a CA, and bad base64url.
  - **`issuedByAnchor(trust, signer)`** is `test-tsa`, and `null` with an empty trust.
  - **Determinism:** two ed25519 `fakePki()` builds have byte-identical certificates.
  - **`no-private-keys`:** the extended rule passes.
- [ ] **Step 2: Run** `bun test test/trust/x509.test.ts test/trust/tsa-trust.test.ts` → FAIL. **Step 3: Implement** the modules and the kit.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(trust): X.509 parsing and signature checks on node:crypto; pinned TSA anchors; a deterministic test PKI`.

---

### Task 4: RFC 3161 — request, reply, token verification, normal form, and the fake TSA

**Files:**
- Create: `src/trust/tsp.ts`, `test/kit/tsa.ts`, `test/trust/tsp.test.ts`

**Interfaces:**
- **Consumes:** Tasks 2 and 3; Plan 4's `Rand` and `sha256`.
- **Produces:**
```ts
// src/trust/tsp.ts
export const TSA_NONCE_BYTES = 16; export const REQUEST_BYTES = 77; export const TOKEN_MAX_BYTES = 65_536;
export function tsaNonce(rand: Rand): Uint8Array;                                    // F13
export function tsaRequest(imprint: Uint8Array, nonce: Uint8Array): Uint8Array;       // F13
export interface TsaReply { status: number; token: Uint8Array | null }
export function parseTsaReply(der: Uint8Array): TsaReply;                             // DerError when malformed
export type TokenFailureCode = "malformed" | "not-tstinfo" | "imprint-mismatch" | "nonce-mismatch" | "weak-digest" | "digest-mismatch" | "missing-attribute"
  | "no-signer-cert" | "sid-mismatch" | "unsupported-algorithm" | "bad-signature" | "not-a-tsa-cert" | "outside-cert-validity" | "untrusted" | "not-normal-form";
export interface TokenCheck { authority: string; genTime: number; policy: string; serial: string; signer: { commonName: string | null; notAfter: number }; path: Cert[] }
export type TokenResult = { ok: true; check: TokenCheck } | { ok: false; code: TokenFailureCode; detail: string };
export function verifyToken(token: Uint8Array, o: { imprint: Uint8Array; nonce?: Uint8Array; trust: TsaTrust; normalForm: boolean }): TokenResult;   // F12
export function normalizeToken(token: Uint8Array, path: readonly Cert[]): Uint8Array;  // F12 normal form; idempotent
// test/kit/tsa.ts
export const FAKE_GEN_TIME: number;                                                   // 2026-11-18T10:42:09Z
export interface FakeReplyOptions { status?: number; genTime?: number; nonce?: "echo" | "other" | "absent"; imprint?: "echo" | "other";
  ess?: "v1" | "v2" | "both" | "both-mismatched"; digest?: "sha256" | "sha512" | "sha1"; includeRoot?: boolean; extraCert?: boolean;
  crl?: boolean; unsignedAttr?: boolean; badSignature?: boolean }
export function fakeReply(pki: FakePki, request: Uint8Array, o?: FakeReplyOptions): Uint8Array;   // TimeStampResp DER; policy 1.2.3.4, serial 1
export interface FakeTsa { url: string; requests: Array<{ method: string; headers: Record<string, string>; body: Uint8Array }>; close(): void }
export function startFakeTsa(pki: FakePki, o?: FakeReplyOptions & { mode?: "ok" | "http-500" | "hang" | "huge" | "redirect" | "garbage" }): FakeTsa;
  // Bun.serve on 127.0.0.1, port 0; "huge" sends 70 KiB; "redirect" answers 302 to a second listener that records hits
export function fakeAuthority(pki: FakePki, url: string): TsaAuthority;                // id test-tsa, source "env", with that url, for Deps.tsa
```

- [ ] **Step 1: Write the failing tests.**
  - **Request:**
    - T1 exactly;
    - `tsaNonce` always gives 16 bytes with a first byte in `0x40`–`0x7f`;
    - `REQUEST_BYTES` equals T1's length.
  - **Reply and verification** with the ed25519 fake PKI and `imprint` = V7′'s payload hash:
    - default options → `parseTsaReply` gives status 0, and `verifyToken(…, { nonce, normalForm: false })` is ok, with authority `test-tsa`, genTime `FAKE_GEN_TIME`, policy `1.2.3.4` and a path of 1;
    - the `p256` and `rsa` PKIs are ok too.
  - **Each failure, by option:**
    - `imprint: "other"` → `imprint-mismatch`;
    - `nonce: "other"` or `"absent"` (when a nonce is given) → `nonce-mismatch`;
    - `digest: "sha1"` → `weak-digest`;
    - `badSignature` → `bad-signature`;
    - `ess: "both-mismatched"` → `no-signer-cert`;
    - `eku: "none"`, `"extra"` or `"non-critical"` (on `fakePki`) → `not-a-tsa-cert`;
    - a signer validity that ends before genTime → `outside-cert-validity`;
    - an empty trust → `untrusted`;
    - `status: 2` → `parseTsaReply` status 2.
  - **Normal form:**
    - `includeRoot`, `extraCert`, `crl` and `unsignedAttr` are each ok lenient and `not-normal-form` strict;
    - after `normalizeToken(token, check.path)` they are ok strict;
    - `normalizeToken` is idempotent, and its certificate set equals `path`;
    - `ess` set to `v1`, `v2` or `both` is ok.
  - **Strictness:** XOR each of 300 seeded positions of a normalized token with `0x01` → never `ok`.
  - **Determinism:** two ed25519 `fakeReply` builds for T1 are byte-identical, so snapshot the hex.
  - **The fake server:**
    - records the method, headers and body;
    - each mode behaves as named;
    - it listens on `127.0.0.1`.
- [ ] **Step 2: Run** `bun test test/trust/tsp.test.ts` → FAIL. **Step 3: Implement** `tsp.ts` and the kit.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS. Commit the snapshot.
- [ ] **Step 5: Commit** `feat(trust): RFC 3161 request, reply and token verification against pinned roots; token normal form; a local fake TSA`.

---

### Task 5: The public authorities — a manual round trip, shipped roots, captured tokens (controller gate)

**Files:**
- Create:
  - `scripts/tsa-roundtrip.ts`;
  - `test/scripts/tsa-roundtrip.test.ts` and `test/trust/tsa-shipped.test.ts`;
  - `test/fixtures/tsa/{digicert,sectigo,sslcom}.tsr`, which are public TSA replies.
- Modify: `src/trust/tsa.json`, which gets the three authorities of Formats with `default: "digicert"`.

**Interfaces:**
- **Consumes:** Task 4's `tsaRequest`, `tsaNonce`, `parseTsaReply`, `verifyToken` and `normalizeToken`; Task 3's `loadTsaTrust`.
- **Produces:** `bun scripts/tsa-roundtrip.ts [--capture <dir>] [--authorities <file>]`.
  - For each authority it prints only `<id>=PASS` or `<id>=FAIL <code>`, and exits 1 on any FAIL.
  - With `--capture`, it sends exactly T1, with the fixed nonce, so the committed replies check deterministically, and writes `<dir>/<id>.tsr`.
  - Without it, it uses a fresh random nonce.
  - `--authorities` replaces the shipped list, which is how the test points it at a fake TSA.

- [ ] **Step 1: Write the failing tests.**
  - **`tsa-roundtrip.test.ts`:** with `--authorities` naming a fake TSA (url and `envRoots`), the output is exactly `test-tsa=PASS`, and with the fake in `http-500` mode it is `test-tsa=FAIL http-status` with exit 1.
  - **`tsa-shipped.test.ts`:**
    - `tsa.json` has the three ids, names and URLs of Formats, with `default: "digicert"`;
    - each root's SHA-256 equals the table's;
    - for each fixture: status 0; `verifyToken(token, { imprint: V7′ hash, nonce: T1's nonce, trust: shipped, normalForm: false })` is ok, with that authority;
    - the normalized token is ok strict, and its certificate count equals `path.length`;
    - 200 seeded byte flips of the normalized token all fail.
- [ ] **Step 2: Run** them → FAIL. **Step 3: Implement** the script.
- [ ] **Step 4: Controller steps,** with the network.
  1. **Get each root certificate.** Take it from the OS root store (on macOS: `security find-certificate -c "<CN>" -p /System/Library/Keychains/SystemRootCertificates.keychain`) or from the CA's published download, and convert it to DER.
  2. **Check its SHA-256** against the table. A mismatch stops the task.
  3. **Write `tsa.json`.**
  4. **Run** `bun scripts/tsa-roundtrip.ts` → three PASS lines.
  5. **Run** `bun scripts/tsa-roundtrip.ts --capture test/fixtures/tsa`.
- [ ] **Step 5: Run** `bun test && bunx tsc --noEmit` → PASS. The tests are offline from now on.
- [ ] **Step 6: Commit** `feat(trust): ship DigiCert, Sectigo and SSL.com as timestamp authorities, pinned by root fingerprint; captured replies verify offline`.

---

### Task 6: Timestamps in bundles and in `verify`

**Files:**
- Modify:
  - `src/trust/errors.ts`: add `bad-timestamp` and remove `timestamp-unsupported`;
  - `src/trust/bundle.ts`: F5′, plus `BundleTimestamp`;
  - `src/trust/verify.ts`: the check, and `VerifyContext.tsa`;
  - `src/trust/banner.ts`;
  - `src/dossier/method.ts`: the timestamp row;
  - `src/cli/verify.ts`: `loadTsaTrust`, where an `error` exits 2;
  - `src/cli/compare.ts`: one `loadTsaTrust(d.sys.vars)` per run (from Task 7 on, `d.tsa ?? loadTsaTrust(d.sys.vars)`), whose `error` exits 2; and every test kit that builds a `VerifyContext` (pre-flight J2);
  - `test/kit/tsa.ts`: add `timestampedVector`;
  - `test/trust/{bundle,verify}.test.ts`.
- Create: `test/trust/timestamp.test.ts`

**Interfaces:**
- **Consumes:** Task 4's `verifyToken`; Plan 4's `readSigned`, `signingInput`, `verifyBytes`, `bannerLines` and `buildDossier`.
- **Produces:**
```ts
// bundle.ts
export interface BundleTimestamp { tsa: string; genTime: string; token: string }
export interface SignedBundle extends Omit<UnsignedBundle, "timestamp"> { timestamp: BundleTimestamp | null; signature: { alg: "Ed25519"; keyId: string; sig: string } }
export function withTimestamp(b: SignedBundle, t: BundleTimestamp | null): SignedBundle;   // signingInput unchanged
// verify.ts
export interface VerifyContext { /* Plan 4's fields */ tsa: TsaTrust }
export interface Verified { /* Plan 4's fields */ timestamp: TokenCheck | null }
// test/kit/tsa.ts
export function timestampedVector(): { file: Uint8Array; signed: SignedBundle; pki: FakePki };   // V7′ plus an ed25519 fake token at FAKE_GEN_TIME
```

**Rules.**
- **`readSigned`** accepts a `timestamp` that is `null` or exactly `{ tsa, genTime, token }`, where:
  - `tsa` follows `TSA_ID`;
  - `genTime` is `YYYY-MM-DDTHH:MM:SSZ`;
  - `token` is strict F1 base64url of at most 65,536 bytes.

  Anything else is `bad-format`.
- **`verifyBytes` order:** after authenticity and before the invite binding, run F12's bundle rules, with `normalForm: true` and `ctx.tsa`. A failure is `bad-timestamp` with the code, or `outside-invite-window`.
- **Banner:** line 1 gains ` · TSA <YYYY-MM-DD HH:MM> UTC` right after the invite part.
- **Method row `timestamp`:**
  - recruiter mode: "<name> (<id>) · <day HH:MM> (UTC) · policy <oid> · serial <hex> · signer <CN>, valid to <day> · within the invite window · revocation not checked (offline)";
  - candidate-copy mode, from the member alone: "<id> at <day HH:MM> (UTC), checked when the file was made";
  - unchanged text otherwise: "not timestamped".

- [ ] **Step 1: Write the failing tests** (Review Focus 2).
  - **Shape:** extra keys, a bad id, a bad `genTime` and an oversized token → `bad-format`.
  - **Signing input:** `signingInput(withTimestamp(b, t))` equals `signingInput(b)`.
  - **Happy paths,** with `ctx.tsa` from the fake PKI's `envRoots`. A persona bundle, timestamped over its payload hash, gives exit 0, `verified.timestamp.authority === "test-tsa"`, and ` · TSA 2026-11-18 10:42 UTC` in the banner. Sealed and timestamped also gives exit 0.
  - **A clock 10 min off:** `createdAt` 10 min after `genTime` still verifies, and the method row shows both times.
  - **Failures:**
    - a token over another hash → `bad-timestamp` (`imprint-mismatch`);
    - `tsa` renamed → `bad-timestamp`;
    - `genTime` edited by one second → `bad-timestamp`;
    - an empty `ctx.tsa` → `bad-timestamp` (`untrusted`);
    - genTime = `exp + 1 s` → `outside-invite-window`;
    - genTime = `iat − 301 s` → `outside-invite-window`.
  - **Tamper suite:** XOR every byte of `timestampedVector().file` with `0x01`. Every result exits 1.
  - **Compare:** `compare` accepts a timestamped bundle and rejects one whose token is forged (pre-flight J2).
  - **Dossier:** the method row in each of the three cases.
- [ ] **Step 2: Run** `bun test test/trust` → FAIL. **Step 3: Implement.**
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(verify): RFC 3161 timestamps in aiprof/2 — normal-form token check, invite window, banner and chain-of-custody row`.

---

### Task 7: The TSA client — consent [5], `--timestamp`, the only network call

**Files:**
- Create: `src/trust/tsa-client.ts`, `test/trust/tsa-client.test.ts`, `test/cli/timestamp.test.ts`
- Modify:
  - `src/consent/terminal.ts`: item [5];
  - `src/cli/args.ts`: `--timestamp` and `--tsa`;
  - `src/cli/run.ts`: the order of F5′;
  - `src/cli/main.ts`: `Deps.fetch?` and `Deps.tsa?`;
  - `src/cli/deps.ts`: wire `fetch` to `globalThis.fetch`;
  - `src/copy.ts`: `PRIVACY_STATEMENT[1]`, `TSA_NOTICE` and `EXPLAIN_NETWORK` (pre-flight J4);
  - `src/cli/{explain,help}.ts`: `--explain`'s network line becomes `EXPLAIN_NETWORK`, and `--help` gains `--timestamp` and `--tsa` (pre-flight J4);
  - `src/dossier/model.ts`: the preview's `consent.timestamp`;
  - `test/repo/touchpoints.test.ts`: add `src/cli/deps.ts` to `ALLOW.network`. `src/trust/tsa-client.ts` gets `fetch` injected, matches no pattern and is not listed (pre-flight J3).

**Interfaces:**
- **Consumes:** Task 4's `tsaNonce`, `tsaRequest`, `parseTsaReply`, `verifyToken` and `normalizeToken`; Task 6's `BundleTimestamp` and `withTimestamp`; Plan 4's `consentLoop` and `runCandidate`.
- **Produces:**
```ts
// tsa-client.ts
export const TSA_TIMEOUT_MS = 15_000; export const TSA_REPLY_MAX = 65_536;
export type TsaFailure = "network" | "timeout" | "http-status" | "redirect" | "too-large" | "bad-reply" | "rejected" | "bad-token" | "after-expiry";
export const TSA_FAILURE_TEXT: Readonly<Record<TsaFailure, string>>;
export interface TsaSent { url: string; imprintHex: string; nonceHex: string; bytes: 77 }
export async function requestTimestamp(o: { authority: TsaAuthority; imprint: Uint8Array; rand: Rand; trust: TsaTrust; notAfterMs: number | null;
  fetchFn: typeof fetch; timeoutMs?: number; onSend?: (s: TsaSent) => void }):
  Promise<{ ok: true; timestamp: BundleTimestamp; check: TokenCheck } | { ok: false; reason: TsaFailure; detail: string }>;
// main.ts — Deps gains
fetch?: typeof fetch;   // absent: a timestamp cannot be requested ("network is not available here")
tsa?: TsaTrust;         // absent: commands use loadTsaTrust(d.sys.vars), whose error exits 2; tests inject a fake authority
// args.ts — RunOptions gains
timestamp: boolean; tsa: string | null;
```

**Rules.**
- **The client.**
  1. Draw the nonce.
  2. Call `onSend`.
  3. Send F13.
  4. Read the reply, with its count.
  5. `parseTsaReply`, where a status of 2 or more is `rejected`.
  6. Verify leniently with the imprint and nonce.
  7. Normalize, and verify strictly.
  8. `genTime > notAfterMs` is `after-expiry`.
  9. Build the member.

  The URL is only `authority.url`. An authority without one cannot be requested.
- **The run.**
  - After `[c]` or `--yes`:
    1. Sign.
    2. If the timestamp is on: check `now ≤ exp`, request, and attach.
    3. Seal when the invite has `sealTo`.
  - `tty` prints `Timestamp: sending <imprint hex> and nonce <nonce hex> (77 bytes) to <url>` just before sending.
  - **On failure:**
    - interactive: print `the timestamp failed: <TSA_FAILURE_TEXT>`, and go back to the menu with the state and toggle kept;
    - `--yes`: exit 1 with that text plus "nothing was written".
- **Item [5].**
  - Its line reads `now: off`, or `now: on (<name>)`.
  - Turning it on prints `TSA_NOTICE` with the authority's name and URL.
  - It is marked unavailable when the trust has no authority with a URL.
- **Flags.**
  - `--timestamp` takes no value. `--tsa ID` chooses the authority and needs `--timestamp`.
  - An unknown id → exit 2, listing the ids.
  - With no authority configured → exit 2, "no timestamp authority is configured in this build".
  - The `--json` sidecar stays the exact signing bytes.
- **The preview** says, when the timestamp is on: "After you confirm, a timestamp from {name} is added to the file", then `TSA_NOTICE`.

- [ ] **Step 1: Write the failing tests** (Review Focus 1).
  - **The client against `startFakeTsa`:**
    - **ok:** a member whose token is in normal form; exactly one request, with exactly the three headers of F13 and a body that parses back to imprint, nonce and `certReq` and is 77 bytes; `onSend` fired once, with the same hexes.
    - **Each mode:**
      - `http-500` → `http-status`;
      - `hang` with `timeoutMs: 300` → `timeout`, within 1 s;
      - `huge` → `too-large`;
      - `redirect` → `redirect`, and the second listener has 0 hits;
      - `garbage` → `bad-reply`;
      - `status: 2` → `rejected`;
      - `imprint: "other"` → `bad-token`;
      - genTime after `notAfterMs` → `after-expiry`;
      - a closed port → `network`.
  - **The CLI, through `main`,** with `Deps.tsa = { authorities: [fakeAuthority(pki, url)], defaultId: "test-tsa", error: null }`:
    - `--yes --timestamp` gives a sealed bundle whose opened member verifies, and `verify` shows the TSA banner;
    - without `--timestamp`, a `fetch` spy is never called and the server gets 0 requests;
    - `--tsa nope --timestamp` → exit 2; `--tsa test-tsa` alone → exit 2;
    - `--yes --timestamp` in `http-500` mode → exit 1, with no file left behind;
    - interactive `["5","c"]` → `TSA_NOTICE` and the `sending` line in `tty`, and the bundle is timestamped;
    - interactive `["5","c","5","c"]` in `http-500` mode → the failure line, then a file without a timestamp, exit 0;
    - the clock past `exp` at confirm with the timestamp on → the message, and with `--yes` exit 1.
  - **Copy:** the amended `PRIVACY_STATEMENT[1]` is in `--help`, the preview and the dossier's §6.
  - **Touchpoints:** the test passes with the one new entry (pre-flight J3).
  - **Explain and help:** `--explain` prints `EXPLAIN_NETWORK` where Plan 4 printed "Network: none", and `--help` lists `--timestamp` and `--tsa` (pre-flight J4).
- [ ] **Step 2: Run** `bun test test/trust/tsa-client.test.ts test/cli/timestamp.test.ts` → FAIL. **Step 3: Implement.**
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(run): opt-in RFC 3161 timestamp — consent [5], --timestamp/--tsa, 77 bytes to a shipped authority, nothing else on the network`.

---

### Task 8: Exhibit P — slice the scan to the window, compute with the core

**Files:**
- Create: `src/session/{window,exhibit}.ts`, `test/session/{window,exhibit}.test.ts`
- Modify: `src/payload/exhibits.ts`. Export the per-exhibit readers that `readExhibits` already uses.

**Interfaces:**
- **Consumes:** B's `EventStore`, `analyze`, `computeExhibits`, `buildSessionTable`, `isAction`, `childType`, `modelExportId`, `DayLoupe`, `DelegationExhibit` and `VerificationExhibit`; Plan 4's `repoSignalsOff`.
- **Produces:**
```ts
// window.ts
export const MAX_PAIRING_MS = 4 * 3_600_000;
export function sliceWindow(raw: ScanResult, from: number, to: number): ScanResult;
export function pairingZone(from: number, to: number): string;      // "UTC" or "Etc/GMT∓h"
// exhibit.ts
export interface PairingTotals { spanMs: number; activeMs: number; sessions: number; resumed: number; byTool: Partial<Record<ToolId, number>>;
  byOrigin: Partial<Record<Origin, number>>; humanTurns: number; actions: number; subagents: number; byChildType: Partial<Record<ChildType, number>>;
  background: number; maxDepth: number; edits: number; linesAdded: number; linesRemoved: number;
  checks: { run: number; passed: number; failed: number; byKind: Partial<Record<CheckKind, number>> };
  interrupts: number; corrections: number; denials: number; models: string[] }
export interface ExhibitP { loupe: DayLoupe | null; delegation: DelegationExhibit; verification: VerificationExhibit; totals: PairingTotals }
export const MAX_PAIRING_MODELS = 8;
export function buildExhibitP(raw: ScanResult, o: { from: number; to: number }): ExhibitP;   // raw = the full end scan
export function readExhibitP(v: unknown): ExhibitP | null;                                     // deny by default, field by field
// payload/exhibits.ts — now exported
export function readDayLoupe(v: unknown): DayLoupe | null; export function readDelegation(v: unknown): DelegationExhibit | null;
export function readVerification(v: unknown): VerificationExhibit | null;
```

**Rules.**
- **`sliceWindow`:**
  - **Events kept:** detail-window `prompt`, `tool`, `turn`, `usage` and `marker` events with `from ≤ ts ≤ to`.
  - **Sessions kept:** a `SessionEv` stays when it or a descendant has a kept event. Its ancestors stay too, as structure. Its `start` and `end` are clipped to `[from, to]`, and its window is kept.
  - **Edges** between kept sessions stay.
  - **`coverage`** stays unchanged, because walk rule 1 reads marker windows from it.
  - **Everything else is dropped:** `daily`, lifetime prompts, `config`, `anchor`, `identity`, `file`, the Codex facts, `ratelimit`, `commit` and `totals`.
  - **`repos`** comes from `repoSignalsOff`.
- **`pairingZone`:** try offsets in the order 0, +1, −1, +2, −2, … hours, within −12 to +14. Return the first under which `from` and `to` fall on the same local day. 0 is `"UTC"`, +h is `Etc/GMT-h` and −h is `Etc/GMT+h`.
- **`buildExhibitP`:**
  1. `s = sliceWindow(raw, from, to)` and `z = pairingZone(from, to)`.
  2. `a = analyze(s, { timeZone: z, now: to })`.
  3. `x = computeExhibits(s, a).exhibits`.
  4. Return:
     - `loupe` = `x.a[0] ?? null`;
     - `delegation` = `x.b`;
     - `verification` = `x.c`;
     - `totals`, over `t = buildSessionTable(s, { now: to, timeZone: z })`.
- **Totals:**
  - **Rows:** "the rows" are `t.detailTop` rows with a kept event in their tree.
  - **Sessions:** `sessions`, `byTool` and `byOrigin` count those rows. `resumed` counts those whose start in `raw` is before `from`.
  - **Turns and actions:**
    - `humanTurns` counts the rows' prompts with `t.isHuman`;
    - `actions` counts `isAction` tool events of the rows and their descendants;
    - `activeMs` runs from the first kept event to the last, or is 0.
  - **Subagents:** `subagents` counts descendant rows with a kept event. `byChildType` comes from `childType(agentType)`. `background` counts those with `background === true`. `maxDepth` is the deepest depth.
  - **Edits:** `edits` counts actions in category `edit` or `write`, and `linesAdded` and `linesRemoved` sum their known counts.
  - **Checks:** actions with a non-empty `checks` and `ok` defined. Count `run`, `passed` and `failed`. In `byKind`, an event counts under each of its kinds.
  - **Steering:**
    - `interrupts` counts `interrupt` markers with detail `user`, `replaced` or none;
    - `corrections` counts human prompts with intent `correction`;
    - `denials` counts `denial` markers.
  - **Models:** `models` takes `modelExportId` over the tree's session models and usage models, unique and sorted, at most 8.
- **`readExhibitP`** reuses the three exported readers and checks every totals field:
  - non-negative integers, except `spanMs` and `activeMs`, which are non-negative and finite;
  - enum keys only: `ToolId` from `registry`, `Origin`, `ChildType` and `CheckKind`;
  - models matching `modelExportId`'s pattern or equal to `fine-tuned` or `other`.

  Anything else is `null`.

- [ ] **Step 1: Write the failing tests** (Review Focus 2 and 3). Build a hand-made `scanResultOf` store around `T0`:
  - **S1:** Claude Code, human, starting at `T0 − 30 min`. It has a prompt and 3 tools before `T0`. After `T0` it has a prompt at +1 min, then edit, `bun test` failing, edit, and `bun test` passing, at +2 to +5 min. It has an Explore child with 4 actions at +3 min.
  - **S2:** Codex, human, wholly inside the window, with 1 prompt and 3 actions.
  - **S3:** Claude Code, `scheduled`, inside the window, with 2 actions and `background`.
  - **S4:** wholly before `T0`.

  Over `[T0, T0 + 20 min]`:
  - **The slice:**
    - S4 is absent;
    - no event before `T0` remains;
    - S1's start is `T0`, and its child keeps `parentId`.
  - **Totals:**
    - `sessions` 3 and `resumed` 1;
    - `byOrigin` `{ human: 2, scheduled: 1 }`;
    - `humanTurns` 2;
    - `actions` is the in-window count, including the child's 4;
    - `subagents` 1, with `byChildType` `{ explore: 1 }`;
    - `checks` `{ run: 2, passed: 1, failed: 1, byKind: { test: 2 } }`.
  - **The verification exhibit:** `closed` is 1.
  - **The loupe:** 3 lanes, with no 13-digit number anywhere in `JSON.stringify(exhibit)`.
  - **Midnight:**
    - `pairingZone(Date.UTC(2026, 11, 1, 23, 50), Date.UTC(2026, 11, 2, 0, 20)) === "Etc/GMT-1"`;
    - `pairingZone(Date.UTC(2026, 11, 1, 22, 30), Date.UTC(2026, 11, 2, 2, 0)) === "Etc/GMT-2"`;
    - a 10:00–10:20 UTC window gives `"UTC"`;
    - a store with actions at 23:55 and 00:10 UTC gives one non-null loupe whose work spans hold both.
  - **Empty window:** zero totals, `loupe: null`, `delegation.root: null`, and valid JSON.
  - **Caps:** 15 sessions in the window give 12 lanes plus `moreLanes: 3`.
  - **Canaries:** `expectNoCanaries` on the exhibit of a busy window of `personaScan("expert", { canaries: true })`.
  - **Determinism:**
    - the same input twice is deep-equal;
    - a window across 2026-11-01T06:00Z, a DST change in New York, gives the same exhibit under `TZ=America/New_York` and `TZ=UTC`.
  - **`readExhibitP`:**
    - round-trips;
    - drops a planted key;
    - rejects NaN, `-1`, an unknown tool id, a raw model id, and 9 models.
- [ ] **Step 2: Run** `bun test test/session` → FAIL. **Step 3: Implement.**
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(session): Exhibit P from a window slice of the scan, computed by the core in a one-day zone`.

---

### Task 9: The pairing format — `aiprof-pair/1`, signing, sealing, reading

**Files:**
- Create: `src/session/bundle.ts`, `test/session/bundle.test.ts`, `test/kit/pairing.ts`
- Modify: `src/trust/seal.ts`. Extract `sealEnvelope` and `openEnvelope`; `sealBundle` and `openSealed` keep their signatures and still give V8′.

**Interfaces:**
- **Consumes:** Plan 4's `jcsBytes`, `parseCanonical`, `Signer`, `BundleMeta`, `Fingerprint`, `SEAL_ALG` and `fingerprint`; Task 6's `BundleTimestamp`; Task 8's `ExhibitP` and `readExhibitP`.
- **Produces:**
```ts
// seal.ts
export function sealEnvelope(clear: { format: string; meta: BundleMeta; invite: string }, inner: Readonly<Record<string, unknown>>, recipientPub: Uint8Array,
  info: string, o?: { ephemeral?: XKey; rand?: Rand }): { format: string; meta: BundleMeta; invite: string; sealed: { alg: typeof SEAL_ALG; kid: string; epk: string; ct: string } };
export function openEnvelope(s: { format: string; meta: BundleMeta; invite: string; sealed: { alg: string; kid: string; epk: string; ct: string } },
  key: XKey & { kid: string }, info: string, innerKeys: readonly string[]): Record<string, unknown>;
// session/bundle.ts
export const PAIR_FORMAT = "aiprof-pair/1"; export const PAIR_SEAL_INFO = "aiprof-pair/1 seal v1"; export const PAIRING_BUDGET = 200_000;
export const MAX_CONTINUITY = 4096; export const MAX_PAIRING_SESSIONS = 12;
export interface PairingSessionRef { fp: string; tool: ToolId; kind: "new" | "resumed"; size: Fingerprint["size"] }
export interface UnsignedPairing { format: "aiprof-pair/1"; meta: BundleMeta; invite: string; bundle: { fileSha256: string } | null;
  window: { startedAt: string; endedAt: string; code: string }; continuity: { fps: string[]; more: number }; sessions: PairingSessionRef[];
  exhibit: ExhibitP; timestamp: null; sealed: null }
export interface SignedPairing extends Omit<UnsignedPairing, "timestamp"> { timestamp: BundleTimestamp | null; signature: { alg: "Ed25519"; keyId: string; sig: string } }
export interface SealedPairing { format: "aiprof-pair/1"; meta: BundleMeta; invite: string; sealed: { alg: typeof SEAL_ALG; kid: string; epk: string; ct: string } }
export function pairingSigningInput(b: UnsignedPairing | SignedPairing): Uint8Array;     // F10
export function signPairing(b: UnsignedPairing, s: Signer): SignedPairing;
export function pairingBytes(b: SignedPairing): Uint8Array;
export function readPairing(bytes: Uint8Array): SignedPairing;                          // parseCanonical, then F10's shape; exhibit via readExhibitP
export function checkPairingSignature(b: SignedPairing, pub: Uint8Array): boolean;
export function pairingHash(b: UnsignedPairing | SignedPairing): string; export function pairingNo(b: UnsignedPairing | SignedPairing): string;
export function sealPairing(b: SignedPairing, recipientPub: Uint8Array, o?: { ephemeral?: XKey; rand?: Rand }): SealedPairing;   // F11
export function sealedPairingBytes(s: SealedPairing): Uint8Array; export function readSealedPairing(bytes: Uint8Array): SealedPairing;
export function openSealedPairing(s: SealedPairing, key: XKey & { kid: string }): SignedPairing;
// test/kit/pairing.ts
export function vectorPairing(): SignedPairing;                                         // V10
```

- [ ] **Step 1: Write the failing tests.**
  - **Vectors:** V10 and V11 exactly. V8′ still holds through `sealBundle`.
  - **Shape** (`readPairing` → `bad-format`, one case each):
    - an extra key; `invite: null`;
    - `endedAt ≤ startedAt`, or a span of 4 h + 1 s;
    - a lower-case code;
    - unsorted or duplicated `fps`, an 11-hex entry, or 4,097 entries;
    - 13 sessions, or unsorted sessions;
    - a bad exhibit (→ `payload-malformed`);
    - `meta.keyId ≠ signature.keyId`.
  - **Tamper:**
    - XOR every byte of the V10 file with `0x01`: `readPairing` throws or `checkPairingSignature` is false;
    - every byte of V11: `readSealedPairing`, `openSealedPairing` or the inner signature fails;
    - 2-space indent, a trailing `\n`, a BOM and CRLF → `not-canonical`.
  - **Cross-format:**
    - `openSealed` (F6) on V11 → `seal-failed`;
    - `openSealedPairing` on V8′ → `bad-format`.
  - **Budget:** a pairing with 4,096 continuity entries and Plan 3 Task 7's worst-case loupe (12 lanes, 600 bins) is at most `PAIRING_BUDGET`.
- [ ] **Step 2: Run** `bun test test/session/bundle.test.ts test/trust/seal.test.ts` → FAIL. **Step 3: Implement.**
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(session): the aiprof-pair/1 format — canonical, signed, sealed with its own info string, byte-flip tamper suite`.

---

### Task 10: `session start` and `session end`

**Files:**
- Create:
  - `src/session/{state,continuity}.ts` and `src/cli/session.ts`;
  - `src/cli/scan-options.ts` and `test/cli/scan-options.test.ts` (pre-flight J8);
  - `test/session/{state,continuity}.test.ts` and `test/cli/session.test.ts`.
- Modify:
  - `src/home.ts`: `ProfilerHome` gains `pairing` and `calibration`;
  - `src/consent/fingerprints.ts`: export `fingerprintCandidates`, which `pickFingerprints` now uses, and `isStableId` (pre-flight J9);
  - `src/cli/{args,main,help}.ts`;
  - `src/cli/{run,find}.ts`: the candidate run and `find` pass `candidateScan(…)` to `scan` (pre-flight J8);
  - `src/cli/explain.ts`: the written files gain `$AIPROF_HOME/pairing.json` and `ai-profile-pairing-<code>.aiprof` (pre-flight J4);
  - `test/kit/pairing.ts`: add `personaPairing`.

**Interfaces:**
- **Consumes:**
  - Task 8's `buildExhibitP` and `MAX_PAIRING_MS`;
  - Task 9's format;
  - Task 7's `requestTimestamp`;
  - Plan 4's `parseInvite`, `inviteStatus`, `classify`, `readSealed`, `resolveSigner`, `sessionFingerprint`, `sizeBucket`, `writePrivate`, `ensurePrivateDir`, `slug`, `tildify` and `consentLoop`'s IO type.
- **Produces:**
```ts
// consent/fingerprints.ts
export function fingerprintCandidates(raw: ScanResult, o: { timeZone: string; exclude: NonNullable<AnalyzeOptions["exclude"]> }):
  Array<{ id: string; tool: ToolId; start: number; actions: number }>;   // F7's candidate rule, plus isStableId (pre-flight J9)
export function isStableId(sessionId: string): boolean;   // the part after "<tool>:" is a UUID, `ses_…` or `T-<uuid>`; every P0 id qualifies; Plan 6 swaps in core's stableSessionId (pre-flight J9)
// cli/scan-options.ts — one scan rule for the candidate run, find and session end (pre-flight J8)
export function candidateScan(o: { platform: "darwin" | "linux" | "win32"; repoSignals: boolean }): { wsl: boolean; repoSignals: boolean };   // wsl: platform === "win32"
// session/state.ts — F15
export interface PairingState { v: 1; code: string; startedAt: number; invite: string; bundle: { fileSha256: string } | null; tools: ToolId[] | null }
export function startCode(rand: Rand): string;                          // rand(4) → "XXXX-XXXX", upper-case hex
export function readPairingState(h: ProfilerHome): PairingState | null; // null when absent; Error("damaged")
export function writePairingState(h: ProfilerHome, s: PairingState): void; export function clearPairingState(h: ProfilerHome): void;
// session/continuity.ts
export function continuitySet(raw: ScanResult, nonce: Uint8Array, before: number, o: { timeZone: string }): { fps: string[]; more: number };
export function pairingSessions(raw: ScanResult, nonce: Uint8Array, from: number, to: number, o: { timeZone: string }): PairingSessionRef[];
export function assemblePairing(i: { raw: ScanResult; invite: Invite; bundleFileSha256: string | null; startedAt: number; endedAt: number; code: string;
  signer: Pick<Signer, "keyId" | "build" | "pub">; createdAt: number; timeZone: string }): UnsignedPairing;
// cli/session.ts
export const PAIRING_NOTICE: readonly string[];                          // exact (Copy)
export async function runSessionStart(o: { invite: string | null; bundle: string | null; tools: ToolId[] | null; yes: boolean; force: boolean }, d: Deps): Promise<number>;
export async function runSessionEnd(o: { out: string | null; yes: boolean; timestamp: boolean; tsa: string | null; discard: boolean }, d: Deps): Promise<number>;
// args.ts — Command gains
| { k: "session-start"; invite: string | null; bundle: string | null; tools: ToolId[] | null; yes: boolean; force: boolean }
| { k: "session-end"; out: string | null; yes: boolean; timestamp: boolean; tsa: string | null; discard: boolean }
// test/kit/pairing.ts
export function personaPairing(kind: "novice" | "intermediate" | "expert", o: { invite: Invite; bundleFileSha256?: string | null; window?: [number, number];
  signer?: Signer; seal?: boolean }): { pairing: SignedPairing; bytes: Uint8Array };
  // the default window is the 20 minutes from the latest top-level detail session's start
```

**Rules.**
- **`continuitySet`:** `fingerprintCandidates` with no exclusions and `start < before`. Keep the 4,096 latest by start. Take `sessionFingerprint(nonce, id).slice(0, 12)`, then sort and dedupe; `more` counts the rest.
- **`pairingSessions`:** the rows that Task 8's totals count: the slice's `detailTop` rows with a kept event in their tree, whose ids pass `isStableId` (pre-flight J9).
  - `kind` is `resumed` when the start in `raw` is before `from`.
  - `size` is `sizeBucket` of the tree's in-window actions.
  - Keep 12, by actions descending, then the later start, then the id. Sort the output by `fp`.
- **`session start`:**
  1. **The invite:** from `--invite`, or from the clear `invite` of `--bundle FILE`. A `signed` or `sealed` file holds it. When both are given they must match, else exit 2. A file that is not an `.aiprof` → exit 2.
  2. **Expiry:** an expired invite is accepted. `tty` prints "This invite expired on <date>; the recording still binds to it."
  3. **An open recording,** without `--force` → exit 1: "a recording is already open (code <code>, started <time>); run ai-profiler session end, or session start --force to replace it".
  4. **Consent:** without `--yes` it needs a TTY, else exit 2. `tty` prints `PAIRING_NOTICE` and `[c] start recording   [q] quit (nothing is recorded)`. `q`, or the end of input, exits 0 and writes nothing.
  5. **State:** `startedAt = d.now()` and `code = startCode(rand)`. Write the state (0600). No scan runs.
  6. **Stdout:** `Recording started <YYYY-MM-DD HH:MM:SS> UTC (this computer's clock) · code <code>. Show this line to the interviewer, and run ai-profiler session end when the exercise is over.` (pre-flight J10)
- **`session end`:**
  1. **The state:** missing → exit 1, "no recording is open; run ai-profiler session start first". Damaged → exit 1, with its message.
  2. **`--discard`:** clear the state, print "The recording was discarded; nothing was written.", and exit 0.
  3. **The window:** `endedAt = d.now()`. When `endedAt − startedAt > MAX_PAIRING_MS` → exit 1, "this recording started more than 4 hours ago; run ai-profiler session end --discard and start a new one". When `endedAt < startedAt` → exit 1, "the clock moved back since the recording started; …--discard…".
  4. **The scan:** `scan({ env: d.scanEnv, tools, ...candidateScan({ platform: d.sys.platform, repoSignals: false }), handleSignals: true })`, with Plan 4's progress rules (pre-flight J8). Then `assemblePairing`, with the process time zone.
  5. **Consent:** unless `--yes`, `tty` prints the summary:
     - the span;
     - sessions (resumed) and typed turns;
     - actions and subagents;
     - checks run and failed;
     - continuity `<n>` sessions.

     Then the menu: `[v] show the exact bytes  [5] timestamp (network) now: <off|on>  [c] confirm and <seal|sign>  [q] quit (nothing is written; the recording stays open)`.
  6. **Writing:** sign, then timestamp (Task 7's rules, with no `exp` limit), then seal when the invite has `sealTo`. Write `<cwd>/ai-profile-pairing-<code>.aiprof`, or `--out`, at 0600.
  7. **Finish:** clear the state. Print `Wrote <tildified path> (sealed to <company> | signed, not sealed)` and "Send it to the interviewer with your .aiprof file." Exit 0.

  A timestamp failure under `--yes` → exit 1, with nothing written and the state kept.

- [ ] **Step 1: Write the failing tests,** through `main` with `testSys`, a `fakeHome` with `allBuilders`, `testSigner()` and an injected clock. The window is chosen from a first `scan` of that home: from 1 min before a known top-level session's start to 20 min after it.
  - **Start:**
    - `--bundle <sealed file> --yes` → exit 0, the state with exactly the F15 keys at 0600, the stdout line with its UTC time (pre-flight J10), and no "Scanning" in `tty`;
    - `--invite X --bundle <file for Y>` → exit 2;
    - a second start → exit 1, and `--force` replaces it;
    - no TTY and no `--yes` → exit 2;
    - `["q"]` → exit 0 and no state.
  - **End:**
    - with no state → exit 1;
    - `--discard` → exit 0, the state gone, no file;
    - the clock at `startedAt + 4 h + 1 s` → exit 1 naming `--discard`; the clock moved back → exit 1.
    - **`--yes` (sealed invite)** gives a file that opens with the company key and passes `readPairing`, where:
      - `sessions` holds that session, `fp` = `sessionFingerprint(nonce, id)` and `kind: "resumed"` when it started before the window;
      - `continuity` equals `continuitySet(raw, nonce, startedAt, { timeZone })`, with the run's zone;
      - `window.code` equals the state's;
      - the state is removed, and the file is 0600.
    - **Interactive:** `["v","c"]` prints the exact signing bytes, then writes. `["q"]` writes nothing and keeps the state.
    - **`--yes --timestamp`** with a fake TSA → a verifiable member.
    - **`--tools codex`** restricts both `sessions` and `continuity` to Codex.
    - **An expired invite** → accepted, with the note (Review Focus 2).
  - **`continuitySet`** on a store with 5,000 candidates → 4,096 fps, `more: 904`, sorted and unique.
  - **`isStableId`** (pre-flight J9): a UUID, `ses_…` or `T-<uuid>` id → true; a keyed-hash id → false; F7's picks, `continuitySet` and `pairingSessions` all skip a keyed-hash session.
  - **One scan rule** (pre-flight J8): `candidateScan` gives `wsl: true` on win32 and `false` on darwin and linux and passes `repoSignals` through; `src/cli/{run,find,session}.ts` each pass its result to `scan`, so the three scans agree.
  - **Explain:** `--explain` lists `pairing.json` and the pairing file (pre-flight J4).
  - **Canaries:** `expectNoCanaries` over the state file, the pairing bytes and stdout/stderr, on the canaries persona.
- [ ] **Step 2: Run** `bun test test/session test/cli/session.test.ts` → FAIL. **Step 3: Implement.**
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(session): session start notes the time; session end slices, fingerprints, signs and seals the pairing`.

---

### Task 11: Verifying pairings — on their own and with their `.aiprof`

**Files:**
- Create: `src/trust/verify-pairing.ts`, `test/trust/verify-pairing.test.ts`
- Modify:
  - `src/trust/verify.ts`: F9′; extract `authenticate`; `verifyBytes` on a pairing kind gives `bad-format`;
  - `src/trust/errors.ts`: add `pairing-other-bundle`;
  - `src/cli/{args,verify}.ts`: `--pairing FILE`, and `verifyFile`;
  - `src/console/model.ts`: pairing files are rejected with "a pairing file: verify it with its .aiprof, using --pairing";
  - `test/cli/verify.test.ts`.

**Interfaces:**
- **Consumes:** Task 9's readers and opener; Task 6's timestamp check; Plan 4's `parseInvite`, `VerifyContext`, `Failure`, `Authenticity` and `bannerLines`.
- **Produces:**
```ts
// verify.ts
export function authenticate(meta: BundleMeta, signingInput: Uint8Array, sig: { keyId: string; sig: string }, trust: ReadonlyMap<string, TrustedKey>): Authenticity | Failure;
// verify-pairing.ts
export interface PairingLink { sameInvite: boolean; bundleMatches: boolean | null; continuity: { found: number; of: number } | null }
export interface PairingVerified { sealed: boolean; meta: BundleMeta; invite: Invite; bundle: { fileSha256: string } | null;
  window: { startedAt: number; endedAt: number; code: string }; continuity: { fps: string[]; more: number }; sessions: PairingSessionRef[];
  exhibit: ExhibitP; timestamp: TokenCheck | null; payloadHash: string; dossierNo: string; fileSha256: string; bytes: number }
export interface PairingReport { file: string; kind: InputKind; exit: 0 | 1 | 3; failures: Failure[]; notes: string[]; authenticity: Authenticity | null;
  verified: PairingVerified | null; link: PairingLink | null }
export function verifyPairingBytes(file: string, bytes: Uint8Array, ctx: VerifyContext, main?: { report: VerifyReport; fileSha256: string } | null): PairingReport;
export function pairingBannerLines(r: PairingReport): string[];
// cli/verify.ts
export async function verifyFile(path: string, d: Deps, o: { invite: string | null }):
  Promise<{ ok: true; bytes: Uint8Array; fileSha256: string; kind: InputKind; ctx: VerifyContext } | { ok: false; exit: 1 | 2; message: string }>;
// args.ts — the verify command gains
pairing: string | null;
```

**Algorithm** (`verifyPairingBytes`, in this order):
1. **Kind:** `pairing` or `sealed-pairing`, else `bad-format`.
2. **Sealed:** without a company key → `no-company-key`. Otherwise `openSealedPairing`.
3. **Read and authenticate:** `readPairing`, then `authenticate`.
4. **Timestamp:** F12, with no upper bound.
5. **Invite:**
   - `parseInvite`, and `companyMatches` as in Plan 4;
   - `ctx.expectInvite` → `invite-mismatch`;
   - `createdAt ≥ iat − 300 s`, else `outside-invite-window`;
   - the sealing must match `sealTo`, as in Plan 4, else `bad-format`;
   - after `exp`, add the note "recorded <n> days after the invite expired (normal for an interview)".
6. **With `main`:**
   - a different invite id → `invite-mismatch`;
   - `bundle` set and unequal to `main.fileSha256` → `pairing-other-bundle`;
   - continuity: `of` = `main.report.verified.fingerprints.length`, and `found` = those whose first 12 hex characters are in `continuity.fps`. Without fingerprints it is `null`.

   Without `main`, add the note "verify it with its .aiprof to check continuity: ai-profiler verify <their .aiprof> --pairing <this file>".
7. **Exhibit:** `readExhibitP`, else `payload-malformed`.
8. **Exit:** as Plan 4: any failure → 1, a dev build → 3, otherwise 0.

**Banner line 1** (`pairingBannerLines`):
- `Pairing <code> · ` plus Plan 4's authenticity text;
- ` · <YYYY-MM-DD HH:MM>–<HH:MM> UTC (candidate's clock)`;
- ` · same invite`;
- ` · <found> of <of> fingerprinted sessions on the pairing machine`, or ` · continuity not checked`;
- ` · TSA <YYYY-MM-DD HH:MM> UTC` when timestamped.

`found = 0` with `of ≥ 1` adds `note: none of the .aiprof's fingerprinted sessions are on the pairing machine: a different computer, or history cleared since; ask about it`.

**`verify` dispatch.**
- `verify FILE` where FILE is a pairing kind → `verifyPairingBytes` alone. It prints the banner; the standalone page arrives in Task 12.
- `verify FILE --pairing P` → verify FILE, then P with `main`, and print both banners.
- Exit: 1 when either failed, else 3 when either is a dev build, else 0. A failure writes nothing.

- [ ] **Step 1: Write the failing tests,** using `personaBundle` plus `personaPairing` with one invite.
  - **Classify:** V10 → `pairing`; V11 → `sealed-pairing`; `verifyBytes(V10)` → `bad-format`.
  - **Continuity:**
    - a window after every session → 8 of 8 (the bundle's fingerprints are all candidates);
    - a pairing built from another persona store → 0 of 8, with the note;
    - an invite without `fingerprints` → `continuity: null` and "continuity not checked".
  - **Links:** another invite → `invite-mismatch`; a wrong `bundle` hash → `pairing-other-bundle`; `bundle: null` → `bundleMatches: null`.
  - **Times:** V10 against V6 (after `exp`) → exit 0 with the expiry note; `createdAt = iat − 301 s` → `outside-invite-window`.
  - **Authenticity:** a dev signer → exit 3; sealed with no company key → `no-company-key`.
  - **A timestamped pairing** → the TSA part of the banner.
  - **The CLI:**
    - `verify MAIN --pairing P` → two banners, exit 0;
    - a flipped byte in P → exit 1, and no dossier is written;
    - `verify P` alone → the banner and the continuity note, exit 0;
    - `compare` lists P under rejected.
- [ ] **Step 2: Run** `bun test test/trust/verify-pairing.test.ts test/cli/verify.test.ts` → FAIL. **Step 3: Implement.**
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(verify): pairing files — authenticity, invite, bundle hash and machine continuity; --pairing`.

---

### Task 12: Exhibit P in the dossier, the standalone pairing page, and the kit's pairing step

**Files:**
- Create: `src/dossier/pairing.ts`, `src/dossier/sections/pairing.ts`, `test/dossier/pairing.test.ts`
- Modify:
  - `src/dossier/{model,render,method}.ts`: `DossierInput.pairing`, `DossierModel.pairing`, and the §5 and §6 parts;
  - `src/kit/generate.ts`: `KitModel.pairing` and `AGENDA[2]`;
  - `src/render/index.ts` and `src/cli/main.ts`: `Renderers.pairingPage`;
  - `src/cli/verify.ts`: write the standalone page;
  - `test/kit/dossiers.ts`: add the kinds `"timestamped"` and `"paired"`, plus `pairingPageFixture()`.

**Interfaces:**
- **Consumes:** Task 11's `PairingReport`; `renderKit` (`figure`, `swimlanes`, `delegationOutline`, `verificationFunnel`, `fmt`, `esc`, `icon`, `page`); Plan 4's `FUNNEL_LABELS`, `DOSSIER_CSS` and `renderDossier`.
- **Produces:**
```ts
// dossier/pairing.ts
export interface PairingSection { code: string; window: { day: string; start: string; end: string; span: string }; lines: string[]; flagged: boolean;
  exhibit: ExhibitP; sessions: Array<{ fp: string; tool: ToolId; kind: "new" | "resumed"; size: string }>; caption: string; method: Array<[string, string]> }
export interface PairingPageModel { title: string; pairingNo: string; banners: Array<{ kind: string; text: string }>; section: PairingSection; footerLeft: string }
export function hhmm(ms: number): string;                                  // two-digit UTC hours, ":", minutes
export function buildPairingSection(r: PairingReport): PairingSection;     // r.verified must be set
export function buildPairingPage(r: PairingReport): PairingPageModel;
// dossier/sections/pairing.ts
export function renderPairingSection(s: PairingSection): string;
export function renderPairingPage(m: PairingPageModel, o?: { fonts?: "embed" | "none" }): string;
// kit/generate.ts — KitModel gains
pairing: { start: string; end: string };   // "ai-profiler session start --bundle <their .aiprof file>", "ai-profiler session end"
```

**Rules.**
- **The section's link `lines`,** in order:
  1. "Same invite as the .aiprof (<displayId>)."
  2. "Linked to the .aiprof file by its hash.", or "Not linked to a file: the candidate did not name one."
  3. The continuity sentence: "<found> of <of> fingerprinted sessions from the .aiprof are on the pairing machine.", "Continuity cannot be checked: the invite did not request fingerprints.", or, for 0 of n ≥ 1 (with `flagged`), "None of the .aiprof's fingerprinted sessions are on the pairing machine: a different computer, or history cleared since. Ask about it."
  4. "Start code <code> at <HH:MM> (UTC, candidate's clock): compare it with what you saw on screen."
- **Caption:** "During the {span} pairing, {sessions} agent sessions ran {actions} actions over {turns} typed turns, with {subagents} subagents; checks ran {run} times and {failed} failed." Numbers go through `fmt`.
- **The figure:**
  - id `ex-p`, letter `P`, title "Pairing session", tag `PAIRING · n=<actions>`;
  - body:
    1. the lines, with a flag icon when flagged;
    2. a totals table of label and value, using the core's tool, child and window labels;
    3. `swimlanes` when there is a loupe;
    4. `delegationOutline` when there is a root;
    5. `verificationFunnel(FUNNEL_LABELS)`;
    6. the sessions table (fp, tool, new or resumed, size).
  - With no actions: the empty state, "no local agent activity was recorded in this window".
- **Where it goes:**
  - In the recruiter dossier, §5 shows `KitModel.pairing` under the walkthrough, then `renderPairingSection` when a pairing is given.
  - §6 gains a "pairing" group: file, bytes and SHA-256; signature; window and code; link; timestamp.
  - The chapter order is unchanged.
- **The standalone page** holds the masthead "AI LEVERAGE ASSAY · PAIRING · No. <pairingNo>", the banners, the section and the method rows. It has no `s0`–`s5`. `verify P` writes `<cwd>/<stem>.dossier.html`, or `--out`, at 0600.

- [ ] **Step 1: Write the failing tests.**
  - **Audit** for the `paired` dossier, `pairingPageFixture()`, and a worst-case pairing (12 lanes, 48 delegation groups): `cspOk`, no external refs, 0 style attributes, 0 inline handlers, fewer than 5,000 elements, and `uncovered` empty.
  - **Structure:**
    - `#ex-p` is in §5, after the last probe card, with one `figcaption`;
    - the §6 pairing rows are present;
    - the page has no `id="s5"`.
  - **Lines:** each continuity case, the flag icon only when flagged, and the start code.
  - **Escaping:** an odd-names subject does not reach the section, which holds no names.
  - **Text scan:** no "NaN", "undefined" or "null" outside `<pre>`, `<script>` and `<style>`.
  - **Determinism:** byte-identical under two time zones, plus a snapshot of the section body with `fonts: "none"`.
  - **Kit:** `pairing.start` and `pairing.end`, and the amended `AGENDA[2]`, are in §5 and print.
  - **The CLI:** `verify P` writes the page and opens it once. `--no-open` opens nothing.
- [ ] **Step 2: Run** `bun test test/dossier` → FAIL. **Step 3: Implement.**
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS. Commit the snapshot.
- [ ] **Step 5: Commit** `feat(dossier): Exhibit P in §5 with its links and chain of custody; standalone pairing page; the kit's pairing step`.

---

### Task 13: The brief — digest, exact bytes, runner, reply

**Files:**
- Create: `src/brief/{digest,prompt,runner,reply}.ts`, `test/kit/fake-cli.ts`, `test/brief/{digest,runner,reply}.test.ts`
- Modify: `test/repo/touchpoints.test.ts`, adding `src/brief/runner.ts` to `ALLOW.spawn`

**Interfaces:**
- **Consumes:** Plan 4's `VerifyReport`, `KitModel` and `RoleFit`; Task 8's `PairingTotals`; Plan 4's `jcs` and `sha256Hex`; `renderKit.uncoveredChars`; B's `modelExportId`.
- **Produces:**
```ts
// digest.ts
export interface BriefDigest { v: 1; authenticity: "release" | "trusted-env";
  integrity: { band: IntegrityView["band"]; checks: Array<{ id: CheckId; status: CheckStatus; reason: string }> } | null;
  overall: PayloadView["overall"];
  dimensions: Array<{ id: DimensionId; status: DimView["status"]; score: number | null; interval: [number, number] | null; confidence: Confidence | null;
    n: number; needs: number | null; window: "detail" | "lifetime"; components: Array<{ id: string; status: string; z: number | null; n: number }> }>;
  role: { id: string; mustHaves: Array<{ dimension: DimensionId; targetBand: TargetBand; fit: Fit }> } | null;
  exposure: { tenureWeeks: number; activeWeeks: { detail: number; lifetime: number };
    tools: Array<{ tool: ToolId; window: "detail" | "lifetime"; sessions: number; prompts: number }> } | null;
  kit: Array<{ n: number; probeId: string | null; dimension: DimensionId | null; ask: string }>; pairing: PairingTotals | null }
export function briefDigest(r: VerifyReport, o: { kit: KitModel | null; fit: RoleFit | null; pairing: PairingTotals | null }): BriefDigest;   // r.exit === 0
// prompt.ts
export const BRIEF_INSTRUCTIONS: readonly string[]; export const BRIEF_SCHEMA: Readonly<Record<string, unknown>>; export const BRIEF_MAX_BYTES = 32_768;
export function briefPrompt(d: BriefDigest): Uint8Array;                   // F17; Error when it is over the limit
// runner.ts
export type BriefCli = "claude" | "codex";
export const BRIEF_TIMEOUT_MS = 180_000; export const BRIEF_STDOUT_MAX = 1_048_576;
export function findBriefCli(vars: Sys["vars"], platform: Sys["platform"], prefer: BriefCli | null): { cli: BriefCli; path: string } | null;   // Bun.which with vars.PATH; prefer, else claude then codex
export function briefArgv(cli: BriefCli, path: string, dir: string): string[];   // F17
export function briefEnv(cli: BriefCli, vars: Sys["vars"]): Record<string, string>;   // F17's env, on top of vars (pre-flight J6)
export type BriefFailure = "not-installed" | "unsupported-shim" | "timeout" | "too-large" | "cli-failed" | "cli-error" | "bad-reply";
export async function runBrief(o: { cli: BriefCli; path: string; prompt: Uint8Array; vars: Sys["vars"]; platform: Sys["platform"]; timeoutMs?: number }):
  Promise<{ ok: true; stdout: Uint8Array; lastMessage: string | null } | { ok: false; reason: BriefFailure }>;
// reply.ts
export const RECOMMENDATION: RegExp;   // /\b(?:hire|hiring|hired|no-hire)\b|\b(?:reject|advance|rank|shortlist|recommend)(?:s|ed|ing)? (?:him|her|them|this candidate|the candidate)\b|\brecommend(?:s|ed|ing)? (?:hiring|rejecting|advancing)\b/i (pre-flight J12)
export interface BriefReply { notes: string[]; probes: Array<{ dimension: DimensionId; ask: string; listen: string }>; cautions: string[]; dropped: number; model: string | null }
export function parseBriefReply(cli: BriefCli, run: { stdout: Uint8Array; lastMessage: string | null }): { ok: true; reply: BriefReply } | { ok: false; reason: BriefFailure };
export const BRIEF_FAILURE_TEXT: Readonly<Record<BriefFailure, string>>;
// test/kit/fake-cli.ts
export function installFakeCli(dir: string, cli: BriefCli, behaviour: "ok" | "prose" | "hang" | "flood" | "fail" | "is-error" | "recommend" | "emoji",
  o?: { reply?: unknown; model?: string }): { stdinFile: string; argvFile: string };   // a POSIX script; records stdin and argv
```

**Rules.**
- **The digest** reads only the fields named in its type, from `r.verified`'s views, the kit and the fit, and nothing else.
  - It never includes `subject`, the invite or its log, the company, `projects`, `fingerprints`, `dossierNo`, file names or dates.
  - Each kit card's `ask` is A's own pinned copy.
- **The runner:**
  - **Setup:** create `dir` with `mkdtempSync(join(tmpdir(), "ai-profiler-brief-"))`. For codex, write `brief.schema.json` there.
  - **Spawn:** `Bun.spawn(briefArgv(...))` with `cwd: dir`, `env: briefEnv(cli, vars)` (pre-flight J6), stdin = the prompt, stdout piped, `stderr: "ignore"`.
  - **Limits:** stop reading and kill after `BRIEF_STDOUT_MAX` bytes; send SIGKILL at the timeout.
  - **Exit:** a non-zero exit is `cli-failed`.
  - **codex:** read `brief.reply.txt` into `lastMessage`.
  - **Cleanup:** remove `dir` in `finally`.
  - **win32:** a resolved path ending `.cmd` or `.bat` is `unsupported-shim`.
- **The reply:**
  - **claude:** `JSON.parse(stdout)`. `is_error` or `subtype ≠ "success"` is `cli-error`. The body is `structured_output` when it is an object, else `JSON.parse(stripFence(result))`.
  - **codex:** `JSON.parse(stripFence(lastMessage))`.
  - **Missing arrays:** `bad-reply`.
  - **Limits and cleaning:**
    - notes: at most 8, of at most 280 characters each;
    - probes: at most 4, with `dimension` in `DIMENSIONS`, and `ask` and `listen` at most 220 characters;
    - cautions: at most 4, of at most 280 characters;
    - a cut string ends with "…";
    - non-strings are dropped;
    - each string gets NFC, control characters removed, whitespace collapsed, and every `uncoveredChars` character replaced with `?`.
  - **The guard:** any string matching `RECOMMENDATION` is dropped and counted in `dropped`.
  - **The model** is the first key of claude's `modelUsage`, sorted, through `modelExportId`; it is `null` otherwise.

- [ ] **Step 1: Write the failing tests** (Review Focus 4; the runner tests skip on win32).
  - **Digest:**
    - its keys are exactly the type's;
    - on the `odd-names` kind with revealed projects, `fromUtf8(briefPrompt(…))` passes `expectNoCanaries`, and contains none of: the subject name, the invite-log name, the company name, any label, the dossier No., any fingerprint, and the invite id;
    - deterministic;
    - at most `BRIEF_MAX_BYTES` for the expert persona with a pairing.
  - **Prompt:** it starts with exactly `BRIEF_INSTRUCTIONS.join("\n")` and ends with `"\n"`.
  - **`briefArgv` and `briefEnv`:** the exact arrays and variables of F17 (pre-flight J6).
  - **Runner** with fake CLIs on a temp `PATH`:
    - **stdin:** the recorded stdin equals the prompt bytes;
    - **argv:** the recorded argv equals `briefArgv(...)`;
    - **cwd:** a 0700 folder holding no other files, gone afterwards;
    - **failures:**
      - `hang` with `timeoutMs: 500` → `timeout`, within 2 s;
      - `flood` → `too-large`;
      - `fail` → `cli-failed`;
      - an empty `PATH` → `findBriefCli` gives `null`.
  - **Reply:**
    - claude `structured_output`;
    - `result` JSON inside a ```` ```json ```` fence;
    - `prose` → `bad-reply`;
    - `is-error` → `cli-error`;
    - 10 notes → 8;
    - a 400-character note → 280, ending "…";
    - `recommend` (notes "We recommend hiring her.", "Do not hire.", "Rank them first.") → all three dropped, `dropped: 3`; the notes "The candidate rejected 3 agent tool calls." and "Ask about their recommended test command." are kept (pre-flight J12);
    - `emoji` → `?` in place of each uncovered character;
    - the model from `modelUsage`.
  - **Touchpoints:** the test passes with the new entry.
- [ ] **Step 2: Run** `bun test test/brief` → FAIL. **Step 3: Implement** the modules and the fake CLI kit.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(brief): allowlisted digest, exact stdin bytes, sandboxed run of the recruiter's own CLI, sanitized reply with a recommendation guard`.

---

### Task 14: `verify --brief` — confirmation and the AI-drafted section

**Files:**
- Create: `src/cli/brief.ts`, `src/dossier/sections/brief.ts`, `test/cli/brief.test.ts`
- Modify:
  - `src/cli/{args,verify,help}.ts`;
  - `src/dossier/{model,render,copy}.ts`: `DossierInput.brief`, `DossierModel.brief` and `BRIEF_LABEL`;
  - `test/kit/dossiers.ts`: add the kind `"briefed"`.

**Interfaces:**
- **Consumes:** Task 13's modules; Task 12's dossier inputs; Plan 4's `Deps.tty`, `readLine`, `isTTY`, `generateKit` and `roleFit`.
- **Produces:**
```ts
// cli/brief.ts
export interface BriefSection { cli: BriefCli; model: string | null; inputSha256: string; bytes: number; sent: string;
  notes: string[]; probes: BriefReply["probes"]; cautions: string[]; dropped: number }
export async function runBriefFlow(r: VerifyReport, o: { prefer: BriefCli | null; kit: KitModel | null; fit: RoleFit | null; pairing: PairingTotals | null },
  d: Deps): Promise<BriefSection | null>;
// sections/brief.ts
export function renderBriefSection(s: BriefSection): string;
// args.ts — the verify command gains
brief: BriefCli | "auto" | null;   // --brief, --brief claude, --brief codex
```

**Rules.**
- **Parsing:** `--brief` takes a value only when the next token is `claude` or `codex`. Without a TTY → exit 2 before anything is read: "--brief needs a terminal, to show you the bytes and ask before sending".
- **The flow:**
  1. Verify, and build the dossier model.
  2. When `r.exit ≠ 0`: print "the brief runs only on verified bundles; this one is <a dev build | self-reported>", send nothing, and write the dossier.
  3. `findBriefCli`. With no CLI: print "no claude or codex CLI found on PATH; the dossier is written without a brief".
  4. Build the digest and the prompt.
  5. `tty` prints:
     ```
     AI brief: ai-profiler will run this on your computer, with your own <cli> account:
       <argv, space-joined, the schema shown as <BRIEF_SCHEMA>>
     and send it these <n> bytes on standard input (SHA-256 <16 hex>):
     -----
     <the exact bytes>
     -----
     They hold scores, counts and check results only: no names, labels, ids or dates.
     Send them? [y/N]
     ```
  6. Only `y` or `yes` (any case) sends. Anything else prints "Not sent."
  7. Run, then parse. On failure, print `the brief failed: <BRIEF_FAILURE_TEXT>` and write the dossier without it.
  8. The exit code is always the verification's.
- **The section** sits in §5 after the probe cards, and before Ex.P:
  - id `s5-brief`, heading "AI-drafted prep notes", then `BRIEF_LABEL`;
  - notes as a list, extra probes as cards headed "AI-DRAFTED", and cautions;
  - "<k> lines were dropped because they read as a recommendation" when `dropped > 0`;
  - the exact bytes sent, in `<details data-print="skip">`.

  It is in recruiter mode only.

- [ ] **Step 1: Write the failing tests,** through `main` with a fake CLI on `PATH`, `isTTY`, and a scripted `readLine` (Review Focus 4).
  - **"y":**
    - the CLI ran once, and its recorded stdin equals the bytes shown in `tty` between the `-----` lines;
    - the dossier has `#s5-brief`, with `BRIEF_LABEL`, the model and the SHA-256 prefix;
    - its `<pre>` text, unescaped, equals the bytes sent;
    - the audit is clean.
  - **"n" or end of input** → not run, no section, exit 0.
  - **No TTY** → exit 2, and no dossier is written.
  - **A dev bundle** → not run, exit 3, the dossier is written.
  - **`hang`, `prose` and `fail`** → the dossier without the section, the stderr note, and exit 0.
  - **No CLI** → the note.
  - **`recommend`** → the "dropped" line, and none of the three sentences in the HTML.
  - **Scores unchanged:** `certificate`, `ledger`, `findings` and `kit` deep-equal with and without the brief.
  - **Modes:** the preview and candidate copy never hold `s5-brief`.
- [ ] **Step 2: Run** `bun test test/cli/brief.test.ts test/dossier` → FAIL. **Step 3: Implement.**
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(verify): --brief shows the exact bytes, asks, then adds AI-drafted prep notes that change no score`.

---

### Task 15: `calibrate` — the log, the statistics, the report

**Files:**
- Create: `src/calibrate/{log,stats,report}.ts`, `src/cli/calibrate.ts`, `test/calibrate/{log,stats,report}.test.ts`, `test/cli/calibrate.test.ts`
- Modify: `src/cli/{args,main,help}.ts`, and `src/cli/explain.ts`, whose written files gain `$AIPROF_HOME/calibration.jsonl` (pre-flight J4)

**Interfaces:**
- **Consumes:** Task 11's `verifyFile`; Plan 4's `verifyBytes`, `loadRoles`, `roleFit`, `generateKit`, `DIMENSIONS`, `DIMENSION_LABEL`, `profilerHome` and `writePrivate`; Task 10's `ProfilerHome.calibration`.
- **Produces:**
```ts
// log.ts — F16
export type Decision = "advanced" | "not-advanced" | "withdrew";
export interface CalRubric { v: 1; kind: "rubric"; at: string; dossierNo: string; role: string | null; roleHash: string | null;
  dims: Array<{ id: DimensionId; status: DimView["status"]; score: number | null; lo: number | null; hi: number | null; confidence: Confidence | null }>;
  probes: Array<{ card: number; probeId: string | null; dimension: DimensionId | null; score: 1 | 2 | 3 | 4 }>; decision: Decision | null }
export interface CalOutcome { v: 1; kind: "outcome"; at: string; dossierNo: string; decision: Decision | null; rating: 1 | 2 | 3 | 4 | null; months: number | null }
export interface CalRecord { dossierNo: string; rubric: CalRubric; decision: Decision | null; rating: 1 | 2 | 3 | 4 | null; months: number | null }
export function appendCalibration(h: ProfilerHome, e: CalRubric | CalOutcome): void;   // JSON Lines, 0600
export function readCalibration(h: ProfilerHome): { records: CalRecord[]; skipped: number; versions: Map<string, Set<string>> /* role → hashes seen */ };
// stats.ts
export function ranks(v: readonly number[]): number[]; export function spearman(x: readonly number[], y: readonly number[]): number | null;
export function mulberry32(seed: number): () => number;   // the standard algorithm (M1)
export interface Stat { n: number; rho: number | null; interval: [number, number] | null; status: "ok" | "too-few" | "constant" }
export const MIN_STAT_N = 5; export const MIN_SUGGEST_N = 20; export const BOOT_B = 1000; export const BOOT_SEED = 0x5eed;
export function relation(x: readonly number[], y: readonly number[]): Stat;
export function suggestWeights(mustHaves: ReadonlyArray<{ dimension: DimensionId; weight: number }>,
  stats: ReadonlyArray<{ dimension: DimensionId; rho: number | null; n: number }>): Array<{ dimension: DimensionId; current: number; suggested: number }>;
// report.ts
export const CALIBRATE_CAVEATS: readonly string[];        // exact (Copy)
export interface CalReport { counts: { interviews: number; rubric: number; outcomes: number; skipped: number; decisions: Record<Decision | "unknown", number> };
  relationships: Array<{ dimension: DimensionId; rubric: Stat; outcome: Stat }>;
  roles: Array<{ id: string; title: string; versions: number; outcomes: number; suggestions: Array<{ dimension: DimensionId; current: number; suggested: number; stat: Stat }> | null;
    needs: { n: number; dimension: DimensionId } | null }>; caveats: readonly string[] }
export function calibrationReport(log: ReturnType<typeof readCalibration>, roles: ReadonlyMap<string, LoadedRole>, o: { role: string | null }): CalReport;
export function reportText(r: CalReport): string;
// cli/calibrate.ts
export async function runCalibrateAdd(o: { file: string; scores: Array<[number, number]>; decision: Decision | null; role: string | null; invite: string | null }, d: Deps): Promise<number>;
export async function runCalibrateOutcome(o: { dossierNo: string; decision: Decision | null; rating: number | null; months: number | null }, d: Deps): Promise<number>;
export async function runCalibrateReport(o: { role: string | null; json: boolean }, d: Deps): Promise<number>;
```

**Rules.**
- **`calibrate add FILE --score N=S[,N=S]… [--decision D] [--role ID] [--invite TOKEN]`:**
  - The report must exit 0, else exit 1: "only verified bundles can be logged (this one is <kind>)".
  - The role is `--role`, or the invite's role, and must be loaded, else exit 2.
  - The cards are those of `generateKit` with that role's fit, the same rule as the dossier. Each `N` is a card number, at most once, and each `S` is 1–4. Anything else → exit 2.
  - The line it appends copies `dims` from the verified payload.
  - Stdout: `Logged <k> probe scores for <dossierNo>.`
- **`calibrate outcome NO [--decision D] [--rating R --months M]`:** needs at least one of the two, else exit 2. A `NO` with no rubric line → exit 1: "no rubric entry for <NO>; log one with calibrate add first".
- **Pairs.**
  - **Rubric:** per dimension, (score, the mean score of the cards whose `dimension` is it), over records where the dimension is `scored`.
  - **Outcome:** per dimension, (score, rating).
  - **Role suggestions:** use only records with that `role` and a rating.
  - **With `--role`,** every pair set uses only that role's records.
- **`relation`:**
  - `n < MIN_STAT_N` → `too-few`;
  - `spearman` null → `constant`;
  - else `ok`, with `rho` and the bootstrap interval.
- **The bootstrap:**
  - `B` resamples of n indices, `floor(rand() · n)`, with `mulberry32(BOOT_SEED)`;
  - skip null replicates;
  - with m valid replicates, the interval is the sorted values at ranks `floor(0.025·(m−1))` and `ceil(0.975·(m−1))`;
  - null when `m < B/2`.
- **Suggestions:** builder's call 11. They appear only when every must-have has `n ≥ MIN_SUGGEST_N`. Otherwise `needs` names the fewest.
- **Text format** (exact, `rho` as a word, numbers to 2 decimals):
```
Calibration log: <n> interviews · <r> with rubric scores · <o> with a later outcome · <s> lines skipped
Decisions: <a> advanced · <b> not advanced · <w> withdrew · <u> not recorded (counts only; never related to scores)

Evidence and the interview rubric (Spearman, 95% interval, n):
  <Label>  rho <+0.41> [<0.12> to <0.63>]  n=<21>[  interval includes 0]   | n=<4>: too few to compute (needs 5) | not computable: every value is the same
Evidence and later outcomes (Spearman, 95% interval, n):
  …
Role <id> (<title>):
  weights need at least 20 outcomes for every must-have before any suggestion (fewest: <k>, <dimension>)
  | suggested weights from <n> outcomes; nothing is applied:
    <dimension>  <0.40> to <0.45>   rho <+0.31> [<0.04> to <0.55>]  n=<26>[  interval includes 0]
    To use them, edit the role file yourself (ai-profiler roles export <id>).
  [note: this role changed between entries (<v> versions); suggestions use the current profile]
Caveats:
  - <each of CALIBRATE_CAVEATS>
```
  - An empty log prints only "The calibration log is empty."
  - `--json` prints `JSON.stringify(CalReport)`.
- **Never:**
  - a `dossierNo`, name, label or invite id in either output;
  - "rank", "hire" or "recommend" outside `CALIBRATE_CAVEATS[3]`.

- [ ] **Step 1: Write the failing tests** (Review Focus 5).
  - **Stats:**
    - S1, S2, M1, and W1–W4 exactly;
    - ranks with ties average;
    - `relation` gives `too-few` at n 4, and `ok` at n 5 with an interval containing `rho`;
    - deterministic.
  - **Log:**
    - `add` writes exactly F16's keys at 0600;
    - `dims` equals the verified payload's;
    - the probes map to the kit's cards 1 and 2;
    - `--score 9=3`, `1=5` and a repeated card → exit 2;
    - a dev, self-reported or tampered bundle → exit 1.
  - **`outcome`:** an unknown NO → exit 1; no flags → exit 2.
  - **`readCalibration`:**
    - a garbage line and a truncated line → `skipped: 2`;
    - a second rubric for the same dossier wins;
    - the decision comes from the later outcome line;
    - two hashes of one role → `versions` 2, and the note.
  - **Report** on synthetic logs:
    - 19 outcome records → the "need at least 20" line;
    - 20 records built so that verification ranks with the rating and the others are flat → suggestions whose sum is 1.00, in steps of 0.05, with verification's share raised;
    - all ratings equal → `not computable`;
    - the empty log;
    - the exact header lines and caveats;
    - `--json` parses to `CalReport`;
    - neither output holds any `dossierNo` from the log;
    - the word lint passes;
    - no "NaN" anywhere.
  - **Explain and help:** `--explain` lists `calibration.jsonl`, and `--help` lists `calibrate`, `calibrate add` and `calibrate outcome` (pre-flight J4).
- [ ] **Step 2: Run** `bun test test/calibrate test/cli/calibrate.test.ts` → FAIL. **Step 3: Implement.**
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(calibrate): rubric and outcome log; Spearman with bootstrap intervals; role-weight suggestions only at n ≥ 20, never applied`.

---

### Task 16: Canaries, integration, smokes, visual QA, local P4 acceptance (A's half), PR

**Files:**
- Create:
  - `scripts/{pairing-smoke,brief-smoke}.ts`;
  - `test/scripts/{pairing-smoke,brief-smoke}.test.ts`;
  - `test/cli/available.test.ts`.
- Modify:
  - `test/canary.surfaces.test.ts`: rules R8–R12;
  - `test/integration.test.ts`;
  - `scripts/qa-dossiers.ts`: the kinds `timestamped`, `paired` and `briefed`, plus the pairing page;
  - `test/scripts/qa-dossiers.test.ts`.

**Interfaces:**
- **Consumes:** everything above, through `main`.
- **Produces:**
  - **`bun scripts/pairing-smoke.ts [--window FROM,TO]`:**
    1. Keys, invite and candidate run, all in a temporary `AIPROF_HOME` and output folder `$TMPDIR/ai-profiler-smoke-*`, removed in `finally`.
    2. `session start --bundle`.
    3. With a TTY, it waits: "Run a small agent task now, then press Enter." `--window` skips the wait and fixes the window, which is how the test runs it.
    4. `session end --yes`, then `verify --pairing`.

    It prints only `key=PASS|FAIL` lines, for the keys `exit`, `pairing-verifies`, `exhibit-p-has-activity`, `continuity-checked`, `no-raw-paths`, `dossier-audit`, `state-removed` and `temp-clean`. It exits 1 when any line is FAIL (pre-flight J13).
  - **`bun scripts/brief-smoke.ts [--cli claude|codex]`:** runs `verify <a persona bundle> --brief` with a scripted "y", in a temp `AIPROF_HOME`. The data is synthetic. It prints only `brief-sent`, `reply-parsed`, `section-rendered`, `audit` and `no-names-sent` as `key=PASS|FAIL`, and exits 1 when any is FAIL (pre-flight J13).

**The canary rules added** (Plan 4 Task 19's setup, plus a fake TSA, a fake CLI and a pairing over the canary home):

| # | Surface | Rule |
|---|---|---|
| R8 | every TSA request (body and headers) | `findCanaries` is `[]`; the body is exactly 77 bytes and parses to (payload hash, nonce, certReq) |
| R9 | the pairing state file, the pairing bundle, its opened plaintext, and the pairing page | `[]` |
| R10 | the brief's stdin and argv as the fake CLI recorded them | `[]`, and none of the names the invite log, subject and revealed projects carry |
| R11 | `calibration.jsonl`, and the report as text and JSON | `[]` |
| R12 | stdout and stderr of `session start`, `session end`, `verify --pairing`, `verify --brief` and `calibrate` | `[]`, and neither `h.root` nor the home path |

**Positive control:** the recruiter dossier of the same run holds the invite-log name, so R10 does not pass vacuously.

- [ ] **Step 1: Write the failing tests.**
  - **The canary rules** above.
  - **`available.test.ts`:** `parseArgs` never returns "not available in this version" for `--timestamp`, `session start`, `session end`, `--brief` or `calibrate`.
  - **`integration.test.ts`,** the §8.1 loop on a `fakeHome` with every builder:
    1. `keys init`, then a sealing invite;
    2. the run with `--yes --timestamp` against a fake TSA;
    3. `verify` → exit 0 with the TSA part of the banner;
    4. `session start --bundle --yes`, then `session end --yes` over a fixture window;
    5. `verify MAIN --pairing P` → exit 0, with `#ex-p` and a continuity line;
    6. `verify MAIN --brief claude`, with a fake CLI and "y" → `#s5-brief`;
    7. `calibrate add MAIN --score 1=3,2=4 --decision advanced`, then `calibrate outcome <NO> --rating 3 --months 6`, then `calibrate` → "too few".
  - **The smoke scripts' tests,** on a `fakeHome`, with `--window` and a fake CLI:
    - exit 0;
    - every line matches `/^[a-z0-9-]+=PASS$/` (pre-flight J13);
    - `expectNoCanaries(stdout + stderr)`.
  - **`qa-dossiers`:** every new file audits clean.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the scripts and the rules. **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Visual QA (controller gate).** Run Plan 4's `scripts/visual-qa.ts` on the new kinds: dark and light themes, 1440 and 390 px, and print. The controller opens every PNG and PDF.
  - **Ex.P:** it reads after the probe cards, its link lines and flag are unmistakable, and its swimlanes scroll inside their box at 390 px.
  - **The brief:** the AI-drafted label is the first thing in it, and it is visually distinct from the evidence.
  - **TSA lines** sit in the certificate's integrity area and in §6.
  - **Print:** no raw JSON, and a light theme.

  Issues go back to the owning task's files, and the QA runs again until the controller approves.
- [ ] **Step 6: Local P4 acceptance (A's half), by hand, with the sandbox off.** Keep only the pass/fail lines for the PR. No value, name or file from the owner's machine goes into the repo, the PR or a report.
  1. `bun scripts/tsa-roundtrip.ts` → `digicert=PASS`, `sectigo=PASS`, `sslcom=PASS`. This is the spec's manual, opt-in "TSA round-trip verified against a public TSA".
  2. `bun scripts/pairing-smoke.ts` on the real HOME. Run one small task with the local agent CLI while it waits. Expect every line `PASS`: "pairing recorder produces Exhibit P".
  3. `bun scripts/brief-smoke.ts --cli claude` with the local `claude` → every line `PASS`.
- [ ] **Step 7: Commit, push and open the PR.** Do not merge: the final whole-branch review comes first.
```bash
git add -A && git commit -m "feat: v2 advanced — pairing recorder, RFC 3161 timestamps, verify --brief, calibrate; canaries and integration

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
# EtherHiding config scan → nothing printed
git fetch origin && git merge-base --is-ancestor origin/main feat/v2-advanced   # sandbox off; exit 0, else BLOCKED (pre-flight J1)
git push
gh pr create --base main --title "AI Candidate Profiler v2: pairing recorder, RFC 3161 timestamps, verify --brief, calibrate" --body "<summary · the Step 6 pass/fail lines · visual QA approved by the controller · no figures from the owner's machine>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch   # green on ubuntu, macos and windows, plus the security guard
```
