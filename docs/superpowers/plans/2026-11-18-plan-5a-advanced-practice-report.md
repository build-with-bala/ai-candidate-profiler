# Plan 5a — Advanced features in B: P1 and P2 tools, WSL, coach, history — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Paths.** `<A>` and `<B>` stand for the roots of the local checkouts of A (`build-with-bala/ai-candidate-profiler`) and B (`build-with-bala/ai-practice-report`). `<research>` stands for the private research notes, which are in neither repo. `<scratch>` stands for the session scratchpad, a folder outside both repos. The controller gives the concrete paths at dispatch.

**Goal:** Extend B (`ai-practice-report`) with four things:
- readers for the P1 tools and the P2 beta tools;
- Windows + WSL homes;
- an opt-in coach that runs the person's own agent CLI on a digest that holds no text;
- an opt-in local history with month-over-month deltas.

**Architecture:**
- **Readers.** A shared reader kit holds the conventions every new reader needs. Every P1 and P2 reader is a plugin in `core/sources/<tool>/` that builds on the kit. P2 readers are batched by store shape, two or three to a task. The kit has five parts:
  - per-home directories, where WSL homes follow Linux conventions through UNC paths;
  - a conversation emitter, the only place where a chat-shaped reader turns in-memory records into events;
  - a streaming JSON-array reader;
  - probe modes for the new formats;
  - the placeholder table that `--explain` resolves.
- **Scan.** The orchestrator gains two additive changes:
  - a WSL session's cwd registers as its UNC path;
  - repo-scoped stores (Aider) are located after the other plugins, in the folders the sessions ran in.
- **App.**
  - `app/history/` keeps allowlisted per-run aggregates under `~/.ai-practice/` and compares runs made with the same options.
  - `app/coach/` builds a `coach/1` digest from the export payload and from enum-only episode skeletons (`core/exhibits/skeletons.ts`). It shows the exact bytes, runs the chosen CLI three times once the person confirms, and merges the answers by majority.
  - The report gains "This month vs last" in YOU and a "Coach notes" chapter. Nothing new is scored or exported.

**Tech Stack:**
- Bun 1.3.11. It provides the built-in `node:zlib` `zstdDecompressSync` with `maxOutputLength` (verified on 1.3.11), `Bun.which` and `Bun.spawn`.
- TypeScript 5 (`strict`), `bun:sqlite`, `node:crypto` and `bun test`.
- No runtime dependencies.

**Spec:** `<A>/docs/superpowers/specs/2026-11-17-ai-leverage-suite-v2-design.md`.
- This plan implements, for B:
  - §2 Goal 1, and the §6.1 per-tool table rows for the P1 tools, the P2 beta tools and Windows + WSL;
  - §6.2 and §6.7 for the new stores and the new surfaces;
  - from §7.1, the `--keep-history`, `--coach` and `--purge` flags;
  - from §7.2, "This month vs last" and the coach notes;
  - §7.3 and §7.4;
  - the matching §10 tests and B's part of the §11 P4 acceptance.
- §2, §3, §13, §14 and §16 bind every task.

**Builds on** Plans 1–3, as merged into `main`. Task 1 re-verifies every name this plan consumes on `main`, and stops if any differs.
- Plan 1: `<A>/docs/superpowers/plans/2026-11-17-plan-1-core-sources.md`, as executed in PR #1.
- Plan 2: `<A>/docs/superpowers/plans/2026-11-17-plan-2-core-analysis.md`.
- Plan 3: `<A>/docs/superpowers/plans/2026-11-18-plan-3-practice-report-app.md`.

**Research (private):** `<research>/01-trace-sources.md` (stores per tool). Never commit it, and never quote a value or a figure from it. The public URLs that each reader task lists are the sources its implementer re-checks before coding. Where a URL and the tool's current source disagree, the source wins, and FORMAT.md says so.

**Repo and branch:** B lives at `<B>`.
- The controller creates `feat/advanced-report` from `main` once Plan 3's PR is merged.
- Task 21 opens the PR into `main`. It is merged only after the final whole-branch review.

**Out of scope:**
- **Plan 5b:** A's P4 items, which are the pairing-session recorder, RFC 3161 timestamps, `verify --brief` and calibration.
- **Plan 6:** release workflows, the 5-target build, the polish of the README and the methodology docs, and publishing. Also A's pin bump to this plan's core (pre-flight H3).

## Global Constraints

Plans 1–3's Global Constraints carry over unchanged. They cover the platform, SQLite, free text, what is read, repository content, real data, reading and temp files, network and git, identity and logging, analysis, performance, signals, tests, commits and pushes, dependencies, core boundaries, reports, names, files written and visual QA. This plan adds the constraints marked ✚.

**✚ Readers.** Every new reader follows these rules:
- **SQLite** is read only through Plan 2's `readStore` and `Pass` (`core/sources/common/sqlite.ts`). Column lists are explicit and checked with `tableColumns`. Never `SELECT *`.
- **JSONL** is read only through `streamJsonlFile`, and prompt histories only through `PromptLog`.
- **JSON documents:**
  - a root array, or the array under one top-level key, is read through `readJsonItems` (Task 2);
  - any other whole document goes through `readJsonSmallResult` with a 64 MiB cap. A larger one gives `skipped["too-large"]` and coverage `note: "too-large"`.
- ✎ **Whole XML documents** may be read with `readTextSmall` up to 64 MiB, the cap of Plan 1's Ruling 3. This amends Plan 2's "`readTextSmall` (≤ 256 KiB, for repo files)" for P2 readers only. A larger document counts `skipped["too-large"]` (pre-flight H8).
- **Existence** is checked through `fileState`, `isDir` and `isFile`, and folders are listed through `listDir`.
- **Events from chat-shaped stores.** Sessions, prompts, tool calls, usage and turns are emitted only through `Convo` (Task 3).
- **Coverage.** One `CoverageEv` per (candidate, window), emitted last.
  - Every window that yields events declares its `primary` kinds.
  - Drift keys are enums: `typeKey`, `<field>:shape` and `table-unreadable:<table>`.
- **Fixed forms:**
  - session ids are `sid(tool, idPart(raw, <the reader's idShape>, ctx))`, with `UUID` unless the task names another shape. An `idShape` never admits a low-entropy id, such as Cline's millisecond task ids, which would leak start times through A's fingerprints (pre-flight H5);
  - models go through `safeModel`, versions through `VERSION`, and enums through `oneOf`;
  - log codes are `<prefix>.<code>`.
- **`ToolEv.name`** is one of three values:
  - the tool's built-in name, when the reader's `ToolTable` lists it;
  - `mcp`, for MCP calls;
  - `other`, for anything else.
- **No switch or PR markers.** No P1 or P2 reader emits `model-switch`, `effort-switch` or `pr-link` markers. This keeps Plan 2's `SWITCH_TOOLS` and `PR_LINK_TOOLS` true.
- **Semantics block.** A reader that emits `TurnEv`s, a `surface` or a `mode` adds one line for its tool to the matching paragraph of the semantics block in `core/model/events.ts`, as Plan 1's readers did.
- **Credential neighbours.** Each plugin's credential neighbours are named in its `describe.neverReads`. They are never listed, stat'ed or opened, and its fixture plants them.
- **Beta.** Every P2 plugin is `beta: true`. P1 plugins follow builder's call 1.

**✚ Real local stores**
- Presence is checked only with `test -e <path>`, on the exact paths the task names. Never use `find`, `ls -R`, globs over a home, or any other crawl.
- A present store is inspected only with `bun scripts/probe.ts`.
- In FORMAT.md, fields seen that way are marked `(probed)`. The others are marked `(docs)`.
- The counts-only smoke follows Plan 1's source-task notes. Only pass/fail lines and counts go into the task report, and none of them goes into the repo.

**✚ Docs.** Every new `FORMAT.md` holds:
- the record types, field names and value types;
- a `Sources` list with the public URLs that its task names.

It holds no values, no figures and no observations about any machine. Plan 2's `docs.test.ts` checks this.

**✚ Coach**
- **When it runs:** only with `--coach`, and only after the person confirms the exact bytes. Confirmation is either a TTY answer of `y` or `yes`, or `--coach-confirm` with the matching hash.
- **What the digest holds:** only numbers, booleans, enum tokens and ids that the digest itself defines.
  - It passes the `coach/1` schema through Plan 2's `sanitize`.
  - A structural test proves that it holds no other string.
- **How the CLI is called:**
  - argv is fixed per CLI and never holds digest data;
  - the digest goes on stdin;
  - the CLI's stderr is never printed or stored.
- **Where coach notes appear:** only in the private report. They never appear in `--json`, the `.aiprof`, the share card, history, logs or snapshots, and they never enter any score.

**✚ History**
- `~/.ai-practice/history.jsonl` holds only `aipr-history/1` records, deny by default.
- The folder is 0700 and the file 0600 on POSIX. Every write re-tightens both.
- Nothing under `~/.ai-practice/` is read or written through a symlink.
- `--purge` removes `~/.ai-practice/` and nothing else.

**✚ Processes.**
- In `app/**`, only `app/open.ts` and `app/coach/spawn.ts` spawn processes. Task 19 has the static test.
- Core's rule stays Plan 2's: only `core/git/run.ts` spawns.

**✚ Network.**
- Core and app make no network requests.
- With `--coach`, the person's own CLI makes network requests, by their choice. The privacy statement says so (Task 20).

## Spec values (verbatim — tasks cite these and never restate them differently)

**§2 Goal 1:** "**Correct measurement** on late-2026 formats for 20 tools (P0: Claude Code, Codex, Copilot, Cursor, Antigravity; P1: Gemini CLI, OpenCode, Cline/Roo/Kilo; P2 beta: Windsurf/Devin Desktop, Zed, Kiro, Warp, Amp, Goose, Factory Droid, Qwen Code, Crush, Aider, Continue, JetBrains AI/Junie)."

**§6.1 per-tool rows:**

| Tool | Must read | Key fixes vs v1 |
|---|---|---|
| **Gemini CLI** (P1) | `~/.gemini/tmp/<project>/chats/session-*.jsonl` (`{kind}` header + `$set` lines; `.json` ≤ v0.38), `logs.json`, `projects.json` | new |
| **OpenCode** (P1) | `~/.local/share/opencode/opencode.db` (older `storage/` JSON), `~/.local/state/opencode/prompt-history.jsonl` | new; sessions with `parent_id` → delegation |
| **Cline / Roo / Kilo** (P1, one parser) | VS Code `globalStorage/{saoudrizwan.claude-dev, rooveterinaryinc.roo-cline, kilocode.kilo-code}/tasks/<id>/{ui_messages, api_conversation_history, task_metadata}.json`, `~/.cline/data/tasks/` | new |
| **P2 beta** | Windsurf → Devin Desktop (`~/.codeium/windsurf/`, Devin CLI `sessions.db`), Zed `threads.db` (zstd JSON), Kiro, Warp `warp.sqlite`, Amp threads, Goose `sessions.db`, Factory Droid sessions, Qwen Code chats, Crush `crush.db`, Aider `.aider.chat.history.md`/`.aider.input.history`, Continue sessions, JetBrains AI/Junie XML | parsers from public docs + synthetic fixtures; coverage marks them `beta`; zstd/protobuf decoding only where a small pure-TS decoder exists, else report "present, not decodable" |
| **Windows + WSL** | `\\wsl.localhost\<distro>\home\*\{.claude,.codex,.gemini,…}` | new |

**§3:** "Environments verified without real data: Cursor, Windows, WSL, and all P2 tools — covered by synthetic fixtures built from public format docs, CI on all three OSes, and "beta" labelling until verified on real data."

**§7.1 flags:** "`--keep-history` opt-in: append this run's aggregates to ~/.ai-practice/history.jsonl"; "`--coach [claude|codex|gemini]` opt-in: own-agent coaching notes (§7.3)"; "`--purge` (delete history/cache)".

**§7.3 Coach (opt-in, own agent):**
1. "Detect installed CLIs (`claude`, `codex`, `gemini`); user picks one."
2. "Build a **structural digest**: dimension scores and components, ≤ 10 sampled episodes as tool-sequence/outcome/intent-label skeletons — **no prompt text, code, paths, or names**."
3. "Show the digest and require confirmation; it goes to the user's own provider."
4. "Call `claude -p --output-format json` / `codex exec --output-schema` / Gemini equivalent with a strict JSON schema `{observations[], upgrades[{title, evidenceRefs[], steps[]}], cautions[]}`; 3 runs, merge by majority; record model id + input hash."
5. "Render as clearly labelled "Coach notes"; never feeds scores; never included in employer exports."

**§7.4:** "Opt-in local store of per-run aggregates (no events, no text). The report shows deltas per dimension with interval overlap ("changed" only when intervals separate)."

**§7.2:** "This month vs last (if history)" in YOU, and "COACH NOTES (only with --coach, labelled with model id + input hash)" between EXHIBITS and DATA HEALTH.

**§11 P4 acceptance (B's part):** "each added tool passes fixtures and is labelled beta where unverified; … coach runs with the local `claude` CLI on a digest containing no text."

**§13:** 1. "Offline-only by default in both; … B's coach talks only through the user's own installed CLI." 8. "P2 tools ship as beta parsers built from public docs." 9. "… candidate-side coach only in B, never scored."

**§14:** "how P2 decoders are implemented (pure TS, no native deps)"; "internal caching strategy (in-memory per run; any disk cache must be opt-in and purgeable)".

## Builder's calls (binding here; spec §14 leaves them open)

1. **Beta for P1.**
   - A P1 plugin ships `beta: false` only when all three hold on the build machine:
     - its store is present;
     - the probe confirmed every field it maps;
     - the counts-only smoke read records > 0 with no unknown types.
   - Otherwise it ships `beta: true`. The task report states which, as pass/fail only.
   - P2 plugins stay `beta: true` in this plan.
2. **One emitter.** Every chat-shaped reader emits through `Convo` (Task 3), which holds every rule that keeps text out of events. Readers map their records into `Convo`'s inputs in memory, and never build session, prompt, tool, usage or turn events by hand.
3. **Origins.**
   - **human:** the person drove the session.
   - **subagent:** the store names a parent session or task. Subagent sessions emit no `PromptEv`, because their user turns are the parent agent's briefs.
   - **scripted:** only when the store itself marks a headless run.
   - **Internal side sessions** (title or summary generation) are not sessions. They count as `skipped["internal"]`.
4. **JSON documents.**
   - Root arrays and keyed arrays stream through `readJsonItems`, element by element, with Plan 1's 32 MiB element cap.
   - Other documents are parsed whole only up to 64 MiB, the cap of Plan 1's Ruling 3.
5. **zstd.** The spec's "small pure-TS decoder" condition is met by the runtime itself.
   - Zed's blobs decode with `node:zlib` `zstdDecompressSync(buf, { maxOutputLength: 64 MiB })`, which Bun 1.3.11 ships. That adds no dependency and no native addon.
   - Over the cap, `ERR_BUFFER_TOO_LARGE` → `skipped["too-large"]`.
   - A blob that is not zstd → drift `data:shape`.
   - Windsurf's `cascade/*.pb` files are encrypted by the app with a key held in its own binary, a third-party finding. They stay `present-undecodable`, because decrypting them would mean shipping the vendor's key in a public repository.
6. **Repo-scoped stores (Aider).** They are located in two places only, never by crawling:
   - the scanned homes;
   - the folders that sessions ran in: the registered cwds and their git roots, found after the other plugins have run.

   `repoSignals: false`, which is `--no-repo-signals`, skips the repo folders, so that privacy sentence 4 stays true. `ScanOptions.repoStores` sets this apart from git: it defaults to `repoSignals`, so A's `find` and `session end` can keep repo-scoped stores with git off (pre-flight H5).
7. **WSL.**
   - A WSL home follows Linux conventions, reached through its UNC path.
   - A WSL session's absolute POSIX cwd registers as `<distro root>` + that path, so Aider finds it, and repo signals try it, best effort (pre-flight H16).
   - On Windows, B scans WSL homes by default, and `--no-wsl` skips them.
   - Distro names and WSL user names are never printed: `--explain` shows counts only.
8. **Coach digest (`coach/1`).** The digest has two parts:
   - dimensions, components, signals, coverage, personas and stack, taken from `exportPayload(a).value`;
   - up to 10 episode skeletons of enum tokens, from core.

   Everything passes through a deny-by-default schema. The input hash is the SHA-256 of the exact stdin bytes.
9. **Coach runs.**
   - **Finding the CLI:** `Bun.which` finds `claude`, `codex` and `gemini`. `--coach` without a value picks the only CLI installed, and with two or more installed it asks the person to name one.
   - **Fixed call:** argv is fixed per CLI, and the prompt and digest go on stdin.
   - **Working folder:** cwd is `~/.ai-practice/coach/`, created 0700.
   - **Limits:** 180 s per run and 1 MiB of stdout.
   - **Runs and merge:** 3 runs, one after another. An item is kept when 2 or more valid runs share its (kind, anchor reference). Notes need 2 or more valid runs.
10. **Coach confirmation.**
    - **On a TTY:** the preview goes to stdout and the question to stderr, and only `y` or `yes` sends.
    - **Off a TTY:** the preview and its hash are printed, and nothing is sent unless `--coach-confirm <first 12 hex>` matches.
    - **Report:** a declined or unconfirmed coach still writes the report, whose coach chapter says why. The exit code is 0.
11. **The coach's own sessions.** Core's scan drops every session whose raw cwd lies inside `<home>/.ai-practice/`, with its events, and counts it in `skipped["own-coach"]`. Those are the coach's own runs, whatever the CLI keeps of them. Both apps inherit the drop, and it adds no exclusion count (pre-flight H13).
12. **History.**
    - **Records:** `aipr-history/1` records are built from the export payload, never from `raw`.
    - **What a comparison uses:** only records with an equal scope (`--tools`, `--since`, repo signals and WSL).
    - **"Last":** the latest record of an earlier calendar month, in the analysis time zone.
    - **Changed:** a dimension has changed only when its intervals separate.
    - **`--purge`:** runs on its own, removes `~/.ai-practice/` without following links, and never touches files written with `--out` elsewhere.
13. **New placeholders.** `--explain` and the Method section resolve each new reader's `<…>` roots through core's `SOURCE_ROOTS` (Task 2), which every reader task extends. Plan 3's explain test then covers them.
14. **Formats that moved after the spec was written.** These were checked against public sources on 2026-11-18:
    - **Cline:** 4.x's default bundle and its CLI 3.x write SDK session files under `~/.cline/data/sessions/`.
    - **Kilo Code:** 7.x is an OpenCode fork with its own `kilo.db`.
    - **OpenCode:** 2.x uses new tables.
    - **Roo Code:** archived on 2026-05-15, though its stores stay readable.

    The spec's one parser for Cline, Roo and Kilo covers their shared task folders. Cline's SDK sessions are a second Cline plugin (Task 6), and Kilo 7's database is read by OpenCode's reader (Task 5).

## Review Focus

1. **Old and new layouts side by side** (OpenCode `storage/` beside `opencode.db`, Gemini `.json` beside `.jsonl` chats, Goose JSONL beside `sessions.db`, Kilo 5.x tasks beside their migrated copies in `kilo.db`) → each session counted once, the newest layout wins, drift flagged, never a silent zero; pinned by Tasks 4, 5, 6 and 9 (pre-flight H10).
2. **A misbehaving coach CLI** (missing, logged out, hanging, non-JSON or 10 MB output, ids that are not in the digest) → a clean message, a kill at the timeout, no partial notes, the report still written, stderr never echoed; pinned by Tasks 19 and 20.
3. **History edge cases** (corrupt or newer-schema lines, another scope, two runs on one day, a symlinked or group-readable `~/.ai-practice`, `--purge` with reports kept elsewhere) → bad lines skipped and counted, like compared with like, links refused, modes re-tightened, only `~/.ai-practice/` removed; pinned by Tasks 16 and 17.
4. **WSL in the field** (`\\wsl.localhost` empty or unreachable, only `\\wsl$`, several users, Linux cwds in WSL stores) → at most 16 homes are listed, each is located per plugin, Aider and `gitRootOf` reach WSL repos through UNC paths while git's refusals there are counted, and no distro or user name is printed; pinned by Task 14 (pre-flight H16).
5. **Huge or hostile documents** (a 200 MB Cline `ui_messages.json` full of base64 images, a zstd blob that inflates past its cap, deeply nested XML, a 500 MB Aider history) → bounded memory, a counted skip with its reason, and the scan finishes; pinned by Tasks 2, 6, 10, 12 and 13.

## File map

```
core/sources/common/homes.ts · core/sources/placeholders.ts · core/io/{jsonitems,zstd}.ts · core/text/xml.ts
  · core/env/paths.ts (WSL paths) · scripts/probe.ts                                                              2
core/sources/common/convo.ts                                                                                      3
core/sources/gemini-cli/ · core/sources/opencode/ · core/sources/cline/ (cline, roo-code, kilo-code plugins)      4 5 6
core/sources/{qwen-code,droid}/ · {amp,continue}/ · {goose,crush}/ · {zed,warp}/ · kiro/ · {windsurf,jetbrains-ai}/   7–12
core/sources/aider/ · core/scan.ts (repo-scoped pass) · core/sources/types.ts (locateIn) · core/git/discover.ts    13
core/env/env.ts (\\wsl$) · core/scan.ts (WSL cwds) · app/args.ts (--no-wsl)                                     14
core/sources/registry.ts · scripts/smoke-local.ts · test/core/never-opened.test.ts                                 15
app/history/{schema,store}.ts                                                                                     16
app/history/compare.ts · app/report/sections/you.ts                                                               17
core/analysis/walk.ts (episodeSpans) · core/exhibits/skeletons.ts · app/coach/digest.ts                          18
app/coach/{agents,spawn,prompt,answer,merge,index}.ts · test/fixtures/fake-agent.ts · package.json (./agents)      19
app/report/sections/coach.ts · app/{args,run,cli,copy,explain}.ts                                                 20
test/app/canary.surfaces.test.ts · test/app/integration.test.ts · scripts/coach-smoke.ts                           21
```

## Interfaces for Plan 5b and Plan 6

- `registry` gains the P1 and P2 plugins, with their tiers, beta flags and `describe` texts. A's consent preview and `--explain` read them as they are.
- `SOURCE_ROOTS` and `PLACEHOLDER_WILDCARDS` (`core/sources/placeholders.ts`), exported from `ai-practice-report/core`, let A resolve describe placeholders without B's app.
- `scan({ wsl })` semantics (Task 14). A's candidate run passes `wsl: true` on Windows to match B.
- `ScanOptions.repoSignals: false` also skips repo-scoped stores (`SourcePlugin.locateIn`, Aider). A's consent "no repo signals" switch inherits this. `ScanOptions.repoStores` (default = `repoSignals`) sets repo-scoped stores apart from git, and core exports `stableSessionId(id)` for A's fingerprints, `find` and continuity (Tasks 3 and 13, pre-flight H5).
- `episodeSkeletons` (core) and `app/coach/{agents,spawn,answer,merge}.ts`. The runner is exported as `ai-practice-report/agents` (Task 19): schema-generic, with a one-run `runAgent` beside `runCoach`. A does not import it: Plan 6 Task 7 adds a contract test that A's claude and codex argv and env table equals `AGENTS` (pre-flight H4).
- `aiprof/2` is unchanged: P2 tools arrive in `coverage[]` with `beta: true`.
- For Plan 6: the README's privacy statement gains sentences 7 and 8 and the amended sentences 2 and 4 (Task 20), and A's sentence 4 gets the same Aider clause at the bump (pre-flight H12); `package.json` exports gain `./agents`, a change to spec §9's export list that the PR notes (pre-flight H4); the Windows CI job runs the WSL end-to-end test and the `.cmd` shim tests.

---
### Task 1: Pre-flight — pin the Plans 2 and 3 contract on `main`

**Files:**
- Create: `test/contract/plan3.test.ts`

**Interfaces:**
- Consumes the following names exactly as Plans 2 and 3 state them.
  - **Reader helpers:** `readStore`, `Pass`, `tableColumns`, `eachRow`, `q`, `PAGE` (`core/sources/common/sqlite.ts`); `streamJsonlFile`, `PromptLog`; `fileState`, `isDir`, `isFile`, `readTextLines`, `readTextSmall`, `readJsonSmallResult`; `noteOpen`, `__observeOpens`; `TASK_GAP_MS`; `INERT_SKIPS`, `Tally`, `typeKey`, `listDir`; `idPart`, `safeModel`, `oneOf`, `VERSION`, `UUID`, `extOfPath`; `classifyCommand` (with `toolchain`), `classifyIntent`, `promptFeatures`; `readSidecar`, `__observeQueries`, `uriToPath`, `joinFor`, `appSupport`, `vscodeUser`, `tildify`, `homesToScan`, `sid`, `MAX_LINE_BYTES`, `readJsonl`, `listWslHomes`, `Env.wslHomes`, `isSchemaToken`. `VERSION` here is the guards regex, pinned by its path `core/sources/common/guards.ts` (pre-flight H14).
  - **Scan:** `registry`, `SourcePlugin` (`windows`, `primary`), `windowsOf`, `PluginCoverage`, `scan`, `ScanOptions` (`wsl`, `repoSignals`, `handleSignals`), `ScanResult` (`repos`, `cwds`), `EventStore`, `REPO_SIGNALS_DESCRIBE` (pre-flight H14).
  - **Analysis:**
    - `analyze`, `Analysis`, `AnalyzeOptions.exclude`;
    - `exportPayload`, `ExportResult`, `sanitize`, `FieldSpec`, `canonicalJson`, `modelExportId`, `AIPROF2` (pre-flight H14);
    - `buildSessionTable`, `SessionTable` (`detailTop`, `isHuman`), `Exclusions`, `PR_LINK_TOOLS`, `SWITCH_TOOLS`, `isAction`, `childType`, `ChildType`, `dayKey` (pre-flight H14);
    - `computeExhibits`;
    - `DimensionId`, `DimensionResult`, `Confidence`.
  - **App:**
    - CLI: `parseArgs`, `CliOptions`, `Parsed`, `helpText`, `PRIVACY_STATEMENT`, `explain`, `placeholderRoots`, `PLACEHOLDER_WILDCARDS`;
    - output: `outputPaths`, `writePrivate`, `run`, `RunDeps`, `main`;
    - report: `buildReportModel`, `ReportInput`, `ReportModel`, `renderReport`, `TOOL_LABEL`, `fmt`, `esc`, `auditHtml`, `uncoveredChars` (pre-flight H14).
  - **Test kits:** `fakeHome`, `CANARY`, `findCanaries`, `expectNoCanaries`, `reportFixture`, `personaScan`, `scanResultOf`, `makeRepo`.
- Produces nothing new.

- [ ] **Step 1: Branch and read.**
  1. Confirm that `HEAD` is `feat/advanced-report`, that it equals `main`, and that `main` contains Plan 3's merge.
  2. On `main`, read:
     - `core/sources/{types,registry}.ts`, `core/sources/common/*.ts`, `core/scan.ts` and `core/env/*.ts`;
     - `core/analysis/walk.ts`, `core/exhibits/index.ts` and `core/privacy/{schema,export}.ts`;
     - `app/{args,run,explain,copy,paths}.ts`, `app/report/{model,render}.ts` and `app/report/sections/you.ts`;
     - `test/core/sources/drift.test.ts`, `test/core/never-opened.test.ts` and `test/app/canary.surfaces.test.ts`.
  3. Confirm that each consumed name exists with the type its Interfaces block states. If anything differs, stop and report BLOCKED with the difference.
  4. In the task report (never in the repo), record:
     - whether `core/git/discover.ts` exports its ancestor walk for `.git`, and under which name (Task 13 reuses it);
     - whether the walk's episode split in `core/analysis/walk.ts` is already a separate function (Task 18 exports it);
     - Plan 3's `placeholderRoots` keys (Task 2 moves them).
- [ ] **Step 2: Write the contract test.**
  - It pins the consumed names at compile time with typed assignments.
  - At run time, with `a = analyze(personaScan("intermediate"), { timeZone: "UTC" })`, it asserts:
    - `sanitize({ x: 1 }, { t: "object", fields: {} })` deep-equals `{}`;
    - `exportPayload(a, { schema: "aiprof/2" }).value` has `overall`, `dimensions` (7, each with `components`), `signals`, `coverage`, `personas`, `stack` and `exposure.rotation.ever`, which Tasks 16 and 18 read;
    - `Object.keys(placeholderRoots(h.env))` includes `<claude>` and `<codex>`.
- [ ] **Step 3: Run** `bun test test/contract && bunx tsc --noEmit` → PASS. The test pins existing code, so it passes at once; a failure means BLOCKED.
- [ ] **Step 4: Commit** `test(contract): pin the Plan 3 interfaces this plan consumes`.

---

### Task 2: Reader kit I — homes, placeholders, JSON items, zstd, probe modes

**Files:**
- Create: `core/sources/common/homes.ts`, `core/sources/placeholders.ts`, `core/io/jsonitems.ts`, `core/io/zstd.ts` and `core/text/xml.ts`
- Create tests: `test/core/sources/common.homes.test.ts`, `test/core/io/jsonitems.test.ts`, `test/core/io/zstd.test.ts` and `test/core/text/xml.test.ts`
- Modify:
  - `core/env/paths.ts` (`wslDistroRoot`, `wslPath`);
  - `scripts/probe.ts` and `test/kit/probe.test.ts`;
  - `app/explain.ts`, where `placeholderRoots` and `PLACEHOLDER_WILDCARDS` now come from core;
  - `core/index.ts`, which exports `SOURCE_ROOTS` and `PLACEHOLDER_WILDCARDS`;
  - `test/core/integration.test.ts`, Plan 1's registry pin: the first 18 entries must be Plan 1's P0 list, every later entry is P1 or P2 with its own `windows`, and the per-plugin coverage checks apply only to plugins whose builders that home runs (pre-flight H1);
  - `app/copy.ts`, where `helpText` wraps the tool-id list at 100 columns (pre-flight H1);
  - `core/io/observe.ts`, `core/io/fs.ts` (`walk`) and `core/sources/common/coverage.ts` (`listDir`): `OpenHow` gains `"list"`, which `listDir` and `walk` report for each folder they list, as a test-only observation (pre-flight H9).

**Interfaces:**
```ts
// core/sources/common/homes.ts
export interface HomeDirs { home: string; wsl: boolean; os: Platform;   // the conventions to follow: "linux" for a WSL home
  data: string; config: string; state: string;                       // XDG dirs: env's for the scanning user, <home>/.local/share, <home>/.config, <home>/.local/state otherwise
  join(...parts: string[]): string;                                  // joinFor(env, …)
  appSupport(app: string): string;                                   // darwin <home>/Library/Application Support/<app>; win32 (scanning user) appData\<app>; linux and WSL <config>/<app>
  localAppData?: string;                                             // win32 scanning user only
  toHost(p: string): string }                                        // a path a tool wrote in this home, as this process opens it: wslPath(root, p) for an absolute POSIX path in a WSL home, else p
export function homeDirs(env: Env, home: string): HomeDirs;
export function rootsIn(env: Env, homes: readonly string[], pick: (d: HomeDirs) => string | readonly string[] | undefined): Candidate[];
  // one Candidate per picked path that isDir accepts, each once; wsl = home !== env.home
export function vscodeUserDirs(env: Env, homes: readonly string[], app: string, serverDir: string): Candidate[];
  // vscodeUser(env, app) for the scanning user, plus <home>/<serverDir>/data/User for every home whose os is linux (VS Code Server, remote and WSL)
// core/env/paths.ts
export function wslDistroRoot(home: string): string | undefined;   // "\\wsl.localhost\Ubuntu\home\dev" → "\\wsl.localhost\Ubuntu"; "\\wsl$\Debian\home\x" → "\\wsl$\Debian"
export function wslPath(distroRoot: string, posix: string): string; // ("\\wsl.localhost\Ubuntu", "/home/dev/p q") → "\\wsl.localhost\Ubuntu\home\dev\p q"
// core/sources/placeholders.ts
export const SOURCE_ROOTS: Readonly<Record<string, (env: Env) => string>>;   // "<claude>", "<codex>", … — Plan 3's keys, then each reader task's own
export const PLACEHOLDER_WILDCARDS: readonly string[];                       // Plan 3's list, extended by reader tasks
// core/io/jsonitems.ts
export class JsonShapeError extends Error {}
export type JsonItem = { kind: "item"; n: number; value: unknown } | { kind: "skip"; n: number; reason: "oversize" | "parse" | "sniffed"; bytes: number }
  | { kind: "member"; key: string; value: unknown } | { kind: "member-skip"; key: string; reason: "oversize" | "parse" };
export function readJsonItems(path: string, o?: { arrayKey?: string; maxItemBytes?: number /* MAX_LINE_BYTES */; maxMemberBytes?: number /* 1 MiB */;
  sniffSkip?: (head: string) => boolean; headBytes?: number /* 512 */; signal?: AbortSignal }): AsyncGenerator<JsonItem>;
// core/io/zstd.ts
export type ZstdFail = "not-zstd" | "too-large" | "corrupt";
export function zstdBytes(b: Uint8Array, maxBytes: number): { ok: true; bytes: Uint8Array } | { ok: false; reason: ZstdFail };
// core/text/xml.ts — a tag scanner for in-memory text; no DTD, no entity expansion beyond the five predefined ones
export type XmlTok = { t: "open"; name: string; attrs: Readonly<Record<string, string>>; selfClosing: boolean } | { t: "close"; name: string } | { t: "text"; text: string };
export class XmlLimitError extends Error {}
export function xmlTokens(text: string, o?: { maxDepth?: number /* 64 */; maxAttrs?: number /* 64 */ }): Generator<XmlTok>;
// scripts/probe.ts (new exported functions; CLI flags --xml, --lines, --zstd-col <table>.<column>)
export function probeXml(path: string): string;
export function probeLines(path: string, maxLines?: number): Promise<string>;
export function probeZstdColumn(dbPath: string, table: string, column: string, maxRows?: number /* 20 */): string;
```

**Rules.**
- **`homeDirs`.**
  - For the scanning user's home, `os` is `env.platform` and the XDG dirs are `env.xdgData`, `env.xdgConfig` and `env.xdgState`.
  - For a WSL home, `os` is `"linux"`. Paths join with `joinFor` (win32 semantics) under the UNC home.
- **`readJsonItems`** iterates the file's bytes once.
  - It calls `noteOpen(path, "stream")` first.
  - It tracks string, escape and bracket-depth state.
  - **Target:** the root array, or, with `arrayKey`, the array under that key of the root object.
    - Every element of the target becomes one `item`. A failed parse gives `skip "parse"`, an element beyond `maxItemBytes` gives `skip "oversize"` (its bytes are discarded as they stream, never held), and an element whose head matches `sniffSkip` gives `skip "sniffed"`.
    - The other root members are yielded as `member` when they are at most `maxMemberBytes`, else as `member-skip`.
  - **A root of the wrong kind,** such as an object without `arrayKey`, throws `JsonShapeError` before any item. Readers count it as drift `<doc>:shape`.
  - **A truncated tail** gives one `skip "parse"`.
  - A missing file yields nothing, and the other I/O failures throw, as `readJsonl` does.
- **`zstdBytes`.**
  - The frame magic must be `28 B5 2F FD`, else the result is `not-zstd`.
  - It decodes with `zstdDecompressSync(b, { maxOutputLength: maxBytes })` from `node:zlib`. `ERR_BUFFER_TOO_LARGE` gives `too-large`, and any other throw gives `corrupt`.
- **`xmlTokens`.**
  - It skips comments, processing instructions, CDATA markers and `<!DOCTYPE …>`, and never resolves an entity other than `&lt; &gt; &amp; &quot; &apos;` and numeric references.
  - Depth beyond `maxDepth`, or attributes beyond `maxAttrs`, throws `XmlLimitError`.
  - A malformed tag ends the scan with `XmlLimitError` as well, so a reader counts it and moves on.
- **Placeholders.** `placeholderRoots(env)` maps `SOURCE_ROOTS` through `tildify`. Plan 3's keys and output stay byte-identical.
- **Probe modes.** Every mode prints shapes only, through the probe's existing `isSchemaToken` filter.
  - `--xml` prints an element-name histogram, the attribute names per element, and text and attribute values as length classes. It reads through `xmlTokens`.
  - `--lines` prints line classes by prefix: `#`, `##`, `###`, `####`, `>`, `+`, a fence, blank, and other. It prints counts only.
  - `--zstd-col` reads at most 20 non-null values of that column (with `--sqlite`), decodes each through `zstdBytes` capped at 16 MiB, and prints the merged JSON shape.

- [ ] **Step 1: Write the failing tests.**
  - `common.homes.test.ts`:
    - **darwin:** `homeDirs` gives the same `data` as `env.xdgData`, and `appSupport("Zed")` is `<home>/Library/Application Support/Zed`.
    - **WSL:** on a win32 env, a WSL home `\\wsl.localhost\Ubuntu\home\dev` gives `os: "linux"`, `data` = `\\wsl.localhost\Ubuntu\home\dev\.local\share` and `appSupport("x")` = `…\dev\.config\x`.
    - **Host paths:**
      - in that WSL home, `toHost("/home/dev/p q/ü")` = `\\wsl.localhost\Ubuntu\home\dev\p q\ü`, and `toHost("C:\\w")` is unchanged;
      - in the scanning user's home, `toHost` is the identity;
      - `wslDistroRoot` works for both prefixes, and gives `undefined` for `C:\Users\x`.
    - **`vscodeUserDirs`:**
      - on linux, with both `~/.config/Code/User` and `~/.vscode-server/data/User` present, it returns both;
      - on darwin, it returns only the app's User folder;
      - a missing dir is left out.
    - **`rootsIn`:** a path picked twice gives one candidate.
  - `jsonitems.test.ts`:
    - **Root array:** `[{"a":1}, {"a":"x],\"{"}]` gives two items, whose values have `a` equal to `1` and to `x],"{`.
    - **Keyed array:** `{"id":"s","messages":[{"r":1},{"r":2}],"v":3}` with `arrayKey: "messages"` gives `member id`, two items and `member v`, in file order.
    - **Oversize:** with `maxItemBytes: 1024`, a 4 KiB element between two small ones gives item, `skip oversize` (bytes ≥ 4096) and item.
    - **Sniffed:** `sniffSkip: (h) => h.includes('"images"')` turns that element into `skip sniffed`.
    - **Truncated:** `[{"a":1},{"a":` gives one item, then `skip parse`.
    - **Wrong root:** `{"a":1}` with no `arrayKey` throws `JsonShapeError`.
    - **Bounded memory:** a 64 MiB root array of 300-byte objects grows RSS by less than 128 MiB, sampled as in Plan 1's `jsonl` test, with `Bun.gc(true)` first.
  - `xml.test.ts`:
    - `<a x="1"><b>t &amp; u</b><c/></a>` gives open a (attrs x = 1), open b, text `t & u`, close b, open c (self-closing), close a;
    - a `<!DOCTYPE x [<!ENTITY e "boom">]>` with `&e;` in the text → the text keeps `&e;` verbatim;
    - 100 nested elements → `XmlLimitError`;
    - an unterminated `<a x="1` → `XmlLimitError`.
  - `zstd.test.ts`:
    - a `Bun.zstdCompressSync` round-trip of 7,000 bytes is equal;
    - `maxBytes: 100` → `too-large`;
    - plain JSON bytes → `not-zstd`;
    - a valid magic followed by garbage → `corrupt`.
  - `probe.test.ts`, extended:
    - an XML file with canaries in element text, attribute values and an attribute named `CANARY.slug`;
    - a markdown history with canary lines;
    - a SQLite column of zstd JSON holding canary values.

    For each, `expectNoCanaries(output)` passes, and the output holds the `####` line class count and the element histogram.
  - `explain.test.ts` (Plan 3) passes unchanged.
  - `integration.test.ts` (Plan 1): the rewritten registry test passes on today's registry and accepts appended P1 and P2 plugins (pre-flight H1).
  - `helpText` over all 22 tool ids: every line is at most 100 columns (pre-flight H1).
  - `listDir` and `walk` report `"list"` for each folder they list, and only those (pre-flight H9).
- [ ] **Step 2: Run** `bun test test/core/sources/common.homes.test.ts test/core/io test/core/text/xml.test.ts test/kit/probe.test.ts` → FAIL.
- [ ] **Step 3: Implement** the five modules, the WSL path helpers, the probe modes and the placeholder move.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS. Plan 2's static I/O test still passes: `readJsonItems` lives in `core/io/`.
- [ ] **Step 5: Commit** `feat(core): reader kit I — per-home dirs, placeholders, streamed JSON items, bounded zstd, probe modes`.

---

### Task 3: Reader kit II — the conversation emitter

**Files:**
- Create: `core/sources/common/convo.ts`, `test/core/sources/common.convo.test.ts`
- Modify: `core/index.ts`, which exports `stableSessionId` (pre-flight H5)

**Interfaces:**
```ts
export interface ToolSpec { category: ToolCategory; command?: readonly string[]; path?: readonly string[];   // input keys holding a shell command / a file path
  byArg?: { key: string; map: Readonly<Record<string, ToolCategory>> } }   // category chosen by an input value, e.g. a text editor's command (view → read, str_replace → edit)
export interface ToolTable { tools: Readonly<Record<string, ToolSpec>>; mcp?: (name: string) => string | undefined /* raw server name */ }
export interface SessionIn { raw: string; window: Window; origin?: Origin; parentRaw?: string; cwd?: string; start?: number; end?: number;
  model?: string; version?: string; surface?: string; agentType?: string; background?: boolean }
export interface ToolIn { ts: number; name: string; input?: unknown; callId?: string }
export interface ResultIn { callId: string; ok?: boolean; exit?: number; ms?: number; outcome?: "denied" | "cancelled" | "interrupted";
  linesAdded?: number; linesRemoved?: number }
export type ConvoMarker = Exclude<MarkerKind, "model-switch" | "effort-switch" | "pr-link">;
export class Convo {
  constructor(ctx: ScanCtx, tally: Tally, o: { tool: ToolId; source: string; table: ToolTable; idShape?: RegExp /* UUID */;
    surfaces?: ReadonlySet<string>; agents?: ReadonlySet<string>; injected?: (text: string) => boolean; maxPending?: number /* 10_000 */ });
  session(s: SessionIn): string;   // returns the session id; calling it again for the same raw id widens the span and adds models
  prompt(sessionId: string, p: { ts: number; text: string; hasPaste?: boolean }): void;
  tool(sessionId: string, t: ToolIn): void;
  result(sessionId: string, r: ResultIn): void;
  usage(sessionId: string, u: { ts: number; model?: string; inTok?: number; outTok?: number; cacheR?: number; cacheW?: number; usd?: number }): void;
  turn(sessionId: string, t: { ts: number; ms?: number; model?: string; status?: TurnEv["status"] }): void;
  marker(sessionId: string, m: { ts: number; kind: ConvoMarker; detail?: string; proxyTs?: true }): void;
  end(sessionId: string): void;    // emits the session's pending calls, then its SessionEv; forgets its state
  finish(): void;                  // end() for every open session
}
export function stableSessionId(id: string): boolean;   // the part after "<tool>:" is a store's high-entropy id: a UUID, `ses_…` (OpenCode, Kilo 7) or `T-<uuid>` (Amp); never a keyed hash (pre-flight H5)
```

**Rules** (the algorithm; the signatures do not determine it):
- **Sessions.**
  - The id is `sid(tool, idPart(raw, idShape, ctx))`, and `parentId` is built the same way from `parentRaw`.
  - `origin` is the given one, else `subagent` when `parentRaw` is set, else `human`.
  - `projectKey` is `ctx.registerCwd(cwd)`.
  - `models` is the sorted union of `safeModel` over the session's `model` and its usage and turn models.
  - `version` is set only when it matches `VERSION`. `surface` goes through `oneOf(surfaces)`.
  - `agentType` is kept when it is in `agents`, else it becomes its keyed hash.
  - `start` and `end` are the minimum and maximum of the given times and of every emitted `ts`. A session with no time at all is skipped `no-ts`.
- **Prompts.**
  - Blank text is skipped `empty`. Text for which `injected` holds is skipped `injected`. In a `subagent` session, a prompt is skipped `brief`.
  - Otherwise a `PromptEv` is emitted in the session's window and with its origin. It carries:
    - `intent: classifyIntent(text)`;
    - `features: promptFeatures(text, { hasPaste, isTaskStart, prevText })`;
    - `textHash: ctx.hash(text.trim())`.
  - `isTaskStart` holds for the session's first prompt, or when the prompt comes `TASK_GAP_MS` or more after the session's previous event.
  - The text lives only as the session's `prevText` until `end()`.
- **Tools.**
  - **Name and category:**
    - when `table.tools[name]` exists, `name` stays and the category is the spec's — or, with `byArg`, the mapped category of that input value, falling back to the spec's;
    - else, when `table.mcp(name)` gives a server, the event is `name: "mcp"`, `category: "mcp"`, `mcpServer` = that server;
    - else `name: "other"`, `category: "other"`.
  - **`command` keys:** the first string at those input keys, or a string array joined by spaces, goes through `classifyCommand`. It gives `checks` and `toolchain`, and also `category` when the spec's category is `shell`.
  - **`path` keys:** for edit and write categories, `editExt` is `extOfPath` of the first string at those keys.
  - `callId` is `ctx.hash(callId)`.
  - A call waits for its result until `end()`. Beyond `maxPending` open calls in a session, the oldest is emitted without a result.
- **Results.**
  - A result is matched by `callId` within its session. An unmatched one is skipped `orphan-result`.
  - With an `outcome`, `ok` and `exit` are left out, per the `ToolEv` contract.
- **Usage.**
  - The model is `safeModel(model ?? the session's last model)`. With no model at all, the usage is skipped `no-model`.
  - Absent token fields are 0. A usage with no token field at all is skipped `no-usage`.
- **Turns and markers** are emitted as given, in the session's window. `ConvoMarker` excludes the switch and PR kinds (Global Constraints).
- **`tally.span(ts)`** is called for every emitted time.

- [ ] **Step 1: Write the failing tests** in `common.convo.test.ts`.
  - **Setup:** a toy table `{ Bash: { category: "shell", command: ["command"] }, Edit: { category: "edit", path: ["file_path"] }, Read: { category: "read", path: ["file_path"] }, Ed: { category: "edit", path: ["path"], byArg: { key: "command", map: { view: "read", create: "write" } } } }`, with `mcp: (n) => /^mcp__(.+?)__/.exec(n)?.[1]`.
  - **Tools:**
    - `Bash {command: "cd w && pnpm vitest run"}` → `{ name: "Bash", category: "test", checks: ["test"], toolchain: "js" }`;
    - `Edit {file_path: CANARY.path + "/a.tsx"}` → `editExt: "tsx"`;
    - `Ed {command: "view", path: "a.go"}` → `category: "read"`, and `Ed {command: "undo"}` → `category: "edit"`;
    - a tool named `CANARY.project` → `name: "other"`;
    - `mcp__acme-internal-mcp__q` → `{ name: "mcp", category: "mcp", mcpServer: CANARY.mcp }`.
  - **Results:**
    - a result with a matching `callId` sets `ok: false, exit: 1`;
    - `outcome: "denied"` leaves out `ok` and `exit`;
    - an orphan result is counted;
    - a call with no result is emitted at `end()` without `ok`;
    - with `maxPending: 2`, three open calls emit the first early.
  - **Prompts:**
    - injected and blank texts are counted apart;
    - prompts 31 min apart → the second is a task start; 29 min apart → it is not;
    - a session with `parentRaw` emits no prompt, and its `origin` is `subagent` with `parentId` set.
  - **Sessions:**
    - a raw id `"my session/1"` → a 16-hex id part, while a UUID stays verbatim;
    - `cwd: CANARY.path` → `projectKey` set, and the raw path only in `r.cwds`;
    - model `"<script>"` → `"other"`;
    - version `"x"` is dropped;
    - the span covers every event;
    - an agent type outside `agents` is a keyed hash;
    - `stableSessionId`: a UUID, `ses_…` or `T-<uuid>` id → true; a keyed-hash id part → false (pre-flight H5).
  - **Usage:** without any model → skipped `no-model`.
  - **Canaries:** `expectNoCanaries(all events, { allow: ["mcp"] })`.
- [ ] **Step 2: Run** `bun test test/core/sources/common.convo.test.ts` → FAIL.
- [ ] **Step 3: Implement** `convo.ts`.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(core): reader kit II — one conversation emitter that keeps text out of events`.

---
## Shared steps for reader tasks (Tasks 4–13)

The controller hands this section to the implementer of every reader task, together with the task. A reader task states only its own specifics: files, plugin ids, locations, mapping, never-opened files, sources, fixture and tests. The steps below hold for all of them.

**Files** (always):
- Create: `core/sources/<tool>/index.ts`, its store modules, `core/sources/<tool>/FORMAT.md`, `test/fixtures/<tool>.ts` and `test/core/sources/<tool>.test.ts`.
- Modify:
  - `core/sources/registry.ts`, appending the plugins;
  - `core/sources/placeholders.ts`, adding the task's roots to `SOURCE_ROOTS` and every other `<…>` token its `describe` texts use (`<sid>`, `<extId>`, …) to `PLACEHOLDER_WILDCARDS`;
  - `test/core/sources/drift.test.ts`, adding one case per plugin id the task registers; a presence-only plugin joins `PRESENCE_ONLY` instead (pre-flight H1);
  - `core/env/env.ts`, adding the tool's override variables to `VAR_NAMES` when it has any. They apply to the scanning user's home only, as `CODEX_HOME` does.

**Step 0: Before coding.**
1. Re-read the task's sources.
2. Run `test -e` on each path the task names, for the local home only.
3. For each present store, run `bun scripts/probe.ts` with the mode it needs: `--sqlite`, `--xml`, `--lines` or `--zstd-col`.
4. Write `FORMAT.md`: record types, fields and types, each marked `(probed)` or `(docs)`, plus the `Sources` list.

**Step 1: Fixture builder** (`test/fixtures/<tool>.ts`).
- There is one builder per format version the reader supports.
- It plants:
  - `CANARY.prompt` and `CANARY.code` in prompt and reply text;
  - `CANARY.path` in cwds and file arguments;
  - `CANARY.project` in titles and summaries;
  - `CANARY.mcp` as an MCP server name;
  - each credential neighbour the task names, holding `CANARY.secret` or `CANARY.token`.

**Step 2: Failing tests.** These are the task's own tests, and always these as well:
- the coverage's window, status and `beta`;
- `expectNoCanaries(all events and coverage, { allow: ["mcp"] })`;
- `__observeOpens` records no credential neighbour, and only paths inside `h.root`;
- for SQLite readers, `__observeQueries` shows no `SELECT *` and no never-selected column;
- one field-renamed drift case in `drift.test.ts` per plugin id: drift, and no silent zero (pre-flight H1).

**Step 3: Run** `bun test test/core/sources/<tool>.test.ts test/core/sources/drift.test.ts` → FAIL.

**Step 4: Implement** the reader on the kit (Tasks 2 and 3), register its plugins and add its placeholders.

**Step 5: Run** `bun test && bunx tsc --noEmit` → PASS. Plan 3's model and render snapshots list every registry plugin in Method's `sources`: regenerate them with `bun test -u test/app/model.test.ts test/app/render.test.ts`, and check that the diff touches only `method.sources` (pre-flight H1). Where the store is present locally, also run the counts-only smoke of Plan 1's source-task notes, and apply builder's call 1.

**Step 6: Commit** `feat(sources): <tool> — <stores> (beta)`, leaving out "(beta)" for a P1 reader that builder's call 1 verified.

---
### Task 4: Gemini CLI (P1) — chats and the prompt log

**Files:** per the shared steps, for `core/sources/gemini-cli/` (`index.ts`, `chats.ts`, `logs.ts`, `map.ts`).

**Interfaces:**
- Produces:
  - `gmChats` (`gemini-cli.chats`, P1, beta per builder's call 1, windows `["detail"]`, primary `{ detail: ["session", "prompt"] }`);
  - `gmLogs` (`gemini-cli.logs`, P1, windows `["lifetime"]`, primary `{ lifetime: ["prompt"] }`);
  - `export class GeminiChat { constructor(convo: Convo, o: { window: Window; parentRaw?: string; cwd?: string }); line(v: unknown): void; end(): void }` (`map.ts`). Task 7 reuses it for Qwen Code's older chats.
- Placeholder: `<gemini>`. Variable: `GEMINI_CLI_HOME`.

**Locate:**
- **Roots:** `$GEMINI_CLI_HOME/.gemini` for the scanning user, else `<home>/.gemini`. On darwin, also `<home>/.cache/.gemini`, where a sandboxed CLI keeps its runtime state.
- **Chat files:**
  - `tmp/*/chats/session-*.jsonl`, from v0.39 on;
  - `tmp/*/chats/session-*.json`, up to v0.38;
  - `tmp/*/chats/<parentSessionId>/*.jsonl`, the subagents. The folder name is the parent's session id.
- **Never read:** files ending `.unreadable-<n>` or `.tmp-<n>`.
- **Index files:** `tmp/*/logs.json`, `tmp/*/.project_root` and `projects.json`.

**Chats.**
- **JSONL lines.** The reader folds a file into one ordered map of messages by id, then emits at the end of the file. The line kinds are:
  - **header:** the line with string `sessionId` and `projectHash`. It carries `startTime`, `lastUpdated` and `kind` (`main` or `subagent`);
  - **`$set`:** merges `lastUpdated` and `kind`, and ignores `summary`, `memoryScratchpad` and `directories`. The deprecated `$set.messages` replaces the whole list;
  - **`$patch`:** applies `content`, `toolCalls` and `updates` to the message with its `id`, and `removeIds` and `orderIds` to the list;
  - **`$rewindTo`:** drops that message and every later one;
  - **any other line with a string `id`:** a message. A later copy replaces an earlier one and keeps the first one's position.
- **The `.json` layout** is `{ sessionId, projectHash, startTime, lastUpdated, kind?, messages[] }`, read through `readJsonItems(arrayKey: "messages")`.
- **One session in both layouts:** resuming an old session rewrites it as `.jsonl`. The `.jsonl` wins and the `.json` is skipped `copied`. The reader reads each folder's JSONL headers first.
- **Messages:**
  - **`user`:** a typed prompt only when its content has text and no `functionResponse` part. The CLI also writes tool results and repair turns as `user`, and those are skipped `injected`.
  - **`gemini`:**
    - calls come from `toolCalls[]{ id, name, args, status }`;
    - `success` → ok, `error` → not ok, `cancelled` → outcome `cancelled`;
    - the other statuses leave the call without a result;
    - usage comes from `tokens{ input, output, cached, thoughts }` with `model`, where `input` includes `cached`: `inTok = input − cached` and `outTok = output + thoughts`.
  - **`info`, `error` and `warning`** give no event.
- **Sessions:**
  - start is `startTime` and end is the last `lastUpdated`;
  - a subagent file's parent is its folder name;
  - the files hold no version or cwd.
- **cwd,** in this order:
  1. the path in the chat folder's `tmp/<id>/.project_root`, a small text file read in memory;
  2. else the path that `projects.json` (`{ projects: { <path>: <id> } }`) maps to `<id>`;
  3. else the listed path whose SHA-256 hex equals `<id>`, for older hash-named folders.
- **Tool table** (`tools/definitions/base-declarations.ts`):
  - `run_shell_command` → shell (`command`);
  - `replace` → edit and `write_file` → write (`file_path`);
  - `read_file`, `read_many_files`, `list_directory` → read;
  - `glob`, `grep_search` → search;
  - `web_fetch`, `google_web_search` → web;
  - `write_todos` → todo;
  - `invoke_agent` → delegate;
  - MCP tools, in the naming FORMAT.md records → `mcp`.

**Prompt log.** `logs.json` is a root array of `{ sessionId, messageId, timestamp, type, message }`, read through `readJsonItems`. The CLI rewrites it whole. Entries of `type: "user"` go to `PromptLog.add` with their `sessionId`. Slash commands are among them, and `classifyIntent` makes them `command`.

**Never opened:**
- `~/.gemini/{oauth_creds.json, google_accounts.json, mcp-oauth-tokens.json, mcp-oauth-tokens-v2.json, a2a-oauth-tokens.json, installation_id, settings.json, .env}`;
- `tmp/*/shell_history` and `tmp/*/checkpoint-*.json`;
- everything under `~/.gemini/antigravity*`, which is Antigravity's (Plan 1 Task 15).

**Sources** (prefix `https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/`):
- `utils/paths.ts`, `config/storage.ts`, `config/projectRegistry.ts`;
- `services/chatRecordingService.ts`, `services/chatRecordingTypes.ts`;
- `core/logger.ts`, `core/geminiChat.ts`;
- `scheduler/types.ts`, `tools/definitions/base-declarations.ts`;
- https://geminicli.com/docs/cli/session-management;
- https://github.com/google-gemini/gemini-cli/pull/23749 (the JSONL switch);
- https://github.com/getagentseal/codeburn/blob/main/docs/providers/gemini.md.

- [ ] **Steps 0–6:** per the shared steps. Before coding, `test -e ~/.gemini/tmp` and `test -e ~/.gemini/projects.json`. Specifics:
  - **Fixture** (both layouts):
    - a JSONL chat with a header and 3 typed prompts, in this order: one holding `CANARY.prompt`, `/stats`, and a question that a later `$rewindTo` drops;
    - a synthetic `user` record holding a `functionResponse`;
    - a `gemini` record re-appended with `success` → `error`;
    - a `run_shell_command` `npm test` and a `replace` on `CANARY.path + "/a.py"`;
    - `tokens`, an `info` record, a `$set`, and a `$patch` that adds a tool call;
    - the same session as a `.json`, plus a session in the `.json` layout only;
    - a subagent file under `chats/<parent id>/`;
    - `.project_root` and `projects.json`, a `.tmp-123` file, `logs.json` with 4 entries;
    - `oauth_creds.json` holding `CANARY.token`, and `google_accounts.json` holding `CANARY.email`.
  - **Tests:**
    - the shared session is counted once, from the JSONL; the copy is skipped `copied`;
    - the re-appended record maps once, with its final status;
    - the `$patch` call is present, and the rewound prompt is gone, so there are 2 typed prompts, one of them a `command`;
    - the synthetic record is skipped `injected`;
    - `npm test` → `{ checks: ["test"], toolchain: "js" }`, and `editExt: "py"`;
    - `inTok = input − cached`;
    - the subagent session has its parent and no prompts;
    - the cwd comes from `.project_root`;
    - the `.tmp-123` file is never opened;
    - 4 lifetime prompts and their `DailyEv`s.
  - **Drift cases:** the JSONL `type` renamed → `(none)` keys and `zero-yield`; `logs.json` `message` renamed → `message:missing` and `zero-yield`.

---

### Task 5: OpenCode and Kilo Code 7 (P1) — three database generations, one reader

**Files:** per the shared steps, for `core/sources/opencode/` (`index.ts`, `v2.ts`, `v1.ts`, `storage.ts`, `map.ts`).

**Interfaces:**
- Produces:
  - `ocSessions` (`opencode.sessions`, P1, beta per builder's call 1, windows `["detail"]`, primary `{ detail: ["session", "prompt", "tool"] }`);
  - `kiloDb` (tool `kilo-code`, `kilo-code.db`, P1, beta). It is the same reader on Kilo 7's database, because Kilo 7 is an OpenCode fork.
  - `export async function readOpencodeStore(dataDir: string, dbFiles: readonly string[], ctx: ScanCtx, tally: Tally, convo: Convo): Promise<void>`.
- Placeholders: `<opencode data>`, `<kilo data>`. Variable: `OPENCODE_DB`.

**Locate:**
- **OpenCode's data folder** uses XDG paths on every OS: `<data>/opencode`, which is `<home>\.local\share\opencode` on win32. On win32, `<appData>\opencode` is checked as well, because the sources conflict there.
- **Databases** in it: `opencode*.db`, a pattern that covers the release-channel names. `$OPENCODE_DB` replaces them; a relative value resolves under the data folder.
- **Kilo 7's folder:** `<data>/kilo`, with `kilo.db*`, and `<appData>\kilo` on win32.

**Generations.** A session read from a newer one is skipped `copied` in the older ones.

| Generation | Store | What it holds |
|---|---|---|
| C (2.x) | tables `session_v2`, `session_message`, `session_part` | sessions, messages by type, and their content parts |
| B (1.2–1.19) | tables `session`, `message`, `part` | sessions, plus `data` JSON per message and per part |
| A (up to 1.1) | `storage/session/*/<id>.json`, `storage/message/<sessionID>/*.json`, `storage/part/<messageID>/*.json` | the same fields as B, file by file, through `readSidecar` |

- A 2.x first run copies the v1 rows and leaves the v1 tables in place, so the reader reads C before B before A.
- **SQL.** Explicit columns, and `json_extract` on exactly these JSON paths:
  - **sessions:** `id, parent_id, directory, version, agent, time_created, time_updated, summary_additions, summary_deletions`;
  - **B's `message.data`:** `$.role`, `$.modelID`, `$.mode`, `$.time.created`, `$.time.completed`, `$.tokens.input`, `$.tokens.output`, `$.tokens.reasoning`, `$.tokens.cache.read`, `$.tokens.cache.write`, `$.cost`;
  - **B's `part.data`:** `$.type`, `$.synthetic`, `$.tool`, `$.callID`, `$.state.status`, `$.state.time.start`, `$.state.time.end`, `$.state.metadata.exit`, the command and file-path inputs FORMAT.md names, and `$.text` for the text parts of user messages only;
  - **C's tables:** the same fields at the paths FORMAT.md records for `session_message.data` and `session_part.data`.

  It never selects:
  - `title`, `slug`, `share_url`, `metadata`, `permission` or `revert`;
  - any other JSON path;
  - anything from `credential`, `session_share`, `todo`, `blob*` or `instruction*`.
- **Mapping:**
  - **Sessions:**
    - raw id idShape `/^ses_[0-9A-Za-z]{8,40}$/`;
    - `parent_id` → subagent, and `directory` → cwd;
    - `version` and `agent` (kept when it is in `build`, `plan` or `general`, else hashed);
    - the summary columns → `TotalsEv.linesAdded` and `linesRemoved`.
  - **Prompts:** user text parts, or in C `user` messages' `text`. `synthetic: true` parts, and C's `synthetic`, `system` and `skill` messages, are skipped `injected`. C's `shell` messages are the person's own commands, so they are not tool events.
  - **Calls:** tool parts, or in C the tool blocks of `assistant` content or `session_part` rows.
    - `completed` → ok, `error` → not ok;
    - `exit` comes from `state.metadata.exit`, and `ms` from the state's times.
  - **Assistant messages:** each gives one `TurnEv` (`completed`, with `ms` and model) and one usage, from the message's tokens and cost. `step-finish` parts are not counted again. Compaction → `compact-auto`.
- **Tool table:**
  - `bash` and C's renamed `shell` → shell (`command`);
  - `edit`, `multiedit`, `patch` → edit; `write` → write; `read` → read (`filePath`);
  - `glob`, `grep` → search; `list` → read;
  - `todowrite`, `todoread` → todo;
  - `task` → delegate;
  - `webfetch`, `websearch` → web;
  - `<server>_<tool>` names for configured MCP servers → `mcp`. FORMAT.md records how to tell them from built-ins.
- **Not read:** `<state>/opencode/prompt-history.jsonl`, which records no times. `describe.neverReads` says so. This deviates from spec §6.1's must-read list, because a log without times cannot be placed in a window or a day; FORMAT.md and the PR's deviations record it (pre-flight H11).

**Never opened:**
- `<opencode data>/{auth.json, mcp-auth.json}`, and the same names under `<kilo data>`;
- `log/`, `snapshot/` (git snapshots of your projects), `storage/session_diff/` and `storage/session_share/`;
- `~/.config/opencode/{opencode.json, opencode.jsonc, service.json}`.

**Sources** (prefix `https://github.com/anomalyco/opencode/blob/`; sst/opencode redirects there):
- `v2.3.2/packages/core/src/session/sql.ts`, `v2.3.2/packages/schema/src/session-message.ts`, `v2.3.2/packages/schema/src/v1/session.ts`, `v2.3.2/packages/core/src/session/projector.ts`;
- `v1.19.6/packages/core/src/session/sql.ts`;
- `v1.2.0/packages/opencode/src/storage/json-migration.ts`;
- `v1.0.0/packages/opencode/src/session/message-v2.ts`, `v1.0.0/packages/opencode/src/tool/bash.ts`, `dev/packages/core/src/database/v1-migration.bun.ts`;
- https://opencode.ai/docs/troubleshooting/ and https://opencode.ai/docs/cli/;
- https://github.com/getagentseal/codeburn/blob/main/docs/providers/opencode.md;
- Kilo 7: https://blog.kilo.ai/p/new-kilo-for-vs-code-is-live and https://github.com/Kilo-Org/kilocode/blob/main/packages/core/src/global.ts.

- [ ] **Steps 0–6:** per the shared steps. Before coding, `test -e` on `~/.local/share/opencode/opencode.db`, `~/.local/share/opencode/storage` and `~/.local/share/kilo/kilo.db`. Specifics:
  - **Fixture** (three generations):
    - **C:** an `opencode.db` with `session_v2` rows: a session and a child; user and `synthetic` messages; an `assistant` with a `shell` tool block `pytest -q` (`error`, exit 1); a `credential` row holding `CANARY.secret`;
    - **B:** the same session in the v1 tables, and one v1-only session;
    - **A:** a `storage/` tree with a copy of the v1-only session and one storage-only session;
    - **Kilo:** a `kilo.db` in generation B;
    - `auth.json` holding `CANARY.token`.
  - **Tests:**
    - each session is counted once, from its newest generation, and the copies are skipped `copied`;
    - the child is a `subagent` with no prompts;
    - synthetic text is skipped `injected`;
    - `{ category: "test", ok: false, exit: 1, toolchain: "py" }`;
    - turns and usage once per assistant message;
    - `TotalsEv` lines;
    - the Kilo database's events carry tool `kilo-code`;
    - `__observeQueries` never names `credential`, `title` or a whole `data` column.
  - **Drift cases:** v1 `part.data` `$.type` moved → drift; a `storage/` message with `role` renamed → `role:shape`; and for `kilo-code.db`, the same `$.type` move in `kilo.db` (pre-flight H1).

---

### Task 6: Cline, Roo Code and Kilo Code (P1) — the shared task parser, and Cline's SDK sessions

**Files:** per the shared steps, for `core/sources/cline/` (`index.ts`, `tasks.ts`, `variants.ts`, `sdk.ts`). One fixture builder, `test/fixtures/cline.ts`, writes every variant.

**Interfaces:**
- Produces, all P1, beta per builder's call 1, windows `["detail"]`, primary `{ detail: ["session", "prompt"] }`:
  - `clTasks` (tool `cline`, `cline.tasks`);
  - `clSessions` (tool `cline`, `cline.sessions`);
  - `rooTasks` (tool `roo-code`, `roo-code.tasks`);
  - `kiloTasks` (tool `kilo-code`, `kilo-code.tasks`). Kilo 7's database is Task 5's `kiloDb`.
- `export interface ClineVariant { tool: ToolId; source: string; extId: string; firstPrompt: "task" | "text"; tools: ToolTable; modes?: ReadonlySet<string> }` (`variants.ts`).
- Placeholders: `<VS Code-family user>`, `<cline>`. Variables: `CLINE_DIR`, `CLINE_DATA_DIR`, `CLINE_SESSION_DATA_DIR`.

**Task folders** (Cline up to 3.x and its "Legacy" bundle, Roo Code, Kilo up to 5.x).
- **Locate:**
  - `vscodeUserDirs` for `Code`, `Code - Insiders`, `VSCodium`, `Cursor` and `Windsurf`, with the server folders `.vscode-server`, `.vscode-server-insiders`, `.cursor-server` and `.windsurf-server`, then `globalStorage/<extId>/tasks/*/`;
  - for cline only, also `$CLINE_DATA_DIR`, else `$CLINE_DIR/data`, else `<home>/.cline/data`, then `tasks/*/`.
- **Variants:**

  | Variant | `extId` | First prompt | Index (cwd, mode, parent) |
  |---|---|---|---|
  | cline | `saoudrizwan.claude-dev` | `say: "task"` | `globalStorage/<extId>/state/taskHistory.json`: `{ id, ts, cwdOnTaskInitialization, modelId }` per task; `task` (its text) is parsed and dropped |
  | roo-code | `rooveterinaryinc.roo-cline` | the first `say: "text"` row | `tasks/<id>/history_item.json` (v3.49+): `workspace`, `mode`, `parentTaskId`, `rootTaskId` |
  | kilo-code | `kilocode.kilo-code` | as Roo | as Roo |

- **Migrated Kilo tasks.** Kilo 7 migrates 5.x tasks into `kilo.db` (`migrate.ts` in Sources). A Kilo task whose migrated copy `kilo.db` holds, by the marker that migration writes (FORMAT.md records it), is skipped `copied`, so each session counts once (pre-flight H10).
- **Without an index entry,** the cwd comes from the "Current Working Directory (<path>)" line of the environment-details block. It is matched in memory in the first API-history element that holds it, and reading stops there (`"stop"`). Roo's older API history file is `claude_messages.json`.
- **`ui_messages.json`** is a root array, streamed through `readJsonItems`.
  - Elements beyond 32 MiB are skipped `oversize`, and elements whose head shows an `images` data URL are skipped `sniffed`.
  - `partial: true` rows, and `say` values `error_retry`, `api_req_retried` and `task_progress`, are skipped, as Cline itself does.
- **`task_metadata.json`** is read through `readSidecar`. Only two parts are kept:
  - `model_usage[]{ ts, model_id, mode }`;
  - `environment_history[].cline_version`, which gives `version`.

  `files_in_context`, host names and OS fields are parsed and dropped.

| Element | Maps to |
|---|---|
| the first prompt (per variant), `say: "user_feedback"` | a prompt |
| `say: "api_req_started"` | usage, from its JSON `text`: `tokensIn`, `tokensOut`, `cacheReads`, `cacheWrites`, `cost`. The model is the latest `model_usage` entry at or before `ts`. Never `request`. |
| `ask` or `say` `"tool"` | a call named by its JSON `text.tool`, with path key `path` |
| `say: "command"`, `ask: "command"` | a `command` call; the text is the command, without a trailing `REQ_APP` |
| `say: "command_permission_denied"` | a `denial` marker with detail `rule`, and outcome `denied` on the pending command |
| `ask: "use_mcp_server"` | `mcp`, with `mcpServer` from the JSON's `serverName` |
| `say: "browser_action"` | `browser` |
| `ask: "use_subagents"`, `say: "subagent"`, Roo's `newTask` | `delegate` |
| `ask: "followup"`, `completion_result` | `meta` |
| `say: "error"`, `ask: "api_req_failed"` | an `error` marker |
| anything else | read and dropped |

- **Tool names** (`text.tool`):
  - `readFile`, `listFilesTopLevel`, `listFilesRecursive`, `listCodeDefinitionNames`, Roo's `readCommandOutput` → read;
  - `searchFiles`, Roo's `codebaseSearch` → search;
  - `editedExistingFile`, `fileDeleted`, Roo's `appliedDiff` → edit; `newFileCreated` → write;
  - `webFetch`, `webSearch` → web;
  - `useSkill`, `skill` → skill; Roo's `updateTodoList` → todo;
  - `summarizeTask`, Roo's `switchMode` and `finishTask` → meta.
- **Sessions:**
  - start and end come from the first and last `ts`;
  - `mode` is `chat` when every mode seen is Cline's `plan` or Roo's and Kilo's `ask`, else `agent`;
  - a `parentTaskId` gives origin `subagent`, with `agentType` from its mode, kept when it is in `variant.modes`.
- **Outcomes.** The task format records no tool outcomes other than the denial above, so other calls carry no `ok`, and FORMAT.md says so.

**Cline SDK sessions** (Cline 4.x "Next", CLI 3.x).
- **Locate:** `$CLINE_SESSION_DATA_DIR`, else `$CLINE_DIR/data/sessions`, else `<home>/.cline/data/sessions`, then `*/`.
- **Manifest** `<sid>.json`, read through `readSidecar`:
  - kept: `session_id`, `source` (`surface`, through `oneOf`), `started_at`, `ended_at`, `status`, `model` and `cwd`;
  - never kept: `prompt`, `metadata.title`, `metadata.git` and `system_prompt`;
  - a manifest flagged `metadata.legacyTask` or `migratedFromLegacyTask` is skipped `copied`, because its task folder is read directly.
- **Messages** `<sid>.messages.json`, read through `readJsonItems(arrayKey: "messages")`. The CLI rewrites it whole and not atomically, so a truncated tail is a counted `parse` skip.
  - **Prompts:** user text blocks. A user message holding only `tool_result` blocks is not a prompt.
  - **Calls:** assistant `tool_use` blocks.
    - `run_commands` holds a JSON array of commands in one string field, giving one shell call per command;
    - `read_files` → read; `editor` and `apply_patch` → edit; `spawn_agent` → delegate.
  - **Results:** `tool_result` with `is_error`.
  - **Usage:** `metrics`, with `modelInfo.id`.
- **Subagents:** `<agentId>[__<taskId>].messages.json` in the session folder gives subagent sessions whose parent is the session.

**Never opened:**
- VS Code's `state.vscdb` (secrets and global state);
- `globalStorage/<extId>/settings/` (MCP settings, with env and keys) and `globalStorage/<extId>/checkpoints/` (shadow git copies of your workspace);
- `~/.cline/data/{secrets.json, globalState.json, settings/, db/}`;
- in a task folder, every file but the three above and `history_item.json`;
- `<sid>.compaction.json`.

**Sources:**
- Cline (prefix `https://github.com/cline/cline/blob/`):
  - `v3.58.0/src/shared/ExtensionMessage.ts`, `v3.58.0/src/core/storage/disk.ts`, `v3.58.0/src/shared/HistoryItem.ts`, `v3.58.0/src/core/task/index.ts`;
  - `main/apps/vscode/src/core/context/context-tracking/ContextTrackerTypes.ts`, `main/apps/vscode/src/sdk/legacy-state-reader.ts`, `main/apps/vscode/src/sdk/sdk-task-history.ts`;
  - `main/sdk/packages/shared/src/storage/paths.ts`, `main/sdk/packages/core/src/services/session-artifacts.ts`, `main/sdk/packages/core/src/session/models/session-manifest.ts`;
  - `main/CHANGELOG.md`.
- Roo (prefix `https://github.com/RooCodeInc/Roo-Code/blob/main/`): `packages/types/src/message.ts`, `packages/types/src/history.ts`, `src/core/task-persistence/TaskHistoryStore.ts`.
- Kilo: https://github.com/Kilo-Org/kilocode/blob/main/packages/kilo-vscode/src/legacy-migration/sessions/migrate.ts and https://kilo.ai/articles/roo-to-kilo-migration-guide.
- https://github.com/getagentseal/codeburn/blob/main/docs/providers/vscode-cline-parser.md and `cline-cli.md`.

- [ ] **Steps 0–6:** per the shared steps. Before coding, `test -e` each variant's `globalStorage/<extId>/tasks` under the local VS Code-family User folders, then `test -e ~/.cline/data/tasks` and `test -e ~/.cline/data/sessions`. Specifics:
  - **Fixture:**
    - **Cline task:**
      - prompts: a `task` prompt holding `CANARY.prompt` and 2 `user_feedback` prompts;
      - usage: `api_req_started`;
      - tools: `readFile` and `editedExistingFile` on `CANARY.path` files, a `say: "command"` `npm run lint`, an `ask: "command"` `rm -rf build REQ_APP` followed by `command_permission_denied`, and `use_mcp_server` on `CANARY.mcp`;
      - a `partial` row and a 40 MiB element holding a base64 image;
      - `taskHistory.json` giving its cwd;
    - **Roo:** a parent task and a child task in `code` mode, with `history_item.json`;
    - **Kilo:** a task in `ask` mode, and a migrated task whose copy a `kilo.db` holds (pre-flight H10);
    - **SDK:**
      - a Cline SDK session with `run_commands` holding two commands and a subagent transcript;
      - a manifest flagged `legacyTask`;
      - a manifest `prompt` holding `CANARY.prompt`;
      - a truncated messages file;
    - `settings/cline_mcp_settings.json` and `~/.cline/data/secrets.json` holding `CANARY.secret`.
  - **Tests:**
    - **Cline task:**
      - 3 prompts;
      - lint → `{ category: "lint", checks: ["lint"], toolchain: "js" }`;
      - the denied command has `outcome: "denied"` and a `denial` marker, and its command is classified without `REQ_APP`;
      - `mcpServer` is the MCP canary, an allowed exempt field;
      - the partial row is skipped, the large element is skipped, and RSS grows by less than 128 MiB;
      - the cwd comes from `taskHistory.json`.
    - **Roo:** the child has origin `subagent` and `agentType: "code"`.
    - **Kilo:** `mode: "chat"`; the migrated task is skipped `copied`, and its session counts once (pre-flight H10).
    - **SDK:**
      - the session has 2 shell calls and a subagent session;
      - the flagged manifest is skipped `copied`;
      - the truncated tail is a counted skip.
    - **Opens:** the two secret files are never opened.
  - **Drift cases:** `say` renamed → `(none)` keys and `zero-yield`; the `api_req_started` JSON `tokensIn` renamed → `api_req_started:shape`. One case per plugin id: the `say` rename also for `roo-code.tasks` and `kilo-code.tasks`, and for `cline.sessions` a messages file whose `messages` key is renamed → `messages:shape` (pre-flight H1).

---
### Task 7: Qwen Code and Factory Droid (P2) — JSONL transcripts

**Files:** per the shared steps, for `core/sources/qwen-code/` (`index.ts`, `chats.ts`) and `core/sources/droid/` (`index.ts`, `sessions.ts`).

**Interfaces:**
- Produces:
  - `qwChats` (`qwen-code.chats`, P2, beta, windows `["detail"]`, primary `{ detail: ["session", "prompt"] }`);
  - `drSessions` (`droid.sessions`, P2, beta, windows `["detail"]`, primary `{ detail: ["session", "prompt"] }`).
- Placeholders: `<qwen>`, `<factory>`. Variables: `QWEN_HOME`, `QWEN_RUNTIME_DIR`.

**Qwen Code.**
- **Locate:**
  - the root is `$QWEN_RUNTIME_DIR`, else `$QWEN_HOME`, else `<home>/.qwen`;
  - files `projects/*/chats/*.jsonl`;
  - older builds' `tmp/*/chats/*` too. When their records are Gemini CLI's layout, read them with Task 4's `GeminiChat`; FORMAT.md records which layout a file has.
- **Records,** streamed. Each record has `uuid`, `parentUuid`, `sessionId`, `timestamp` (ISO), `type`, `cwd`, `version` and `message.parts[]`.
  - **Sessions:** one per `sessionId`, with `cwd`, `version`, and the model from `model` or `executionContext.modelId`.
    - Records with `isSidechain` or `agentId` form a subagent session `<sessionId>/<agentId>`, whose parent is the main session.
  - **Prompts:** `type: "user"` records whose `provenance` is absent or `real_user`, outside a sidechain. The text is their text parts.
    - `provenance` values `mod_prompt`, `system`, `external_agent` and `tool_result` are not prompts.
    - Records that carry `systemPayload` are skipped `injected`.
  - **Tools:**
    - calls are assistant `functionCall{ id?, name, args }` parts;
    - `tool_result` records' `toolCallResult{ callId, status }` give the result: `success` → ok, `error` → not ok, `cancelled` → outcome `cancelled`.
  - **Usage:** `usageMetadata` gives `inTok = promptTokenCount − cachedContentTokenCount`, `outTok = candidatesTokenCount + thoughtsTokenCount` and `cacheR = cachedContentTokenCount`.
  - **Markers:** `system` records with subtype `chat_compression` → `compact-auto`.
  - **Tool table:** from `packages/core/src/tools/tool-names.ts`, with shell `run_shell_command` (`command`), edits `edit` and `write_file` (`file_path`), and subagent `task` → `delegate`.
- **Never opened:**
  - credentials: `oauth_creds.json`, `google_accounts.json`, `mcp-oauth-tokens.json`, `installation_id`, `settings.json`, `.env`;
  - folders: `tmp/*/shell_history`, `tmp/*/checkpoints/`, `tmp/*/tool-results/`, `logs/`;
  - session sidecars: `*.runtime.json`.
- **Sources:**
  - https://github.com/QwenLM/qwen-code/blob/main/packages/core/src/services/chatRecordingService.ts;
  - https://github.com/QwenLM/qwen-code/blob/main/packages/core/src/config/storage.ts;
  - https://github.com/QwenLM/qwen-code/blob/main/packages/core/src/utils/paths.ts;
  - https://github.com/QwenLM/qwen-code/blob/main/packages/core/src/core/turn.ts;
  - https://qwenlm.github.io/qwen-code-docs/1.x/en/users/data-privacy/;
  - https://github.com/getagentseal/codeburn/blob/main/src/providers/qwen.ts.

**Factory Droid.**
- **Locate:** `<home>/.factory/sessions/*/*.jsonl` and `<home>/.factory/projects/*/*.jsonl`. The sources disagree on which layout is current, so the reader takes both. Each file may have a sibling `<id>.settings.json`.
- **Records:**
  - **The first record,** `type: "session_start"`, opens the session, with `id` and `cwd`. `title` is never kept.
  - **`type: "message"` records** carry `timestamp` (ISO) and `message{ role, content[] }`, which hold Anthropic-style blocks:
    - user `text` blocks are prompts, unless the text starts with `<system-reminder>` or `<system` (injected);
    - `tool_use{ id, name, input }` blocks are calls;
    - `tool_result{ tool_use_id, is_error }` blocks give results.
  - **Other record types** are known only once FORMAT.md lists them; until then they count as drift.
- **Sidecar** (`readSidecar`):
  - `model` gives the session model;
  - `tokenUsage` gives `TotalsEv.tokens`, the sum of its counts;
  - `autonomyMode` gives `approval`, through `oneOf` and the values FORMAT.md lists.
- **Tool table:**
  - read: `Read`, `LS`; write: `Create`; edit: `Edit`, `MultiEdit`, `ApplyPatch`; search: `Glob`, `Grep`;
  - `Execute` → shell (`command`);
  - meta: `AskUser`; todo: `TodoWrite`; skill: `Skill`; delegate: `Task`; web: `WebSearch`, `FetchUrl`; plan: `ExitSpecMode`;
  - anything else → `other`.
- **Never opened:** `~/.factory/{settings.json, mcp.json}`, `~/.factory/logs/`, and any `~/.factory/auth*` file.
- **Sources:**
  - https://docs.factory.com/reference/hooks-reference;
  - https://skills.sh/factory-ai/factory-plugins/session-navigation;
  - https://github.com/getagentseal/codeburn/blob/main/src/providers/droid.ts;
  - https://github.com/izikeros/droid-dash/blob/main/src/droid_dash/core/parser.py;
  - https://ccusage.com/guide/droid/.

- [ ] **Steps 0–6:** per the shared steps. Specifics:
  - **Fixture, Qwen:** one main session with 2 `real_user` prompts, a `mod_prompt` record and a `systemPayload` record; a `run_shell_command` `pnpm test` call that errors; a sidechain agent with 2 calls; `usageMetadata`; a `chat_compression` record; `oauth_creds.json` holding `CANARY.token`. Also a `tmp/` chat in the Gemini layout.
  - **Fixture, Droid:** sessions under both `sessions/` and `projects/`. One holds a `<system-reminder>` user text, an `Execute` `pytest -q` call with `is_error: true`, and a sibling settings file with `tokenUsage`.
  - **Tests, Qwen:**
    - 2 sessions, one of them `subagent` with no prompts;
    - 2 human prompts;
    - the test call `{ checks: ["test"], ok: false }`;
    - a `compact-auto` marker;
    - usage tokens as defined above;
    - the Gemini-layout file read as well.
  - **Tests, Droid:**
    - both layouts read;
    - the injected text skipped `injected`;
    - `Execute` gives `{ category: "test", ok: false }`;
    - `TotalsEv.tokens` set.
  - **Drift cases:** Qwen `message` renamed → `message:shape`; Droid `type` renamed → `(none)` keys and `zero-yield`.

---

### Task 8: Amp and Continue (P2) — whole JSON session documents

**Files:** per the shared steps, for `core/sources/amp/` (`index.ts`, `threads.ts`) and `core/sources/continue/` (`index.ts`, `sessions.ts`).

**Interfaces:**
- Produces:
  - `amThreads` (`amp.threads`, P2, beta, primary `{ detail: ["session", "prompt"] }`);
  - `cnSessions` (`continue.sessions`, P2, beta, primary `{ detail: ["session", "prompt"] }`).
- Placeholders: `<amp data>`, `<continue>`. Variables: `AMP_DATA_DIR` (a third-party convention, marked so in FORMAT.md), `CONTINUE_GLOBAL_DIR`.

**Amp.**
- **Locate:** the root is `$AMP_DATA_DIR`, else `<data>/amp`. On win32 it is `<home>\.local\share\amp`, which FORMAT.md marks unverified. Files are `threads/**/*.json`.
- **Reading:** each thread through `readJsonItems(file, { arrayKey: "messages" })`.
  - **Members:**
    - `id`, the raw id, with idShape `/^T-[0-9a-f-]{36}$/`;
    - `created`, the start, in ms;
    - `env.initial.trees[0].uri`, the cwd, through Plan 2's `uriToPath`;
    - `usageLedger.events[]`, usage per event: model, `tokens.input` and `tokens.output`, at its `timestamp`.
  - **Messages:**
    - a user message whose `text` blocks are non-empty is a prompt at `meta.sentAt`. A user message that holds only `tool_result` blocks is not;
    - assistant `tool_use{ id, name, input }` blocks are calls;
    - `tool_result{ toolUseID, run{ status, result } }` blocks are results:
      - `done` → ok;
      - `error` → not ok;
      - `cancelled` → outcome `cancelled`;
      - `rejected` → outcome `denied`;
      - `result.exitCode` gives `exit`;
    - with no usage ledger, assistant `usage` gives usage.
  - **Never kept:** `title`, `relationships`, `env.initial.trees[].{displayName, repository}` and `platform`. Forks and handoffs are not linked, and FORMAT.md says so.
- **Tool table:** the built-in tool names that Amp's docs list, with the shell tool's command key and the edit and create tools' path keys from FORMAT.md. Anything else → `other`.
- **Never opened:** `<amp data>/secrets.json` and `~/.config/amp/settings.json(c)`.
- **Sources:**
  - https://ampcode.com/docs/threads;
  - https://ampcode.com/docs/cli/settings;
  - https://github.com/getagentseal/codeburn/blob/main/src/providers/amp.ts;
  - https://pkg.go.dev/github.com/marcus/sidecar/internal/adapter/amp;
  - https://ccusage.com/guide/amp/.

**Continue.**
- **Locate:** `$CONTINUE_GLOBAL_DIR`, else `<home>/.continue`. Files are `sessions/*.json`.
- **Index.** `sessions/sessions.json` is a root array, read through `readJsonItems`. Each `{ sessionId, dateCreated, workspaceDirectory }` gives that session's start (`dateCreated` is an epoch-ms string) and its cwd. `title` is never kept.
- **Each session** is read through `readJsonItems(file, { arrayKey: "history" })`.
  - **Members:**
    - `sessionId`;
    - `mode`: `chat` → `mode: "chat"`, and `agent`, `plan` or `background` → `mode: "agent"`;
    - `usage`: `promptTokens` and `completionTokens` give `TotalsEv.tokens`, and `totalCost` gives `usd`.
  - **Items:**
    - user `message` text (a string, or `text` parts) gives a prompt;
    - assistant `toolCalls[].function{ name, arguments }` give calls, with `arguments` parsed in memory as JSON;
    - `toolCallStates[]` give results: `done` → ok, `errored` → not ok, `canceled` → outcome `cancelled`.
  - **Not read:** `contextItems`, `promptLogs` and `reasoning`.
- **Times.** Messages carry no time. Events take the session's start plus 1 ms per item, in order, and FORMAT.md says so. Without an index entry, the start is the session's earliest known time; failing that, the session is skipped `no-ts`. File mtimes are never used.
- **Tool table:** Continue's built-in tools from `core/tools/builtIn.ts`, with the terminal tool's command key and the file tools' path keys.
- **Never opened:**
  - `config.yaml`, `config.json`, `config.ts` and `.env`;
  - `dev_data/`, whose events hold full LLM prompts and completions;
  - `index/` and `logs/`.
- **Sources:**
  - https://github.com/continuedev/continue/blob/main/core/util/paths.ts;
  - https://github.com/continuedev/continue/blob/main/core/util/history.ts;
  - https://github.com/continuedev/continue/blob/main/core/index.d.ts;
  - https://docs.continue.dev/customize/deep-dives/development-data.

- [ ] **Steps 0–6:** per the shared steps. Specifics:
  - **Fixture, Amp:** one 12 MiB thread whose base64 tool output sits inside the messages; a shell call with `exitCode: 1`; a rejected call; a usage ledger; `secrets.json` holding `CANARY.secret`.
  - **Fixture, Continue:** an index with 2 sessions; one `agent` session with a terminal call that is `errored` and holds `contextItems` with `CANARY.code`; a `dev_data/0.2.0/chatInteraction.jsonl` with `CANARY.prompt`.
  - **Tests, Amp:**
    - the thread is read item by item, with RSS growth under 64 MiB;
    - the rejected call has `outcome: "denied"`;
    - `exit: 1`;
    - usage from the ledger;
    - no title anywhere.
  - **Tests, Continue:**
    - `mode: "agent"`;
    - events ordered as written;
    - the terminal call is not ok;
    - `dev_data` is never opened;
    - a session file without an index entry and without any time is skipped `no-ts`.
  - **Drift cases:** Amp `messages` renamed → `messages:shape`; Continue `history` renamed → `history:shape`.

---

### Task 9: Goose and Crush (P2) — SQLite session stores

**Files:** per the shared steps, for `core/sources/goose/` (`index.ts`, `db.ts`, `legacy.ts`) and `core/sources/crush/` (`index.ts`, `db.ts`).

**Interfaces:**
- Produces:
  - `gsSessions` (`goose.sessions`, P2, beta, primary `{ detail: ["session", "prompt"] }`);
  - `crSessions` (`crush.sessions`, P2, beta, primary `{ detail: ["session", "prompt"] }`).
- Placeholders: `<goose data>`, `<crush data>`. Variables: `GOOSE_PATH_ROOT`, `CRUSH_GLOBAL_DATA`.

**Goose.**
- **Locate:**
  - `$GOOSE_PATH_ROOT/data/sessions/`;
  - else, on darwin and linux, `<data>/goose/sessions/` (XDG on macOS too);
  - else, on win32, `<appData>\Block\goose\data\sessions\`.
- **`sessions.db`** (v1.10+). The reader checks `schema_version`. It selects only:
  - **`sessions`:** `id, session_type, working_dir, created_at, updated_at, parent_session_id, provider_name`, plus `json_extract(model_config_json, '$.model_name')`;
  - **`messages`:** `session_id, role, content_json, created_timestamp, json_extract(metadata_json, '$.userVisible')`, paged with `Pass.byRowid` at `page: 200`, because message JSON can be large;
  - **`usage_ledger`:** `session_id, created_timestamp, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost`.

  It never selects `name`, `description`, `recipe_json`, `system_prompt_override`, or anything from `threads`, `thread_messages` or `session_tags`.
- **Origin** by `session_type`:

  | `session_type` | Origin |
  |---|---|
  | `user`, `terminal` | human |
  | `scheduled` | scheduled |
  | `sub_agent` | subagent |
  | `acp` | peer |
  | `gateway` | scripted |
  | `hidden` | skipped `internal` |

- **Messages:**
  - user `text` blocks with `userVisible` not false are prompts;
  - assistant `toolRequest{ id, toolCall.value{ name, arguments } }` blocks are calls;
  - `toolResponse{ id, toolResult{ status, value.isError } }` blocks, which arrive in user messages, are results.
  - `created_timestamp` is in seconds; values above 1e10 are read as ms.
- **Tool names:**
  - `developer__shell` → shell (`command`);
  - `developer__text_editor` → `byArg` on `command`: `view` → read, `write` → write, `str_replace`, `insert` and `undo_edit` → edit; path key `path`;
  - other `<extension>__<tool>` names whose extension is a Goose built-in listed in FORMAT.md → `other`;
  - any remaining `<extension>__<tool>` → `mcp`, with the extension as the server.
- **Legacy `*.jsonl`** (before 1.10):
  - the first line is metadata (`working_dir`), and the id is the file stem;
  - later lines are `{ role, created, content[] }`, mapped the same way;
  - a stem that `sessions.db` already holds is skipped `copied`.
- **Never opened:**
  - the OS keyring;
  - `~/.config/goose/{secrets.yaml, config.yaml}` and their win32 equivalents;
  - `~/.local/state/goose/logs/`, which holds raw LLM requests.
- **Sources:**
  - https://github.com/aaif-goose/goose/blob/main/crates/goose/src/session/session_manager.rs;
  - https://github.com/aaif-goose/goose/blob/main/crates/goose/src/session/legacy.rs;
  - https://github.com/aaif-goose/goose/blob/main/crates/goose/src/config/paths.rs;
  - https://goose-docs.ai/docs/guides/sessions/session-management;
  - https://goose-docs.ai/docs/guides/logs.

**Crush.**
- **Locate.** The candidate is the folder that holds `projects.json`:
  - `$CRUSH_GLOBAL_DATA`;
  - else, on darwin and linux, `<data>/crush`;
  - else, on win32, `<localAppData>\crush`.

  `locate` opens nothing.
- **Index.** `scan` reads `projects.json` with `readSidecar`. For each `{ path, data_dir }`:
  - the database is `d.toHost(data_dir)/crush.db`;
  - `path` is the cwd of its sessions.

  Each database counts toward `files` and `bytes` of the one coverage.
- **SQL.** The reader selects only:
  - **`sessions`:** `id, parent_session_id, message_count, prompt_tokens, completion_tokens, cost, created_at, updated_at`;
  - **`messages`:** `id, session_id, role, parts, model, provider, created_at, finished_at, is_summary_message`, paged at `page: 200`.

  It never selects `title`, `todos`, or anything from `files` or `read_files`, which hold whole file contents and paths. It never takes `crush.lock`.
- **Sessions:**
  - id `title-<parent>` → skipped `internal`;
  - an id holding `$$` with a parent → `subagent`;
  - summary messages (`is_summary_message`) → skipped `internal`;
  - times are Unix seconds.
- **Parts:**
  - user `text` parts, except `hidden` ones, are prompts;
  - `tool_call{ id, name, input }` parts are calls, with `input` parsed in memory;
  - `tool_result{ tool_call_id, is_error, content }` parts are results. The exit code is `/^Exit code (\d+)/m` of the content, in memory, and a non-zero exit means not ok;
  - `finish{ reason }` → a `TurnEv`: `end_turn` → completed, `canceled` → interrupted, `error` → failed;
  - `shell_command` parts are the person's own shell commands, so they are not tool events.
- **Tool table:** Crush's tools from `internal/agent/tools/`:
  - `bash` → shell (`command`);
  - `edit`, `multiedit` → edit; `write` → write; `view` → read (path keys from FORMAT.md);
  - `ls` → read; `glob`, `grep` → search; `fetch`, `download` → web;
  - `agent` → delegate;
  - `todos` → todo.
- **Never opened:** `crush.json` beside `projects.json`, and `~/.config/crush/crush.json`.
- **Sources:**
  - https://github.com/charmbracelet/crush/blob/main/internal/projects/projects.go;
  - https://github.com/charmbracelet/crush/blob/main/internal/db/models.go;
  - https://github.com/charmbracelet/crush/blob/main/internal/message/content.go;
  - https://github.com/charmbracelet/crush/blob/main/internal/session/session.go;
  - https://github.com/charmbracelet/crush/blob/main/internal/agent/tools/bash.go.

- [ ] **Steps 0–6:** per the shared steps. Specifics:
  - **Fixture, Goose:** a `sessions.db` (with `schema_version` 18) holding a user, a `sub_agent` and a `hidden` session. It has a `developer__shell` `go test ./...` call with `isError`, a `text_editor` `view`, an MCP extension tool and `usage_ledger` rows. Beside it, a legacy JSONL whose stem is in the DB and another that is not.
  - **Fixture, Crush:** `projects.json` listing 2 projects whose DBs hold a title session, an agent sub-session, a summary message and a bash result `Exit code 2`. A `files` row holds `CANARY.code`.
  - **Tests, Goose:**
    - origins match the table, and the hidden session is skipped;
    - `go test` gives `{ category: "test", ok: false, toolchain: "go" }`;
    - `view` → read;
    - the MCP call has `mcpServer`;
    - the legacy copy is skipped `copied`, while the other legacy file is read.
  - **Tests, Crush:**
    - the title session is skipped;
    - the sub-session is a `subagent` with no prompts;
    - `exit: 2`, not ok;
    - a `TurnEv` per finish;
    - `__observeQueries` shows no query touches `files` or `read_files`.
  - **Drift cases:** Goose `content_json` renamed → `table-unreadable:messages` or `content_json:shape`; Crush `parts` renamed → drift.

---

### Task 10: Zed and Warp (P2) — SQLite stores with JSON and zstd values

**Files:** per the shared steps, for `core/sources/zed/` (`index.ts`, `threads.ts`, `legacy.ts`) and `core/sources/warp/` (`index.ts`, `db.ts`).

**Interfaces:**
- Produces:
  - `zdThreads` (`zed.threads`, P2, beta, primary `{ detail: ["session", "prompt"] }`);
  - `wpAgent` (`warp.agent`, P2, beta, primary `{ detail: ["session", "prompt"] }`).
- Placeholders: `<zed data>`, `<warp data>`.

**Zed.**
- **Locate:** `threads/threads.db` under Zed's data folder:
  - darwin: `appSupport("Zed")`;
  - linux: `$FLATPAK_XDG_DATA_HOME/zed`, else `<data>/zed`;
  - win32: `<localAppData>\Zed`.
- **SQL:** `id, created_at, updated_at, parent_id, folder_paths, data_type, data` from `threads`, read by `Pass.byRowid` with `page: 32`, because values can be large. It never selects `summary`.
- **Decoding:**
  - `data_type`:
    - `zstd` → `zstdBytes(data, 64 MiB)`;
    - `json` → UTF-8 text;
    - else → drift `data_type:shape`.
  - Decoded failures count as `skipped["too-large" | "corrupt"]`.
  - The JSON's `version`:
    - `0.3.0` → serde-tagged messages: `{"User":{…}}`, `{"Agent":{…}}`, `"Resume"`, `{"Compaction":…}`;
    - `0.2.0`, `0.1.0` or missing → the legacy `role` / `segments` / `tool_uses` / `tool_results` layout;
    - anything else → drift `version:<value class>`.
- **Mapping:**
  - **Session:**
    - start is `created_at`, else `updated_at`; end is `updated_at`; both are RFC 3339;
    - cwd is the first line of `folder_paths`, through `toHost`;
    - parent is `parent_id`, or `subagent_context.parent_thread_id`;
    - model is `model.model`.
  - **Prompts:** user `Text` items. `Mention` items are injected context and are skipped. Messages carry no time, so each takes start plus 1 ms per message, and FORMAT.md says so.
  - **Tools:**
    - agent `ToolUse{ id, name, input }` are calls;
    - `tool_results{ <id>: { is_error } }` give results;
    - `Compaction` → `compact-auto`.
  - **Usage:** each `request_token_usage[<user message id>]` is a usage at that prompt's time, else `cumulative_token_usage` at the end.
  - **Never kept:** JSON `title`, `detailed_summary`, `draft_prompt`, `initial_project_snapshot` and `Mention` content.
- **Tool table:** Zed's native agent tools from `crates/agent/src/tools/`:
  - `terminal` → shell (`command`);
  - `edit_file` → edit (`path`); `read_file` → read;
  - `grep`, `find_path` → search; `list_directory` → read;
  - `fetch`, `web_search` → web;
  - `now`, `thinking` → meta;
  - the subagent tool → delegate.
- **Not read:** Zed's main database (`db/*/db.sqlite`), which holds only metadata about external agents. Those agents' own stores are read by their own readers.
- **Sources:**
  - https://github.com/zed-industries/zed/blob/main/crates/agent/src/db.rs;
  - https://github.com/zed-industries/zed/blob/main/crates/agent/src/legacy_thread.rs;
  - https://github.com/zed-industries/zed/blob/main/crates/agent/src/thread.rs;
  - https://github.com/zed-industries/zed/blob/main/crates/paths/src/paths.rs;
  - https://github.com/zed-industries/zed/blob/main/crates/util/src/path_list.rs.

**Warp.**
- **Locate:** `warp.sqlite` under:
  - darwin: `<home>/Library/Group Containers/2BBY89MBSN.dev.warp/Library/Application Support/dev.warp.Warp-Stable/` and `…Warp-Preview/`;
  - linux: `<state>/warp-terminal/` and `<state>/warp-terminal-preview/`;
  - win32: `<localAppData>\warp\Warp\data\`.
- **SQL.** The reader selects only:
  - **`ai_queries`:** `exchange_id, conversation_id, start_ts, input, working_directory, output_status, model_id`, paged. `input` is parsed in memory for its `Query.text`;
  - **`agent_conversations`:** `conversation_id, last_modified_at`, plus `json_extract(conversation_data, …)` of exactly `$.parent_conversation_id` and the four `$.conversation_usage_metadata.total_charged_usage` token fields;
  - **`blocks`:** `json_extract(ai_metadata, '$.conversation_id'), exit_code, start_ts, completed_ts`, only `WHERE ai_metadata IS NOT NULL`.

  It never selects:
  - from `blocks`: `stylized_command`, `stylized_output`, `pwd`, `user` or `host`;
  - `summary`;
  - anything from `commands` (the person's whole shell history), `users`, `current_user_information`, `user_profiles`, `mcp_environment_variables`, `mcp_server_installations` or `agent_tasks`.
- **Mapping:**
  - **Session:** one per `conversation_id`. Start and end come from its queries; cwd is the first `working_directory`; parent is `parent_conversation_id`.
  - **Prompts:** each query's text, at `start_ts` (naive UTC).
  - **Turns:** each query is a `TurnEv` with `model_id`:
    - `Completed` → completed;
    - `Failed` → failed;
    - `Cancelled` → interrupted.
  - **Tools:** each agent block is a `ToolEv{ name: "shell", category: "shell", ok: exit_code === 0, exit, ms }`. It carries no checks, because the command text is never read; FORMAT.md says so.
  - **Usage:** one per conversation, at its last query, with its most frequent model.
- **Sources:**
  - https://github.com/warpdotdev/warp/blob/master/crates/persistence/src/schema.rs;
  - https://github.com/warpdotdev/warp/blob/master/crates/persistence/src/model.rs;
  - https://github.com/warpdotdev/warp/blob/master/app/src/persistence/agent.rs;
  - https://docs.warp.dev/terminal/sessions/session-restoration.md.

- [ ] **Steps 0–6:** per the shared steps. Specifics:
  - **Fixture, Zed:**
    - a `threads.db` with a v0.3.0 zstd thread (2 user texts, a `Mention` holding `CANARY.code`, a failing `terminal` `cargo test` call);
    - a legacy `json` thread;
    - a subagent thread with `parent_id`;
    - a zstd blob that inflates past the cap;
    - `summary` = `CANARY.project`.
  - **Fixture, Warp:** a `warp.sqlite` with 2 conversations (one child), 3 queries (Completed, Failed, Cancelled) and 2 agent blocks with exit codes 0 and 1. Its `commands` and `blocks.stylized_command` hold `CANARY.code`, and `current_user_information` holds `CANARY.email`.
  - **Tests, Zed:**
    - both versions read;
    - `Mention` is not a prompt;
    - `{ category: "test", ok: false, toolchain: "rust" }`;
    - the child has its parent;
    - the large blob is skipped `too-large`;
    - `summary` is never selected.
  - **Tests, Warp:**
    - turn statuses `{ completed: 1, failed: 1, interrupted: 1 }`;
    - shell events ok and not ok;
    - `__observeQueries` never names `commands`, `stylized_command`, `stylized_output` or `current_user_information`.
  - **Drift cases:** Zed a `version` of `9.9.9` → drift; Warp `input` reshaped → `input:shape`.

---

### Task 11: Kiro (P2) — IDE and CLI sessions

**Files:** per the shared steps, for `core/sources/kiro/` (`index.ts`, `cli.ts`, `ide.ts`).

**Interfaces:**
- Produces:
  - `krCli` (`kiro.cli`, P2, beta, primary `{ detail: ["session", "prompt"] }`);
  - `krIde` (`kiro.ide`, P2, beta, primary `{ detail: ["session", "prompt"] }`).
- Placeholders: `<kiro>`, `<Kiro user>`. Variable: `KIRO_HOME`.

**Layouts.** The sources disagree, and the stores have changed several times, so the reader decodes three layouts and counts the others.

| Layout | Where | Read as |
|---|---|---|
| CLI 2.x JSONL | `<kiro>/sessions/cli/<id>.jsonl`, plus `<id>.json` | Lines `{ version, kind, data }`. `Prompt` (`meta.timestamp`, seconds) → prompt. `AssistantMessage` content `toolUse{ name, … }` → calls. `ToolResults` → results. `Clear` → `clear` marker. The companion gives `cwd`, `created_at`, `updated_at` and the model at `session_state.rts_model_state.model_info.model_id`. |
| CLI 3.x | `<kiro>/sessions/<hash>/sess_<id>/{session.json, messages.jsonl}` | `session.json` gives `id`, `modelId`, `workspacePaths[0]` (cwd), `createdAt` and `lastModifiedAt`. Lines `{ id, timestamp, payload{ type } }`: `user` → prompt, `tool_call` → call, `tool_result` → result, `turn_end` → `TurnEv`. |
| IDE `.chat` | `<Kiro user>/globalStorage/kiro.kiroagent/<32-hex>/<executionId>.chat` | `readJsonItems(arrayKey: "chat")`. Role `human` → prompt, except content starting `<identity>` (injected). Role `bot` → calls from `<tool_use><name>…</name>` in memory. `metadata.{modelId, startTime, endTime}`. |
| counted only | the IDE's extensionless execution files, `workspace-sessions/**`, and the CLI's `data.sqlite3` | `present-undecodable`, with `files` and `bytes` |

- **Never read:** `title` fields.
- **Usage.** Kiro records credits, not tokens, so no `UsageEv` is emitted, and FORMAT.md says so.
- **Locate:**
  - `$KIRO_HOME`, else `<home>/.kiro`;
  - `vscodeUserDirs(env, homes, "Kiro", ".kiro-server")`;
  - `data.sqlite3` under `appSupport("kiro-cli")` (darwin and win32), or `<data>/kiro-cli` (linux). It is never opened: it is only counted.
- **Never opened:**
  - `~/.aws/sso/cache/` (`kiro-auth-token.json` and its client registration);
  - `<kiro>/settings/mcp.json`, `.kiro/settings/mcp.json`;
  - everything under `<kiro>` except `sessions/`;
  - the `auth_kv` table: `data.sqlite3` is never opened at all.
- **Sources:**
  - https://kiro.dev/docs/cli/chat/session-management/;
  - https://kiro.dev/docs/reference/settings/;
  - https://github.com/mxmehl/kiro-cli-history;
  - https://github.com/getagentseal/codeburn/blob/main/src/providers/kiro.ts;
  - https://github.com/aws/amazon-q-developer-cli/blob/main/crates/chat-cli/src/database/mod.rs.

- [ ] **Steps 0–6:** per the shared steps. Specifics:
  - **Fixture:** one session in each decoded layout, each with a prompt holding `CANARY.prompt` and a shell call. The `.chat` session holds an `<identity>` system message. The extensionless and `data.sqlite3` stores hold `CANARY.secret`, and so does `~/.aws/sso/cache/kiro-auth-token.json`.
  - **Tests:**
    - 3 sessions with their cwds;
    - the `<identity>` text skipped `injected`;
    - the 3.x `turn_end` gives a `TurnEv`;
    - the counted stores are `present-undecodable` with their file counts, and their bytes are never opened;
    - no `UsageEv`.
  - **Drift cases:** CLI 2.x `kind` renamed → drift and `zero-yield`; for `kiro.ide`, a `.chat` file whose `chat` key is renamed → `chat:shape` (pre-flight H1).

---

### Task 12: Windsurf / Devin Desktop and JetBrains AI / Junie (P2) — IDE agents with closed or thin stores

**Files:**
- Per the shared steps, for `core/sources/windsurf/` (`index.ts`, `devin.ts`) and `core/sources/jetbrains-ai/` (`index.ts`, `chats.ts`).
- Modify: `core/viz/labels.ts`, where `TOOL_LABEL.windsurf` becomes `"Windsurf / Devin"`.

**Interfaces:**
- Produces:
  - `wsCascade` (`windsurf.cascade`, P2, beta, no `primary`);
  - `wsDevinCli` (`windsurf.devin-cli`, P2, beta, primary `{ detail: ["session", "prompt"] }`);
  - `jbChats` (`jetbrains-ai.chats`, P2, beta, primary `{ detail: ["session", "prompt"] }`);
  - `jbJunie` (`jetbrains-ai.junie`, P2, beta, no `primary`).
- Placeholders: `<codeium>`, `<devin data>`, `<JetBrains config>`, `<junie>`. Variables: `DEVIN_SESSIONS_DIR`, `JUNIE_HOME`.

**Windsurf / Devin Desktop.**
- **`windsurf.cascade`** covers `<home>/.codeium/windsurf/cascade/*.pb`. These files are encrypted by the app (see Sources), so the reader emits `present-undecodable` with `files` and `bytes`, and opens none of them (builder's call 5). It never lists or opens `implicit/`, `brain/` or `memories/`.
- **`windsurf.devin-cli`** covers `sessions.db` under one of:
  - `$DEVIN_SESSIONS_DIR`;
  - `<data>/devin/cli/`, which is XDG on darwin and linux;
  - on darwin, also `appSupport("devin")/cli/`;
  - on win32, `<appData>\devin\cli\`.

  It selects only:
  - **`sessions`:** `id, working_directory, model, created_at, last_activity_at, hidden`;
  - **`message_nodes`** (paged at `page: 200`): `session_id` plus `json_extract(chat_message, …)` of `$.role`, `$.content`, `$.tool_calls`, `$.metadata.created_at`, `$.metadata.generation_model`, `$.metadata.is_user_input`, `$.metadata.request_id` and the four `$.metadata.metrics` token fields.
- **Mapping (Devin CLI):**
  - hidden sessions are skipped `internal`;
  - `is_user_input` messages are prompts, with their text parsed in memory;
  - `tool_calls[].name` are calls, which stay `other` until FORMAT.md lists the CLI's tool names;
  - usage is counted once per `request_id`;
  - times below 1e10 are seconds.
- **Never (Windsurf / Devin):**
  - never opened: `~/.codeium/config.json`, every `mcp_config.json`, `<devin data>/credentials.toml`, `sso_tokens.toml`, `transcripts/` (exports of the same sessions), and the VS Code-style `state.vscdb` of `Windsurf` and `Devin`, which holds the auth keys;
  - never selected: `title` and `prompt_history`.
- **Sources:**
  - https://docs.devin.ai/desktop/devin-desktop-faq;
  - https://docs.devin.ai/cli/changelog/stable.md;
  - https://docs.devin.ai/federal/air-gapped/on-disk-formats.md;
  - https://github.com/getagentseal/codeburn/blob/main/docs/providers/devin.md;
  - https://github.com/vshulcz/deja-vu/issues/308, the third-party finding that cascade files are encrypted.

**JetBrains AI Assistant and Junie.**
- **`jetbrains-ai.chats`** reads every `<JetBrains config>/*/workspace/*.xml`. The config folder is `appSupport("JetBrains")` on darwin and win32, and `<config>/JetBrains` on linux.
  - Each file goes through `readTextSmall(file, 64 MiB)` (the ✎ XML constraint, pre-flight H8) and `xmlTokens`, and only the `component[name=ChatSessionStateTemp]` subtree is mapped.
  - **Sessions:** each `SerializedChat` is a session, with raw id `uid`, end `modifiedAt` (ms), and start the earliest `ChatStatisticInformation` `timestamp`, else `modifiedAt`. Its model is `chatModelId`.
  - **Prompts:** each `SerializedChatMessage` whose `author` is empty or `Unknown` is a prompt, with its text from `displayContent`, placed at the start plus 1 ms per message.
  - No tool, usage or cwd is recorded, and FORMAT.md says so.
  - **Never kept:** `displayTitle`, the title, `internalContent` and attachments.
  - **Never opened:** `c.kdbx`, `c.pwd`, `options/` and every non-`workspace` file.
- **`jetbrains-ai.junie`** lists `$JUNIE_HOME`, else `<home>/.junie`, at most two levels down, and counts the session folders that hold `events.jsonl`. It reports `present-undecodable`, and opens nothing.
  - It never descends into `trust/` or `models/`.
  - It never opens `config.json`, `settings.json`, `allowlist.json`, `sandbox.json` or `secure_credentials.json`.
- **Sources:**
  - https://www.jetbrains.com/help/idea/directories-used-by-the-ide-to-store-settings-caches-plugins-and-logs.html;
  - https://www.jetbrains.com/help/ai-assistant/ai-chat.html;
  - https://gitlab.com/metaworx/open-source/php-library/jetbrains/-/blob/master/src/ChatHistoryExtractor.php;
  - https://junie.jetbrains.com/docs/junie-cli.html;
  - https://junie.jetbrains.com/docs/environment-variables.html.

- [ ] **Steps 0–6:** per the shared steps. Specifics:
  - **Fixture:**
    - 3 cascade `.pb` files of random bytes;
    - a Devin `sessions.db` with a hidden session, 2 user inputs, 2 retries sharing one `request_id`, and `title` = `CANARY.project`;
    - a JetBrains `workspace/x.xml` with 2 chats, an attachment holding `CANARY.code` and a `displayTitle` holding `CANARY.project`;
    - a Junie folder with 2 sessions and `trust/authentication-key` holding `CANARY.secret`.
  - **Tests:**
    - **Cascade:** `present-undecodable`, `files: 3`, and the open observer records no `.pb` file.
    - **Devin:** the usage of the retried request is counted once, and the hidden session is skipped.
    - **JetBrains:** 2 sessions and their prompts; no attachment text and no title; a second XML nested 100 deep is skipped as `bad-record` and the first is still read.
    - **Junie:** `files: 2`, and nothing under `trust/` is opened or listed: the observer records no open and no `"list"` inside `trust/` (pre-flight H9).
    - **Labels:** `TOOL_LABEL.windsurf` is `Windsurf / Devin`.
  - **Drift cases:** Devin `chat_message` renamed → `table-unreadable:message_nodes`; JetBrains `SerializedChatMessage` renamed → drift and `zero-yield`. `windsurf.cascade` and `jetbrains-ai.junie` join `PRESENCE_ONLY` (pre-flight H1).

---
### Task 13: Aider (P2) and repo-scoped stores

**Files:**
- Create: `core/sources/aider/{index,chat,input}.ts`, `core/sources/aider/FORMAT.md`, `test/fixtures/aider.ts`, `test/core/sources/aider.test.ts`, `test/core/scan.repo-scoped.test.ts`
- Modify:
  - core: `core/sources/types.ts` (`locateIn`), `core/scan.ts` (the repo-scoped pass), `core/git/discover.ts` (exports `gitRootOf`: a move of the discovery walk, when Task 1 found it unexported);
  - `core/sources/{registry,placeholders}.ts`, and `core/env/env.ts` (`AIDER_CHAT_HISTORY_FILE`, `AIDER_INPUT_HISTORY_FILE`);
  - `test/core/sources/drift.test.ts`.

**Interfaces:**
```ts
// core/sources/types.ts — additive
export interface RepoDir { dir: string; home: string; wsl: boolean }
SourcePlugin.locateIn?: (env: Env, dirs: readonly RepoDir[]) => Candidate[];   // stores that live inside the folders sessions ran in
// core/git/discover.ts
export function gitRootOf(dir: string, maxUp?: number /* 20 */): string | undefined;   // nearest ancestor (or dir) holding .git as a dir or a file; no spawn
// core/scan.ts
ScanOptions.maxRepoDirs?: number;   // default 500
ScanOptions.repoStores?: boolean;   // default: repoSignals !== false; false skips the repo-scoped pass (pre-flight H5)
// core/sources/aider
export const aiderChat: SourcePlugin;    // aider.chat, P2, beta, windows ["detail"]
export const aiderInput: SourcePlugin;   // aider.input, P2, beta, windows ["lifetime"]
```

**Repo-scoped pass** (`core/scan.ts`):
- **When it runs:** after the plugin pool and before Plan 2's repo-signals after-pass. It is skipped when the scan was aborted, or when `repoStores` is false, which it is by default when `repoSignals === false` (builder's call 6, pre-flight H5).
- **Which folders:**
  - every raw cwd that `registerCwd` stored (insertion order) and that `isDir` accepts;
  - each one's `gitRootOf`;
  - deduplicated, and capped at `maxRepoDirs`. Over the cap, one `Warning{ code: "too-large", tool: "scan", source: "repo-dirs" }`.
- **Which home:** each `RepoDir` carries the home and the WSL flag of the job that first registered its cwd. The orchestrator keeps them beside `cwds`, in memory only.
- **The pass itself:**
  1. Every plugin with `locateIn` is located over those folders.
  2. Its candidates run in the same pool rules.
  3. They report coverage like any other plugin.
  4. A plugin whose `locate` and `locateIn` both find nothing gets one `absent` coverage.

**Aider.**
- **Locate:**
  - `locate`: `<home>/.aider.chat.history.md` and `<home>/.aider.input.history`, in every scanned home;
  - `locateIn`: the same two names in each `RepoDir`;
  - `$AIDER_CHAT_HISTORY_FILE` and `$AIDER_INPUT_HISTORY_FILE` of the scanning user, when they are absolute paths;
  - never anything else.
- **Never opened:** `.aider.conf.yml`, `.env`, `.aider.model.settings.yml`, `.aider.model.metadata.json`, the `.aider.tags.cache.*` folders, and `~/.aider/`, which holds `oauth-keys.env`.
- **Chat history,** read through `readTextLines(file, { maxBytes: 1_048_576 })`, one line at a time.
  - A longer line ends the file with `skipped["oversize"]`.
  - **Sessions.** A line `# aider chat started at YYYY-MM-DD HH:MM:SS` opens a session. Its time is read as local wall-clock time in the process zone.
    - The raw id is `<file path>#<line number>`, so its keyed hash is the session id.
    - `cwd` is the file's folder, and the window is `detail`.
  - **Prompts.** A run of consecutive `#### ` lines is one prompt. Its time is the session's start, plus 1 ms per prompt so that they keep their order.
  - **Lines starting `> `.** These are Aider's own output. Only these forms map:

    | Line | Maps to |
    |---|---|
    | `> Aider v<version>` | `version` |
    | `> Main model: <model> …` or `> Model: <model> …` | the session's model, through `safeModel` |
    | `> Applied edit to <path>` | an `edit` tool, `name: "edit"`, `editExt` from the path |
    | `> Running <command>` | a `shell` tool for a command the agent proposed and the person confirmed, through `classifyCommand`; Aider records no exit code |
    | `> Commit <7–40 hex> …` | a `commit` marker, `detail = ctx.hash(sha.slice(0, 7).toLowerCase())` (Plan 2's `shaKey` rule) |
    | `> Tokens: <n>[k] sent, <n>[k] received…` | usage with that session's model |

  - **Everything else,** meaning assistant prose, code, diffs, `Weak model:` lines and confirmation questions, is read and dropped.
  - **Prompts that are commands.** `/run` and `/test` prompts stay prompts, with intent `command`. They are not tool events: the person ran them, not the agent.
- **Input history,** read through `readTextLines`.
  - **Entries.** Each `# <YYYY-MM-DD HH:MM:SS[.ffffff]>` line opens an entry. The `+`-prefixed lines that follow, without the `+`, are its text.
  - **Prompts.** Every entry goes to `PromptLog.add` with the time parsed as local time. The window is `lifetime`, and there is no session id.
- **Primary kinds:** chat `{ detail: ["session", "prompt"] }`; input `{ lifetime: ["prompt"] }`.
- **Placeholders:** `<repo>`, meaning a folder your sessions ran in, goes in `PLACEHOLDER_WILDCARDS`; `<home>` exists already.
- **Describe** reads say: "in your home folder and in the folders your sessions ran in (found from the sessions, never by searching the disk); --no-repo-signals skips the repo folders".
- **Sources to re-check:**
  - https://aider.chat/docs/config/options.html (`--chat-history-file`, `--input-history-file`, and their defaults at the git root);
  - https://github.com/Aider-AI/aider/blob/main/aider/args.py;
  - https://github.com/Aider-AI/aider/blob/main/aider/io.py (`append_chat_history`, `add_to_input_history`, the `#### ` user prefix and the `> ` tool-output prefix);
  - https://github.com/Aider-AI/aider/blob/main/aider/coders/base_coder.py (the `Aider v`, `Main model:`, `Tokens:` and `Running` lines);
  - https://github.com/Aider-AI/aider/blob/main/aider/onboarding.py (`~/.aider/oauth-keys.env`);
  - https://github.com/prompt-toolkit/python-prompt-toolkit/blob/main/src/prompt_toolkit/history.py (the `# <time>` and `+line` format).
- **Before coding:** `test -e ~/.aider.chat.history.md` and `test -e ~/.aider.input.history` only. If either is present, `bun scripts/probe.ts <file> --lines`.

- [ ] **Step 1: Fixture** (`test/fixtures/aider.ts`). `makeRepo` builds a repo whose path holds `CANARY.project`. A Claude Code fixture session runs in a subfolder of it. The repo root holds:
  - a chat history with two sessions:
    - prompts: a 3-line `####` spec holding `CANARY.prompt`, `/run pytest`, and a correction;
    - Aider lines: `> Aider v0.86.1`, `> Main model: claude-sonnet-5 with diff edit format`, `> Applied edit to src/CANARY.py`, `> Running pytest -q`, `> Commit 1a2b3c4 feat: x`, `> Tokens: 2.3k sent, 512 received. Cost: $0.01 message, $0.02 session.`;
    - a fenced block holding `CANARY.code`;
  - an input history with 4 entries over two local days;
  - `.aider.conf.yml` holding `CANARY.secret`, and `~/.aider/oauth-keys.env` holding `CANARY.token`.

  A home-level `~/.aider.input.history` holds 2 entries.
- [ ] **Step 2: Write the failing tests.**
  - **Chat:**
    - 2 sessions with `cwd` = the repo root (its raw path only in `r.cwds`);
    - 3 human prompts in session 1, one of them a `command`;
    - one `edit` with `editExt: "py"`, and one shell call `{ category: "test", checks: ["test"] }` without `ok`;
    - one `commit` marker whose `detail` equals `ctx.hash("1a2b3c4")`;
    - one usage with `inTok: 2300` and `outTok: 512`;
    - `version` is `0.86.1`;
    - no `ToolEv` comes from `/run`.
  - **Input:** 6 lifetime prompts over the two files, and `DailyEv`s on the expected local days under `TZ=Pacific/Auckland`.
  - **Repo-scoped pass** (`scan.repo-scoped.test.ts`):
    - the repo's files are found only through `locateIn`;
    - with `repoSignals: false`, only the home-level file is read; with `repoSignals: false, repoStores: true`, the repo's files are read too (pre-flight H5);
    - a cwd that no longer exists is skipped;
    - 600 registered cwds with `maxRepoDirs: 500` → the warning;
    - `__observeOpens` records no `.aider.conf.yml`, nothing under `~/.aider/`, and no path outside `h.root`.
  - **Bounds:** a 3 MiB single line → `skipped.oversize`, and the scan finishes.
  - **Canaries:** `expectNoCanaries(events)`.
  - **Drift:** a chat whose `# aider chat started at` header carries a reshaped date → drift `started:shape`, and no session; for `aider.input`, an entry header with a reshaped time → drift `entry:shape` (pre-flight H1).
- [ ] **Step 3: Run** `bun test test/core/sources/aider.test.ts test/core/scan.repo-scoped.test.ts` → FAIL.
- [ ] **Step 4: Implement** `gitRootOf`, the pass, both plugins, the placeholder, and register them.
- [ ] **Step 5: Run** `bun test && bunx tsc --noEmit` → PASS. Plan 2's repo-signal suites pass unchanged.
- [ ] **Step 6: Commit** `feat(sources): aider chat and input history, read where sessions ran (beta)`.

---
### Task 14: Windows + WSL homes

**Files:**
- Modify:
  - core: `core/env/env.ts` (`listWslHomes`), `core/scan.ts` (WSL cwds);
  - app: `app/args.ts` (`--no-wsl`), `app/run.ts` (passes `wsl`), `app/explain.ts` (the WSL line), `app/copy.ts` (the help line).
- Test: `test/core/env/wsl.test.ts`, `test/core/scan.wsl.test.ts`, `test/core/wsl.e2e.test.ts` (win32 only); extend `test/app/{args,explain}.test.ts`.

**Interfaces:**
- Consumes: `wslDistroRoot`, `wslPath` and `HomeDirs.toHost` (Task 2).
```ts
// core/env/env.ts
export function listWslHomes(platform: Platform, lister?: (dir: string) => string[]): string[];
// app/args.ts
CliOptions.wsl: boolean;                                            // default true; --no-wsl → false
```

**Rules.**
- **`listWslHomes`.**
  - It lists `\\wsl.localhost\` first. When that gives no distro, it lists `\\wsl$\`.
  - It skips distros whose names start with `docker-desktop`, which hold no user homes.
  - It returns `<root><distro>\home\<user>` for each user folder, at most 16 homes in all.
  - A lister that throws gives `[]`.
- **WSL cwds** (`core/scan.ts`). For a candidate with `wsl: true`:
  - a cwd that starts with `/` registers as `wslPath(wslDistroRoot(cand.home), cwd)`. Its key and its `cwds` value both use that UNC path, so Task 13's `gitRootOf` and Aider reach WSL repositories. Repo signals there are best effort: git may refuse a repository on a UNC path as of dubious ownership, which counts as skipped, never silently, and `safe.directory=*` is never added (pre-flight H16).
  - Any other cwd, and any cwd from a non-WSL candidate, registers unchanged.
- **The CLI.** `run()` passes `wsl: o.wsl` to `scan`. Off win32, `env.wslHomes` is empty, so the flag changes nothing.
- **`--explain`.** On win32 it prints `WSL homes: <n> (scanned; --no-wsl skips them)`, or `WSL homes: none found`. It never prints a distro or user name.
- **Readers.** Every P0 CLI reader already iterates `homes`. Every new reader locates through `homeDirs`, `rootsIn` or `vscodeUserDirs` (Task 2), so WSL homes follow Linux conventions. This task adds only the end-to-end proof.

- [ ] **Step 1: Write the failing tests.**
  - `wsl.test.ts`:
    - **Listing:** a lister gives `["Ubuntu", "docker-desktop"]` for `\\wsl.localhost\` and `["dev"]` for each `home` folder → only the Ubuntu home.
    - **Fallback:** an empty `\\wsl.localhost\` and `["Debian"]` under `\\wsl$\` → a Debian home.
    - **Errors and caps:** a throwing lister → `[]`; 20 user folders → 16 homes.
  - `scan.wsl.test.ts`, on every OS, with a fake plugin whose candidate is `{ wsl: true, home: "\\\\wsl.localhost\\Ubuntu\\home\\dev" }`:
    - `registerCwd("/home/dev/p")` → `r.cwds.get(key)` is `\\wsl.localhost\Ubuntu\home\dev\p`;
    - `registerCwd("C:\\w")` from the same candidate is unchanged;
    - a non-WSL candidate's `/home/dev/p` is unchanged.
  - `wsl.e2e.test.ts`, `test.skipIf(process.platform !== "win32")`:
    - **Setup:** a win32 `fakeHome` whose `wslHomes` is one stand-in folder under `h.root`. That folder holds the Claude Code, Codex, Gemini CLI and OpenCode fixtures, plus `.gemini/oauth_creds.json` and `.local/share/opencode/auth.json` with `CANARY.secret`.
    - **`scan({ env, wsl: true })`:** each of those plugins has a coverage with records > 0 from the stand-in home, and the open observer never records the two credential files.
    - **`wsl: false`:** nothing is read there.
  - `args.test.ts`: `--no-wsl` → `wsl: false`, and the default is `true`.
  - `explain.test.ts`: a win32 env with two WSL homes prints `WSL homes: 2`. The output holds neither `Ubuntu` nor the user folder name.
- [ ] **Step 2: Run** `bun test test/core/env test/core/scan.wsl.test.ts test/app/args.test.ts test/app/explain.test.ts` → FAIL.
- [ ] **Step 3: Implement** the listing, the paths, the cwd rule and the flag.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS. Push and watch CI until windows-latest runs the e2e test green.
- [ ] **Step 5: Commit** `feat(core): WSL homes — \\wsl$ fallback, Linux conventions, UNC cwds; --no-wsl`.

---

### Task 15: Reader integration — registry order, never-opened, smoke, budgets

**Files:**
- Modify:
  - `core/sources/registry.ts`, to its final order: Plan 1's P0 entries unchanged, then P1 (gemini-cli, opencode, cline, roo-code, kilo-code), then P2 in `ToolId` order;
  - `test/core/never-opened.test.ts` and `test/core/integration.test.ts`. Task 2 already rewrote the latter's registry pin and wrapped `helpText`'s tool-id list (pre-flight H1);
  - `scripts/smoke-local.ts`.
- Create: `test/core/sources/p1p2.integration.test.ts`

**Interfaces:**
- Consumes: every plugin of Tasks 4–13, and every fixture builder of Tasks 4–13.
- Produces: `registry`, final for this plan.

- [ ] **Step 1: Write the failing tests.**
  - `p1p2.integration.test.ts`: one `fakeHome` with every Plan 1 and Plan 5a builder (Aider's repo inside a `makeRepo` repo that a Claude Code fixture session ran in) → `scan()`, then `analyze()`, then `exportPayload()`. Expected:
    - **Registry:** every plugin's tier is P0, P1 or P2, every P2 plugin is `beta: true`, and plugin ids are unique.
    - **Coverage:** every registry plugin reports coverage; every P2 coverage has `beta: true`; each new tool has session or prompt events.
    - **Warnings and temp:** there is a `beta` warning for each P2 plugin with events, and `tempClean` holds.
    - **Canaries:** `expectNoCanaries(all events, { allow: ["mcp"] })`, and `findCanaries(export.json)` is `[]`.
    - **Export:** `export.value.coverage` lists every new tool that has data.
    - **Time:** the whole run takes at most 10 s on CI.
  - `never-opened.test.ts`:
    - It plants every credential neighbour that Tasks 4–13 name, each holding `CANARY.secret`, at the exact path its task gives.
    - No observed open equals a planted path. Plan 2's six name rules stay as they are, and core/io's run-time refusal list covers the unambiguous new credential names (pre-flight H2).
    - Every new plugin that decodes its store has at least one observed open, while `windsurf.cascade` and `jetbrains-ai.junie`, which only count, have none.
  - `helpText(registry tools)`: every line is at most 100 columns, and every tool id appears.
- [ ] **Step 2: Run** → FAIL until the registry is final.
- [ ] **Step 3: Implement.**
  - Finalize the registry.
  - The smoke prints, per new plugin, the same `key=value` lines as for P0. It stays inside Plan 2's pinned grammar.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Local acceptance (readers).**
  - `bun scripts/smoke-local.ts` against the real HOME, outside the sandbox if it blocks reads, exits 0.
  - Elapsed is at most 60 s and peak RSS at most 1 GiB, with every plugin registered.
  - For each new tool, the task report records `present`/`absent`, its status and whether it is beta — pass/fail and counts only, and never in the repo or the PR.
- [ ] **Step 6: Commit** `feat(core): register the P1 and P2 readers; never-opened, integration and budgets cover them`.

---

### Task 16: History store — `--keep-history` and `--purge`

**Files:**
- Create: `app/history/schema.ts`, `app/history/store.ts`, `test/app/history.store.test.ts`
- Modify:
  - `app/args.ts`: `--keep-history`, and `--purge`, which runs on its own;
  - `app/run.ts`: appends after a successful report write;
  - `app/main.ts`: the purge command;
  - `app/copy.ts`: help lines;
  - `app/explain.ts`: the "Writes" lines.

**Interfaces:**
```ts
// app/history/schema.ts
export const HISTORY_SCHEMA = "aipr-history/1";
export interface HistoryScope { tools: "all" | ToolId[] /* sorted */; since: string | null /* --since as YYYY-MM-DD */; repoSignals: boolean; wsl: boolean }
export interface HistoryRecord { schema: typeof HISTORY_SCHEMA; day: string /* YYYY-MM-DD in a.meta.timeZone */; core: string; reference: "v0"; scope: HistoryScope;
  overall: { status: Overall["status"]; score: number | null; interval: [number, number] | null; band: Band; coverage: string };
  dimensions: Array<{ id: DimensionId; status: DimensionResult["status"]; score: number | null; interval: [number, number] | null; confidence: Confidence | null; n: number }>;
  exposure: { activeWeeksDetail: number | null; activeWeeksLifetime: number | null; tools: number } }
export const HISTORY1: FieldSpec;   // declares exactly HistoryRecord
export function historyRecord(exported: ExportResult, o: { day: string; scope: HistoryScope }): HistoryRecord;
// app/history/store.ts
export class StoreLinkError extends Error {}
export interface HistoryFile { records: HistoryRecord[]; skipped: { parse: number; schema: number; newer: number } }
export function storeDir(env: Env): string;                              // <home>/.ai-practice
export async function readHistory(env: Env): Promise<HistoryFile | null>; // null when there is no file; StoreLinkError for a link (pre-flight H7)
export function appendHistory(env: Env, rec: HistoryRecord): number;     // returns the number of records now in the file
export function purgeStore(env: Env): { removed: boolean; historyRuns: number; reportFiles: number };
// app/args.ts
CliOptions.keepHistory: boolean;  Parsed |= { kind: "purge" };
```

**Rules.**
- **Records.**
  - Every field is read from `exported.value`, which is Plan 2's allowlisted payload. Nothing comes from `Analysis` directly, and nothing from `raw`.
  - `tools` in `exposure` is the length of `exposure.rotation.ever`.
  - The record passes `sanitize(rec, HISTORY1)` before it is written.
- **Append.**
  1. `lstat` the folder and then the file. A symlink at either throws `StoreLinkError`.
  2. Create the folder with mode 0700, or `chmod` it to 0700 when its mode is wider (POSIX).
  3. Open the file `O_WRONLY | O_APPEND | O_CREAT` with mode 0600, then `chmod` it to 0600.
  4. Write `canonicalJson(record) + "\n"` in one call.
- **Read.**
  - `lstat` the folder and then the file first. A symlink at either throws `StoreLinkError` (pre-flight H7).
  - Lines stream through `readJsonl`.
  - A parse failure counts in `parse`. A line with `schema` `aipr-history/<n>` where n > 1 counts in `newer`. Anything else that `sanitize` changes counts in `schema`.
  - Only the last 2,000 records are kept.
- **Purge.**
  - A missing folder gives `removed: false`. A symlinked folder throws `StoreLinkError`.
  - Otherwise it counts the history records and the files under `reports/`, then runs `rmSync(dir, { recursive: true })`. That unlinks any link inside and never follows it.
- **CLI.**
  - **`--keep-history`:** after the report is written, stdout prints `History     <~ path> (<n> runs)`.
  - **`--purge`** with any flag other than itself → exit 2 with `error: --purge runs on its own`.
  - **`--purge` alone** prints one of:
    - `Removed ~/.ai-practice (history: <h> runs, reports: <r> files). Reports written elsewhere with --out are not touched.`
    - `Nothing to remove: ~/.ai-practice does not exist.`

    It exits 0.
  - **A `StoreLinkError`** prints `error: <~ path> is a link; nothing was changed` and exits 1.
  - **`--explain`** adds the lines `With --keep-history: appends to ~/.ai-practice/history.jsonl; --purge deletes ~/.ai-practice` and `Reads ~/.ai-practice/history.jsonl when it exists (month over month)` (pre-flight H7).

- [ ] **Step 1: Write the failing tests** in `history.store.test.ts`.
  - **Records:**
    - `historyRecord` from the intermediate persona's export has exactly the schema's keys;
    - its JSON has no 13-digit number and no `T\d\d:`;
    - from `personaScan("expert", { canaries: true })`, `findCanaries(canonicalJson(rec))` is `[]`;
    - an extra property added to `exported.value.dimensions[0]` does not reach the record.
  - **Append:**
    - two appends give 2 lines, and `appendHistory` returns 2;
    - POSIX: folder 0700, file 0600; a pre-existing 0644 file and a 0755 folder are 0600 and 0700 after an append;
    - a symlinked file, or a symlinked `~/.ai-practice`, throws `StoreLinkError`, and the link target is byte-identical afterwards.
  - **Read:** with one corrupt line and one `aipr-history/2` line → `skipped.parse === 1` and `skipped.newer === 1`; with no file → `null`; a symlinked file or a symlinked `~/.ai-practice` → `StoreLinkError` (pre-flight H7).
  - **Purge:**
    - it removes a folder that holds history, reports and `coach/`;
    - a report written with `--out` outside the folder survives;
    - a symlinked folder throws;
    - a missing folder gives `removed: false`.
  - **CLI,** through `main` on a `fakeHome` with every builder:
    - `--no-open --keep-history` → 1 history line and the stdout line; a second run → 2 lines;
    - with `--anonymize` as well, the history bytes contain no canary;
    - `--purge --json` → exit 2;
    - `--purge` → exit 0, and the folder is gone.
- [ ] **Step 2: Run** `bun test test/app/history.store.test.ts test/app/args.test.ts` → FAIL.
- [ ] **Step 3: Implement** the schema, the store and the flags. Plan 3's "not available in this version" errors for `--keep-history` and `--purge` go.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(app): opt-in history of allowlisted aggregates; --purge deletes ~/.ai-practice`.

---

### Task 17: Month over month in the report

**Files:**
- Create: `app/history/compare.ts`, `test/app/history.compare.test.ts`
- Modify:
  - report: `app/report/model.ts` (`ReportInput.history`, `ReportModel.monthOverMonth`), `app/report/sections/you.ts`, `app/report/css.ts`;
  - `app/run.ts`: reads history before it builds the model;
  - `app/copy.ts`;
  - tests: `test/app/{model,render}.test.ts`.

**Interfaces:**
```ts
export type Change = "up" | "down" | "same" | "n/a";
export interface Scored { score: number | null; interval: [number, number] | null }
export interface MonthOverMonth { status: "ok" | "no-history" | "no-earlier-month" | "other-scope" | "unavailable" /* a linked store (pre-flight H7) */; nowMonth: string; thenMonth?: string /* YYYY-MM */; runs: number;
  overall?: { then: Scored; now: Scored; change: Change }; dims: Array<{ id: DimensionId; then: Scored; now: Scored; change: Change }> }
export function changeOf(then: Scored, now: Scored): Change;
export function compareRuns(current: HistoryRecord, history: HistoryFile | null): MonthOverMonth;
ReportInput.history?: MonthOverMonth;         // absent → Plan 3's output, byte for byte
ReportModel.monthOverMonth: MonthOverMonth | null;
```

**Rules.**
- **`changeOf`** compares the two intervals:
  - `up` when `now.lo > then.hi`;
  - `down` when `now.hi < then.lo`;
  - `same` when both intervals exist and overlap (touching counts as overlap);
  - otherwise `n/a`, which covers any missing score or interval.
- **`compareRuns`.**
  - `current` is the record this run would append. `run()` builds it whether or not `--keep-history` is given.
  - The candidates are the records with a deep-equal `scope` and the same `reference`.
  - "Then" is the latest candidate whose month (`day.slice(0, 7)`) is earlier than `current`'s, by `day` and then by file order.
  - **Status:**
    - `no-history`: there is no file, or no records;
    - `other-scope`: no candidate, but records exist;
    - `no-earlier-month`: candidates, but none from an earlier month;
    - `ok`: otherwise.
  - `runs` counts the candidates.
- **A linked store.** When `readHistory` throws `StoreLinkError`, run() uses `status: "unavailable"`, prints one stderr line `note: <~ path> is a link; month over month is not shown`, and still writes the report (pre-flight H7).
- **Render.** In YOU, after the ledger and before the then-and-now line, under the heading "This month vs last" in mono 12 caps:
  - **Table:** rows for the overall and the 7 dimensions, with the columns dimension, `<thenMonth>`, `<nowMonth>` and change.
  - **Change mark:** an icon plus text — up `m-pass`, down `m-flag`, same `m-axis`, n/a `m-hatch`.
  - **Caption:** "Changed only when the intervals separate."
  - **The other states** are one line each:
    - no-history: "Run with --keep-history to compare months."
    - no-earlier-month: "Your history starts this month; the comparison appears next month."
    - other-scope: "Your history was kept with other options (--tools, --since, repo signals or WSL); months are compared only between runs with the same options."
    - unavailable: "Month over month is not shown: ~/.ai-practice is a link." (pre-flight H7)
- **Determinism.** `nowMonth` comes from `current.day`, so the model is the same under any process time zone.

- [ ] **Step 1: Write the failing tests.**
  - **`changeOf`:**
    - `[60, 70]` → `[72, 80]` gives `up`;
    - `[60, 70]` → `[65, 75]` gives `same`;
    - `[60, 70]` → `[50, 59]` gives `down`;
    - `[60, 70]` → `[70, 80]` gives `same`;
    - a null interval gives `n/a`.
  - **`compareRuns`:**
    - it picks the latest earlier-month record over an older one and over one from the same month;
    - a different `scope.tools` → `other-scope`;
    - only `newer`-schema lines → `no-history`;
    - `runs` is counted.
  - **Model and render:**
    - a fixture with records for 2026-09 and 2026-10 and a current run in 2026-11 renders the table with month labels `2026-10` and `2026-11`, and 8 rows;
    - `auditHtml` stays clean, and `uncoveredChars` over the new copy is `[]`;
    - every fixture without `history` gives Plan 3's snapshot unchanged apart from Method (pre-flight H1);
    - the model is deep-equal under `TZ=Pacific/Auckland` and under `UTC`;
    - a linked `~/.ai-practice` → `unavailable`, the stderr note, and the report still written (pre-flight H7).
- [ ] **Step 2: Run** `bun test test/app/history.compare.test.ts test/app/model.test.ts test/app/render.test.ts` → FAIL.
- [ ] **Step 3: Implement** the comparison, the model field and the section.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(app): this month vs last — changed only when intervals separate`.

---
### Task 18: Coach digest — episode skeletons and `coach/1`

**Files:**
- Create: `core/exhibits/skeletons.ts`, `app/coach/digest.ts`, `test/core/exhibits/skeletons.test.ts`, `test/app/coach.digest.test.ts`
- Modify:
  - `core/analysis/walk.ts`: export the episode split as `episodeSpans`. This is a move, not a copy, and `buildSessionStats` output is unchanged;
  - `core/index.ts`: exports `episodeSkeletons` and its types.

**Interfaces:**
```ts
// core/analysis/walk.ts — Plan 2's walk rule 7, exported unchanged in meaning
export interface EpisodeSpan { rowId: string; start: number; end: number; firstTurn: number /* index into the row's typed turns */; fresh: boolean }
export function episodeSpans(row: SessionRow, t: SessionTable, store: EventStore): EpisodeSpan[];
// core/exhibits/skeletons.ts
export type StepToken = string;   // the grammar below; nothing else
export interface EpisodeSkeleton { id: string /* E1 … */; tool: ToolId; actions: number; turns: number; children: number; steps: StepToken[]; more: number }
export const SKELETON_MAX = 10;
export const SKELETON_MAX_STEPS = 60;
export const STEP_TOKEN: RegExp;  // the grammar, anchored; COACH1 reuses it
export function episodeSkeletons(raw: ScanResult, a: Analysis, o?: { exclude?: Exclusions; max?: number }): EpisodeSkeleton[];
// app/coach/digest.ts
export interface CoachDigest { schema: "coach/1"; core: string; reference: "v0"; overall: unknown; dimensions: unknown[]; signals: unknown;
  coverage: Array<{ tool: ToolId; window: Window; status: string; beta: boolean }>; personas: string[]; stack: unknown; episodes: EpisodeSkeleton[] }
export const COACH1: FieldSpec;
export interface DigestBytes { digest: CoachDigest; json: string /* canonicalJson */; bytes: number; sha256: string /* hex */ }
export function buildDigest(exported: ExportResult, episodes: readonly EpisodeSkeleton[]): DigestBytes;
export function digestIds(d: CoachDigest): string[];   // dimension ids, then component ids, then E1…En: what an answer may cite, in that order
export function isTextFree(d: CoachDigest): boolean;  // every string is a COACH1 enum value or matches a COACH1 pattern, and none is longer than 40 characters
```

**Step tokens** (`STEP_TOKEN`):
- **Typed turns:** `p:<intent>`, one per typed turn, for prompts where `t.isHuman` holds, with Plan 1's `Intent` values.
- **Actions** (`isAction`):
  - `t:<category>`;
  - a check action becomes `t:<first check>:ok` or `t:<first check>:fail`, from its `ok`;
  - any other action whose `ok` is false becomes `t:<category>:fail`.
- **Children:** `d:<childType>` for a delegated child, or `d:workflow`, placed at the child's start.
- **Markers:** `m:interrupt`, `m:denial`, `m:clear`, `m:compact-auto`, `m:compact-manual`, `m:plan-enter` or `m:plan-exit`, except markers with `proxyTs`.
- **Runs:** a run of an identical token collapses to `<token>*<n>`, for n of 2 or more.
- **Cap:** at most `SKELETON_MAX_STEPS` tokens. The rest count in `more`.

**Episode selection.**
1. Take the episodes of `detailTop` rows, from `episodeSpans`, with Plan 3's exclusions applied by the caller through `exclude`. The coach's own sessions never reach the store (builder's call 11, pre-flight H13).
2. Keep those with at least 3 actions, the children's included.
3. Sort by (actions ascending, row id, start), giving k episodes.
4. Take the distinct indexes `round(i·(k − 1)/(max − 1))` for i = 0 … max − 1. Short and long episodes both appear, with no randomness.
5. Number the picked episodes `E1` … in that order.

**`COACH1`.**
- It declares:
  - `overall`, `dimensions` (with their components), `personas` and `stack.{languages, toolchains}` exactly as `AIPROF2` declares them;
  - `signals` as `{ value, n, window }` per metric, and `coverage` as `{ tool, window, status, beta }`, both without months;
  - `episodes`, as `{ id: /^E\d{1,2}$/, tool: enum ToolId, actions, turns, children, more: integers, steps: array(60) of STEP_TOKEN }`.
- `buildDigest` copies these from `exported.value` and passes the whole through `sanitize(…, COACH1)`.
- `projects`, `identity`, `forensics`, `config`, `exposure`, `exclusions` and every other payload key are never copied.

- [ ] **Step 1: Write the failing tests.**
  - `skeletons.test.ts`, on a hand-built `scanResultOf` store:
    - **Tokens:** an episode of `spec` prompt → Read ×3 → Edit → Bash `bun test` (fail) → Edit → Bash `bun test` (ok) → `correction` prompt gives `["p:spec", "t:read*3", "t:edit", "t:test:fail", "t:edit", "t:test:ok", "p:correction"]`.
    - **Children:** an Explore child gives `d:explore`.
    - **Cap:** 70 distinct alternating actions give 60 steps and `more: 10`.
    - **Selection:**
      - 15 qualifying episodes give 10, including the shortest and the longest;
      - an episode with 2 actions is never picked;
      - two runs are deep-equal.
    - **Contents:** `JSON.stringify` holds no 13-digit number, and every step matches `STEP_TOKEN`.
    - **Canaries:** on `personaScan("expert", { canaries: true })`, `expectNoCanaries(skeletons)` passes.
  - `coach.digest.test.ts`:
    - **Nothing dropped:** `buildDigest` on the intermediate persona's export → `sanitize(d.digest, COACH1)` deep-equals `d.digest`.
    - **Bytes:** `d.json === canonicalJson(d.digest)`, `d.sha256` is the hex SHA-256 of `d.json`'s UTF-8 bytes, and `d.bytes` is at most 32,768.
    - **Text-free:** `isTextFree(d.digest)` holds, and it is false for a copy with one free-text string added anywhere.
    - **Left out:** no `P-` label, and no `identity`, `forensics`, `config` or `projects` key.
    - **Canaries:** the canaries persona gives `findCanaries(d.json)` = `[]`.
    - **Ids:** `digestIds` lists the 7 dimension ids, then the 22 component ids, then `E1` to `En`.
  - Plan 2's walk suite passes unchanged.
- [ ] **Step 2: Run** `bun test test/core/exhibits/skeletons.test.ts test/app/coach.digest.test.ts test/core/analysis` → FAIL.
- [ ] **Step 3: Implement** the export of `episodeSpans`, the skeletons and the digest.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(coach): a text-free coach/1 digest — scores, components and enum-only episode skeletons`.

---
### Task 19: Coach runner — CLIs, spawning, answers, majority

**Files:**
- Create: `app/coach/{agents,spawn,prompt,answer,merge,index}.ts`, `test/fixtures/fake-agent.ts`, `test/kit/agents.ts` (`installFakeAgents`), `test/app/coach.runner.test.ts`, `test/app/spawn-static.test.ts`
- Modify: `package.json` exports gain `"./agents": "./app/coach/index.ts"`, so other tools can reuse the runner. A does not import it: Plan 6 Task 7 pins A's argv and env table against `AGENTS`. The PR notes this change to spec §9's export list (pre-flight H4).

**Interfaces:**
```ts
// app/coach/agents.ts
export type CoachCli = "claude" | "codex" | "gemini";
export const COACH_CLIS: readonly CoachCli[];   // ["claude", "codex", "gemini"]: --coach without a value considers them in this order
export interface AgentSpec { cli: CoachCli; files(schema: Readonly<Record<string, unknown>>): Readonly<Record<string, string>>;   // files written into the run's folder first (schema, policy) (pre-flight H4)
  env: Readonly<Record<string, string>>; argv(o: { shim: boolean; schemaJson: string }): readonly string[];   // schemaJson: the run's schema as compact JSON (pre-flight H4)
  parse(stdout: string): { ok: true; answer: unknown; models: string[] } | { ok: false; reason: "not-json" | "no-answer" | "cli-error" } }
export const AGENTS: Readonly<Record<CoachCli, AgentSpec>>;
export function findCli(cli: CoachCli, which?: (name: string) => string | null /* Bun.which */): string | null;
export function detectClis(which?: (name: string) => string | null): CoachCli[];
// app/coach/spawn.ts
export interface SpawnResult { code: number | null; stdout: string; timedOut: boolean; truncated: boolean }
export class UnsafeShimError extends Error {}
export function runCli(file: string, argv: readonly string[], o: { stdin: Uint8Array; cwd: string; env: Readonly<Record<string, string>>;
  timeoutMs: number; maxBytes: number; signal?: AbortSignal }): Promise<SpawnResult>;
// app/coach/prompt.ts
export const COACH_INSTRUCTIONS: string;
export function coachStdin(d: DigestBytes): { bytes: Uint8Array; text: string; sha256: string };   // COACH_INSTRUCTIONS + schema + "\n\n" + the digest as 2-space JSON in canonical key order + "\n"
// app/coach/answer.ts
export interface CoachItem { text: string; evidenceRefs: string[] }
export interface CoachUpgrade { title: string; evidenceRefs: string[]; steps: string[] }
export interface CoachAnswer { observations: CoachItem[]; upgrades: CoachUpgrade[]; cautions: CoachItem[] }
export const ANSWER_SCHEMA: Readonly<Record<string, unknown>>;
export function validateAnswer(v: unknown, ids: ReadonlySet<string>): CoachAnswer | null;
// app/coach/merge.ts
export function mergeAnswers(answers: readonly CoachAnswer[], idOrder: readonly string[]): CoachAnswer;
// app/coach/index.ts (re-exports the above, plus:)
export type CoachFail = "timeout" | "exit" | "invalid" | "too-few" | "unsafe-shim";
export type CoachResult = { status: "ok"; models: string[]; validRuns: number; runs: number; notes: CoachAnswer } | { status: "failed"; reason: CoachFail; runs: number };
export async function runAgent<T>(o: { cli: CoachCli; file: string; stdin: Uint8Array; cwd: string; schema: Readonly<Record<string, unknown>>; validate: (v: unknown) => T | null;
  timeoutMs?: number /* 180_000 */; maxBytes?: number /* 1_048_576 */; spawn?: typeof runCli; signal?: AbortSignal }): Promise<{ ok: true; value: T; models: string[] } | { ok: false; reason: CoachFail }>;
  // one run; runCoach is `runs` runAgent calls with ANSWER_SCHEMA and validateAnswer, then mergeAnswers (pre-flight H4)
export async function runCoach(o: { cli: CoachCli; file: string; stdin: Uint8Array; ids: readonly string[]; cwd: string; runs?: number /* 3 */;
  timeoutMs?: number /* 180_000 */; maxBytes?: number /* 1_048_576 */; spawn?: typeof runCli; onRun?: (i: number) => void; signal?: AbortSignal }): Promise<CoachResult>;
```

**The three CLIs.** These are pinned here; re-check them against the sources below before coding.

| CLI | argv (prompt and digest on stdin) | Answer and model |
|---|---|---|
| claude | `-p "Follow the instructions on standard input." --output-format json --tools "" --disallowedTools=mcp__* --strict-mcp-config --disable-slash-commands --permission-mode dontAsk --max-turns 3 --no-session-persistence`, plus `--json-schema <schemaJson>` (the coach's is `ANSWER_SCHEMA`, pre-flight H4) unless `shim` | Read `structured_output` when `subtype === "success"` and `!is_error`, else parse `result`. Models are the `modelUsage` keys, by output tokens, descending. |
| codex | `exec --json --output-schema answer.schema.json --sandbox read-only --skip-git-repo-check --ephemeral --color never -c web_search=disabled -c features.shell_tool=false -c features.view_image=false -c features.apps=false -c features.multi_agent=false -c features.hooks=false -c history.persistence=none -` | Read the last `item.completed` whose `item.type` is `agent_message`, and its `item.text`, parsed as JSON. `turn.failed` or `error` events give `cli-error`. No event carries a model, so `models` is `[]`. |
| gemini | `-p "Follow the instructions on standard input." -o json --approval-mode default --policy deny-all.toml -e none --allowed-mcp-server-names none --skip-trust` | Parse `response` as JSON; `error` gives `cli-error`. Models are the `stats.models` keys. |

- **Environment.** `claude.env` is `{ ENABLE_CLAUDEAI_MCP_SERVERS: "false", CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1", CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1", CLAUDE_CODE_SKIP_PROMPT_HISTORY: "1" }`. Every CLI also gets `NO_COLOR=1`, on top of the inherited environment, which it needs for its own login.
- **Files** written into the coach folder before a run, mode 0600:
  - for codex, `answer.schema.json`, which holds the run's schema (`ANSWER_SCHEMA` for the coach, pre-flight H4);
  - for gemini, `deny-all.toml`, which holds `[[rule]]`, `toolName = "*"`, `decision = "deny"` and `priority = 999`, on four lines.
- **Persistence.** Claude's `--no-session-persistence` and Codex's `--ephemeral` stop them keeping a session. Gemini records headless runs anyway. Builder's call 11 keeps all of them out of the analysis.
- **Answers.** Before parsing, a reply wrapped in a code fence is unwrapped.
- **Sources to re-check:**
  - https://code.claude.com/docs/en/cli-reference, https://code.claude.com/docs/en/headless, https://code.claude.com/docs/en/agent-sdk/structured-outputs, https://code.claude.com/docs/en/env-vars;
  - https://learn.chatgpt.com/docs/developer-commands?surface=cli, https://learn.chatgpt.com/docs/non-interactive-mode, https://learn.chatgpt.com/docs/config-file/config-reference, and `codex-rs/exec/src/{cli.rs,exec_events.rs}` in openai/codex;
  - https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md, https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/cli-reference.md, https://geminicli.com/docs/reference/policy-engine.
- **Gemini sign-in.** Gemini CLI has served only API-key and Code Assist Standard/Enterprise sign-ins since 2026-06-18 (https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/). An exit without JSON is therefore reported as "exited with code N; signed in with an API key?".

**Rules.**
- **`findCli`** is `Bun.which`, and it spawns nothing.
- **`runCli`.**
  - It runs `Bun.spawn([file, ...argv], { cwd, stdin: <bytes>, stdout: "pipe", stderr: "ignore", env })`. stderr is never captured.
  - It kills the process at `timeoutMs` (`timedOut`) or on abort. Once stdout passes `maxBytes`, it cuts the output there, kills the process and sets `truncated`.
  - **win32 shims:** a `.cmd` or `.bat` file runs as `cmd.exe /d /s /c "<file>" <args>`, with each argument double-quoted, and only when the file path and every argument match `/^[A-Za-z0-9 ._:\\\/()=*-]*$/`. Otherwise it throws `UnsafeShimError`, which becomes `unsafe-shim`.
  - `shim` is true exactly for those files, so claude then runs without `--json-schema`: its schema still travels on stdin.
- **Argv.** For every CLI, `argv({ shim: true })` matches that pattern token by token. That is why the schema and the policy are files with relative names, and why the run's cwd is the coach folder.
- **`COACH_INSTRUCTIONS`** is fixed copy with a snapshot test. It says, in this order:
  - the role: a practice coach;
  - "use only the digest; do not use tools";
  - cite `evidenceRefs` only from the digest's ids: dimension ids, component ids and `E1`…;
  - at most 5 observations, 3 upgrades and 3 cautions;
  - each upgrade has 1–5 concrete steps;
  - "answer with JSON only, matching this schema:", followed by `ANSWER_SCHEMA`.
- **`ANSWER_SCHEMA`.** Draft-07, made only of `type`, `properties`, `required`, `items` and `additionalProperties: false`, with every property required. That fits both Claude's draft-07 rule and OpenAI's strict mode.
- **`validateAnswer`** works field by field:
  - **Shape:** the object must have exactly the three arrays, else `null`.
  - **Text:** control characters are dropped, whitespace is collapsed, and `text` is cut to 280 characters with "…". `title` is cut to 120, and each step to 200.
  - **Steps:** 1–6 per upgrade; extra steps are dropped.
  - **Refs:** at most 6, each kept only when it is in `ids`. An item left without a ref is dropped.
  - **Caps:** at most 8, 5 and 5 items are kept; the rest are dropped.
- **`mergeAnswers`.**
  - An item's anchor is its reference that comes first in `idOrder`.
  - Items of one kind and one anchor form a group. A group is kept when items from at least 2 answers are in it.
  - The group's item is the one from the earliest answer.
  - Groups are ordered by votes descending, then by anchor order.
  - Then the caps of 5 observations, 3 upgrades and 3 cautions apply.
- **`runCoach`.**
  - It `lstat`s `o.cwd` and its parent folder, refusing a link with `StoreLinkError` as in Task 16 (pre-flight H7). Then it writes the CLI's files and runs `runs` times, one run after another.
  - A run counts as valid when it exited with code 0 and its stdout parsed and validated.
  - With at least 2 valid runs, the result is `ok` with the merged notes and the union of the models through `safeModel`.
  - **Failures:**
    - `too-few`: some runs were valid, but fewer than 2;
    - otherwise the most common failure among `timeout`, `exit` and `invalid`, with ties going in that order;
    - `unsafe-shim` is final at once.
  - Stdout lives only until it is parsed.

**`test/fixtures/fake-agent.ts`** is a Bun script, and `installFakeAgents(bin)` writes shims for it named `claude`, `codex` and `gemini`: `#!/bin/sh` + `exec <bun> <script> "$@"` on POSIX, and `.cmd` files on win32.
- It appends `{ cli, argv, stdinSha256, stdin }` to `$FAKE_AGENT_LOG`, and prints its CLI's envelope with a canned answer that cites `ver.vae` and `E1` and holds `FAKE_COACH_NOTE_7f3a`.
- **Modes** (`FAKE_AGENT_MODE`):
  - `ok`;
  - `alt`: the same anchors, other wording;
  - `bad-json`;
  - `exit1`: writes `CANARY.email` to stderr and exits 1;
  - `hang`;
  - `huge`: 2 MiB of output;
  - `wrong-refs`: cites ids that are not in the digest;
  - `cycle`: modes taken in turn from a list.

- [ ] **Step 1: Write the failing tests.**
  - **Argv:**
    - `AGENTS.<cli>.argv({ shim: false, schemaJson })` equals the pinned arrays, with `schemaJson` in claude's `--json-schema` slot (pre-flight H4);
    - every token of `argv({ shim: true })` matches the shim pattern;
    - claude with `shim: true` has no `--json-schema`.
  - **Parse,** one envelope fixture per CLI:
    - claude with `structured_output` → the answer, and its models in order;
    - claude with a fenced `result` → parsed;
    - claude with `is_error: true` → `cli-error`;
    - the codex JSONL with two agent messages → the last one, and with `turn.failed` → `cli-error`;
    - gemini's `response` → the answer and `stats.models` keys;
    - non-JSON → `not-json`.
  - **`validateAnswer`:**
    - unknown refs are dropped, and an item left without refs is dropped;
    - control characters are removed and long text is cut;
    - a missing array → `null`;
    - 20 observations → 8.
  - **`mergeAnswers`:**
    - three answers, two of which share an upgrade anchored at `ver.vae` → that upgrade is kept, with the earliest answer's wording;
    - a single-vote observation is dropped;
    - two runs of the merge are deep-equal.
  - **`runCoach`, with an injected spawn:**
    - ok ×3 → `ok`, 3 valid runs;
    - ok, bad-json, ok → `ok`, 2 valid runs;
    - ok, exit, hang → `failed` `too-few`;
    - hang ×3 → `timeout`;
    - huge → `invalid`.
  - **`runCli`, with the real fake agent:**
    - POSIX: with `timeoutMs: 300`, a hanging agent is killed and resolves within 1.5 s;
    - stdin arrives byte-exact, checked through the logged SHA-256;
    - the agent's stderr (`CANARY.email`) is nowhere in the result;
    - win32: the `.cmd` shim runs, and a shim path with `&` throws `UnsafeShimError`.
  - **`spawn-static.test.ts`:** in `app/**/*.ts`, `Bun.spawn`, `spawnSync` and `child_process` occur only in `app/open.ts` and `app/coach/spawn.ts`.
  - **Exports:** `import { runCoach, runAgent, AGENTS } from "ai-practice-report/agents"` compiles and resolves, and `runAgent` with another schema and validator returns that validator's value (pre-flight H4).
  - **Links:** a symlinked coach folder → `StoreLinkError`, and nothing is written through it (pre-flight H7).
- [ ] **Step 2: Run** `bun test test/app/coach.runner.test.ts test/app/spawn-static.test.ts` → FAIL.
- [ ] **Step 3: Implement** the six modules, the fake agent and its installer.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS on all three OSes in CI.
- [ ] **Step 5: Commit** `feat(coach): run the person's own claude, codex or gemini three times on stdin, validate, merge by majority`.

---
### Task 20: Coach in the CLI and the report

**Files:**
- Create: `app/report/sections/coach.ts`, `test/app/coach.cli.test.ts`
- Modify:
  - CLI: `app/args.ts` (`--coach[=CLI]`, `--coach-confirm HASH`), `app/run.ts`, `app/cli.ts` (the real `confirm`);
  - report: `app/report/model.ts` (`ReportInput.coach`, `ReportModel.coach`), `app/report/render.ts` (chapter order, rail), `app/report/css.ts`;
  - copy: `app/copy.ts` (privacy sentences 7 and 8, the amended sentences 2 and 4 (pre-flight H12), help lines, coach copy), `app/explain.ts`;
  - core: `core/scan.ts`, which drops the coach's own sessions (builder's call 11, pre-flight H13);
  - tests: `test/app/{args,model,render,explain,copy}.test.ts`.

**Interfaces:**
```ts
// app/args.ts
CliOptions.coach?: CoachCli | "auto";   CliOptions.coachConfirm?: string;   // 12 lower-case hex
// app/run.ts
RunDeps.confirm?(question: string): Promise<boolean>;   // cli.ts passes it only when stdin and stderr are both TTYs; it reads one line, true only for y/yes (pre-flight H6)
// app/report/model.ts
export type CoachView =
  | { status: "ok"; cli: CoachCli; models: string[]; inputHash: string; validRuns: number; runs: number; notes: CoachAnswer }
  | { status: "declined" | "unconfirmed" | "changed" | "failed"; cli: CoachCli; inputHash: string; reason?: CoachFail };
ReportInput.coach?: CoachView;   ReportModel.coach: CoachView | null;
```

**Flow** (`run()`):
1. **Before scanning,** resolve the CLI:
   - **Named, missing:** `--coach X` when X is not found → exit 2 with `error: --coach X: the X CLI was not found on PATH (found: <list or none>)`.
   - **`auto`, one found:** that CLI is used.
   - **`auto`, none found:** exit 2 with `error: --coach: no claude, codex or gemini CLI found on PATH`.
   - **`auto`, several found:** exit 2 with `error: --coach: found <a, b>; name one, e.g. --coach <a>`.
   - **`--coach-confirm` without `--coach`:** exit 2.
2. Scan, analyze, exhibits and export, as in Plan 3. The coach's own sessions never reach the store, because core's scan drops them (builder's call 11, pre-flight H13).
3. `episodeSkeletons`, then `buildDigest`, then `coachStdin`.
4. **Preview.** stdout prints three things:
   - `Coach digest for <cli>: <bytes> bytes, sha256 <first 12 hex>`;
   - the stdin bytes exactly;
   - `This is everything that will be sent. <cli> sends it to your provider under your account.`
5. **Confirmation:**
   - **`--coach-confirm` matches** the first 12 hex of the SHA-256: confirmed.
   - **`--coach-confirm` differs:** status `changed`, with `note: the digest changed since it was confirmed (now <hash>); nothing was sent` on stderr.
   - **Otherwise,** with no `confirm` dep: `unconfirmed`, with `To send it, run again with --coach-confirm <hash>` on stdout. With one, `d.confirm("Send it to <cli>? [y/N] ")`:
     - true: confirmed;
     - false: `declined` (pre-flight H6).
6. **Running.** Once confirmed, `runCoach`. On a TTY, stderr shows `Coach run <i>/3…` in place.
7. Build the model with the `CoachView`, render, and write. The exit code is 0 in every coach state.

**The coach chapter** (`id="coach"`, between `exhibits` and `health`; rail entry "Coach"):
- **Label,** in mono 12: `<cli> · <model ids through modelExportId, or "model not reported"> · input <first 12 hex> · <validRuns> of <runs> runs agree`.
- **Lead,** in serif 16: "Your own agent wrote these notes from the digest shown before it was sent. They are never scored and never exported; treat them as suggestions."
- **Lists:** Observations, Upgrades (each with its title, its steps as an `<ol>`, and its references) and Cautions.
  - A reference to a dimension or component links to that ledger row's `<details>`.
  - An episode reference shows as plain mono text, such as `E3`.
- **Other states,** one line each:
  - declined: "You chose not to send the digest; no coach notes."
  - unconfirmed: "Not sent: confirm on a terminal, or run again with --coach-confirm <hash>."
  - changed: "Not sent: the digest changed after it was confirmed."
  - failed: "<cli> returned no usable notes (<reason in words>)."
- **Coach text** comes from the model. It is cleaned by Task 19's `validateAnswer`, escaped, and set in serif. Like names, it is exempt from `uncoveredChars`, but kit and app copy are not.

**Privacy statement:** two sentences join Plan 3's six, and Plan 3's sentences 2 and 4 change, exactly (pre-flight H12):

- **Sentence 2:** "It keeps none of the text, never opens credential files, and makes no network requests itself."
- **Sentence 4:** "In the git repositories your sessions ran in, it reads commit metadata, a short list of config files and Aider's history files (see --explain), never source files; --no-repo-signals turns this off."

7. "With --coach, it shows you a digest of scores, step types and counts, with no text, code, paths or names, and only after you confirm passes it to your own agent CLI, which sends it to your provider; coach notes are never scored or exported."
8. "With --keep-history, it adds this run's scores to ~/.ai-practice/history.jsonl on this machine; --purge deletes everything it keeps in ~/.ai-practice."

**`--explain`** adds the line `With --coach: runs claude, codex or gemini from ~/.ai-practice/coach with a digest on stdin, shown before it is sent`.

- [ ] **Step 1: Write the failing tests** in `coach.cli.test.ts`.
  - **Setup:**
    - `main` runs with injected deps on a `fakeHome` with every builder and the canary planting.
    - `PATH` holds a temp bin folder with Task 19's fake agent installed as `claude`, `codex` and `gemini` (`.cmd` wrappers on win32).
    - The fake agent's canned answer holds the marker `FAKE_COACH_NOTE_7f3a`.
  - **Confirmed:** `--no-open --coach claude --json --export-for-employer --share-card --keep-history`, with `confirm → true`:
    - exit 0, and the fake agent is called 3 times;
    - each call's argv equals `AGENTS.claude.argv({ shim: false })` (`{ shim: true }` on win32), and its stdin bytes equal the preview's bytes;
    - `findCanaries(stdin)` is `[]`;
    - the report holds the chapter, the label with `input <hash>`, and the marker;
    - the marker is absent from the `.aiprof`, the `--json` file, the share card, the history file, stdout and stderr;
    - the report's dimensions deep-equal those of a run without `--coach`: never scored.
  - **Declined:** `confirm → false` → the agent is never called, and the chapter says declined.
  - **No TTY:** no `confirm` dep → never called, and stdout holds the hint with the hash. A second run with `--coach-confirm <hash>` → called 3 times.
  - **Piped stdin:** with stdin not a TTY and stderr a TTY, cli.ts passes no `confirm`: `unconfirmed`, and stdout holds the hint (pre-flight H6).
  - **Changed:** `--coach-confirm 000000000000` → `changed`, never called.
  - **Own runs:** a Claude Code fixture session whose cwd is `<home>/.ai-practice/coach` never reaches the store, with or without `--coach`: its coverage counts `skipped["own-coach"]`, `exclusions.projects` does not count it, and its prompts are in no dimension (pre-flight H13).
  - **Missing CLI:** `--coach gemini` with no `gemini` on `PATH` → exit 2, and the open observer records no opens, so no scan ran.
  - **Auto:** one CLI installed → it is used; two → exit 2 naming both.
  - **Failure:** the agent in `hang` mode, with an injected 300 ms timeout → chapter `failed` (timeout), the report written, exit 0.
  - **No stderr echo:** the agent's stderr holds `CANARY.email`, and it is absent from ai-practice's stdout and stderr.
  - **Args:** `--coach=codex`, `--coach` followed by another flag (→ `auto`), `--coach-confirm xyz` (→ error), and the removal of Plan 3's "not available" error for `--coach`.
  - **Copy:**
    - `helpText` and the Method section hold sentences 7 and 8 and the amended 2 and 4 (pre-flight H12);
    - `uncoveredChars` over the new copy is `[]`;
    - every line of `helpText` is at most 100 columns.
  - **Render:**
    - for fixtures without `coach`, Plan 3's snapshots are unchanged apart from Method (pre-flight H1);
    - with a coach view, the audit is clean, the chapter order is you, upgrades, exhibits, coach, health, share and method, and every reference link resolves.
- [ ] **Step 2: Run** `bun test test/app` → FAIL.
- [ ] **Step 3: Implement** the flags, the flow, the confirm dep, the model field, the section and the copy.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(app): --coach — preview the exact bytes, confirm, run your own CLI, render labelled notes`.

---

### Task 21: Canary surfaces, integration, local P4 acceptance, PR

**Files:**
- Modify: `test/app/canary.surfaces.test.ts`, `test/app/integration.test.ts`. The report smoke stays as it is (pre-flight H15).
- Create: `scripts/coach-smoke.ts`, `test/scripts/coach-smoke.test.ts`

**Interfaces:**
- **`scripts/coach-smoke.ts`** runs `run()` on the real environment with `--no-open --coach claude`, in two passes:
  1. The first pass's `confirm` dep records the preview's hash and returns false.
  2. The digest is checked: Task 18's `isTextFree` must hold, and it must be at most 32,768 bytes.
  3. The second pass runs with `--coach-confirm <hash>`.
- It writes into a fresh `$TMPDIR/ai-practice-coach-smoke-*` folder that it removes in `finally`.
- It prints only `key=PASS|FAIL` lines. The keys are `cli-found`, `digest-text-free`, `digest-under-32kb`, `confirmed`, `runs-valid` (at least 2), `notes-rendered`, `notes-not-exported` and `exit`. It exits 1 when any line is FAIL, else 0 (pre-flight H15).
- It never prints the digest, the notes, scores, names or ids.

- [ ] **Step 1: Extend the canary harness** (Plan 3's R1–R5 stay as they are):

  | # | Surface | Rule |
  |---|---|---|
  | R6 | `history.jsonl` (runs 1 and 2 with `--keep-history`) | `findCanaries(bytes)` is `[]`; every line parses, and `sanitize(line, HISTORY1)` deep-equals it |
  | R7 | coach stdin and argv, captured by the fake agent | `findCanaries` is `[]`; argv equals the fixed argv; stdin equals the previewed bytes |
  | R8 | the coach-note marker | only in the report HTML, never in the export, `--json`, the card, history or logs |
  | R9 | new readers' fixtures (all Tasks 4–13 builders) | R1–R5 hold with every new plant present |

- [ ] **Step 2: Integration.**
  - `integration.test.ts` adds a run with every builder, `--keep-history` twice (the first record is backdated one month by rewriting `day` in the fixture file) and `--coach claude` with the fake agent.
  - The report shows the month-over-month table and the coach chapter.
  - The audit budgets hold: payload at most 300,000 bytes, fewer than 5,000 elements, and HTML at most 1,500,000 bytes.
- [ ] **Step 3: `coach-smoke.test.ts`.** With `HOME` and the rest pointed into a `fakeHome`, and the fake agent first on `PATH`, the smoke exits 0 and every line matches `/^[a-z0-9-]+=PASS$/` (pre-flight H15).
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Local acceptance (P4, B's part).**
  1. `bun scripts/smoke-local.ts` and `bun scripts/report-smoke.ts` both exit 0 with every line PASS. Run them outside the sandbox if it blocks reads.
  2. `bun scripts/coach-smoke.ts` exits 0 with every line PASS, using the local `claude` CLI. It needs the network, so run it with `dangerouslyDisableSandbox: true`. It costs three short runs on the owner's own account.
  3. Visual QA, Plan 3 Task 16's procedure, re-runs on synthetic fixtures that carry a two-month history and a fake coach view. The controller reviews the new chapter and the table in both themes, at both widths, and in print.
  4. Only pass/fail lines go into the PR. Per-tool presence, counts, dates, names and digests never do.
- [ ] **Step 6: Commit, push, open the PR.** Do not merge: the final whole-branch review comes first.
```bash
git add -A && git commit -m "feat: P1/P2 readers, WSL, history and coach — integration and P4 acceptance

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
# EtherHiding config scan → nothing printed
git push -u origin feat/advanced-report
gh pr create --base main --title "Advanced: P1/P2 tools, WSL, history, coach" --body "<summary + P4 acceptance pass/fail lines + visual QA approved by the controller + deviations: OpenCode's prompt-history.jsonl is not read (pre-flight H11), and package.json exports ./agents beyond spec §9 (pre-flight H4); no figures from the owner's machine>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch   # green on ubuntu/macos/windows + security guard
```
