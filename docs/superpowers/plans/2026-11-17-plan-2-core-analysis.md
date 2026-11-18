# Plan 2 — Core Analysis: repo signals, signals, scoring, forensics, privacy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Paths.** `<A>` and `<B>` stand for the roots of the local checkouts of A (`build-with-bala/ai-candidate-profiler`) and B (`build-with-bala/ai-practice-report`). `<research>` stands for the private research notes, which are in neither repo. `<scratch>` stands for the session scratchpad, a folder outside both repos. The controller gives the concrete paths at dispatch.

**Goal:** Turn a `ScanResult` into a private-by-construction analysis: repo signals from the repos the sessions ran in, the §6.4 signals, seven dimensions with intervals and evidence minimums, exposure and the unscored panels, personas, and forensics C1–C10. Expose it as `analyze()`, plus an allowlisted `aiprof/2` export as `exportPayload()`.

**Architecture:**
- `scan()` gains an after-pass that reads allowlisted git metadata and repo files for the repos its sessions ran in (`ScanResult.repos`).
- `analyze()` is synchronous and pure. It runs these stages in order:
  1. a session table: dedupe, exclusions, repo map, activity;
  2. one walk per detail-window session, producing per-session sufficient statistics;
  3. signals;
  4. component z against reference v0;
  5. dimensions with shrinkage, confidence and a session-level bootstrap;
  6. the overall, the panels, personas and forensics.
- `exportPayload()` maps the analysis through the §6.7 field decisions and a declared schema, drops everything undeclared, and returns the exact canonical bytes.

**Tech Stack:** Bun 1.3.11, TypeScript 5 (`strict`), `bun:sqlite`, `node:crypto`, `Bun.spawn` (git only), `bun test`. No runtime dependencies.

**Spec:** `<A>/docs/superpowers/specs/2026-11-17-ai-leverage-suite-v2-design.md`.
- This plan implements:
  - §6.1: repo signals and dedupe across tools
  - §6.2–§6.7
  - §6.9: `analyze` and `exportPayload`
  - the matching §10 tests
  - the §11 P2 acceptance
- §3 and §13–§14 bind every task.

**Builds on Plan 1:** `<A>/docs/superpowers/plans/2026-11-17-plan-1-core-sources.md`, as executed (PR #1).
- The event contract and its semantics block are in `core/model/events.ts`.
- The plugin contract is in `core/sources/types.ts`.
- Task 0A re-reads both on `main` before doing anything else.

**Research (private):** `<research>/02-scoring-v2.md` and `03-trust-privacy.md`. Never commit them, and never quote values from them.

**Repo and branch:** B lives at `<B>`.
- The controller created `feat/core-analysis` from `main` at `d30404e` (= `origin/main`) once PR #1 was merged; Task 0A does not create it (pre-flight P1).
- Task 16 opens the PR into `main`. It is merged only after the final whole-branch review.

**Out of scope:**
- Plan 3: the viz kit and B's app, CLI and report.
- Plan 4: A's app and trust stack.
- Plan 5: P1/P2 tools, WSL, coach, history, pairing recorder, RFC 3161, calibration.
- Plan 6: polish and release.

## Global Constraints

These are Plan 1's constraints as amended during its execution, plus this plan's own amendments, marked ✚.

**Platform**
- Bun ≥ 1.3; CI pins `1.3.11`.
- TypeScript `strict`; ESM; no native addons.
- No runtime dependencies. The only devDependencies are `typescript` and `@types/bun`.

**SQLite**
- Open SQLite only via `openRo()`.
- Use `immutable=1` only inside `openRo`, for a WAL store whose `-wal` is gone.
- Never `SELECT *`. Use parameterized queries with explicit, schema-checked column lists.
- ✚ Every paged read goes through the shared pager in `core/sources/common/sqlite.ts` (Task 0A).

**Free text**
- Events carry no free text: only numbers, booleans, enums, epoch ms, built-in tool names, versions and keyed hashes.
- ✚ `core/model/events.ts` declares these raw-in-memory channels. The export allowlists each of them (Task 14), so none of them leaves the machine raw:
  - model ids
  - Claude Code `SessionEv.surface`
  - `AnchorEv.idTail`
  - session ids
  - `ConfigEv.name`
  - `ToolEv.mcpServer`
- ✚ `Analysis` holds no free text outside `analysis.private`. Exports read `analysis.private` only through Task 14's allowlists.
- ✚ `RepoSignals` holds only keyed hashes, enums and counts, plus the raw repo roots in `RepoSignals.roots`. That map stays in memory and never enters `Analysis`.

**What is read**
- Never opened:
  - `auth.json` and `*.key`
  - Copilot `apps.json` and `hosts.json`
  - credential and account tables and stores
  - OS keychains
- Mixed files are parsed in memory, and only allowlisted fields are kept.
- ✚ Repo signals read only git metadata and the allowlisted repo files (Task 3), never source files. Task 0C's open observer proves both.

**Repository content**
- Repo content is synthetic only.
- `FORMAT.md` files document fields and their types. They never contain values, and never contain observations about the owner's machine.

**Real local data**
- Real traces may be inspected only through `bun scripts/probe.ts`, which prints structure only.
- ✚ Real repos are touched only through `scan()`, during the smoke run.
- The smoke prints counts and pass/fail only. It never prints scores, bands, names, paths or ids, and never a date finer than a month.

**Reading and temp files**
- Streaming everywhere. `MAX_LINE_BYTES = 33_554_432`. No whole-file caps.
- Whole-file reads happen only via `readJsonSmall*`, and ✚ via `readTextSmall` (≤ 256 KiB, for repo files).
- No temp files by default. Fallback copies live under a 0700 dir and are removed in `finally` and on SIGINT/SIGTERM.

**Network and git**
- Core makes no network requests.
- ✚ Git runs only as an async spawn with a timeout.
  - It uses read-only subcommands only: `rev-parse`, `config --get`, `log` and `--version` (pre-flight P20).
  - Lazy fetch is off.
  - It runs only in repos found from session cwds, by ancestor checks; it never crawls the disk.
  - It can be switched off with `scan({ repoSignals: false })`.

**Identity and logging**
- Project identity is `keyedHash(salt, normalizePath(cwd))`.
- ✚ Repo identity is `keyedHash(salt, normalizePath(root))`.
- ✚ File paths in git are recorded as `keyedHash(salt, path)`.
- `ctx.log(level, code, n?)` takes enum-like codes only.

**Analysis**
- ✚ `analyze()` is a pure, synchronous function of `(ScanResult, AnalyzeOptions)`.
  - It never calls `Date.now()`; `now` defaults to `raw.finishedAt`.
  - It takes an explicit time zone and uses a seeded bootstrap.
  - Its output is plain JSON data containing only finite numbers.
- ✚ Every metric carries `{ window, sources, from, to, n }` (`MetricMeta`).
  - Numerator and denominator come from one window.
  - The two windows are never summed.
- ✚ Analysis keeps per-session sufficient statistics, never per-event copies. It must not multiply the resident event cost; Task 15 enforces this.

**Performance:** a cold scan plus analyze of the real local history takes ≤ 60 s, with peak RSS ≤ 1 GiB. Task 16 enforces this.

**Signals:** ✚ a trapped SIGINT or SIGTERM ends the process by that signal once every active scan has cleaned up, so no post-scan code runs. A second signal ends it at once. Task 0D enforces this.

**Refactors:** Tasks 0A–0C keep every Plan 1 reader suite passing unchanged. Tasks 0D, 0E and 1 change store or reader output only in the ways they list.

**Tests**
- Use `fakeHome()`, with `h.cleanup()` in `afterEach`.
- Restore `process.env.TZ` by assignment, never with `delete`.
- Repo tests use real `git`, which is present on all CI runners.
- POSIX-only tests skip on win32.

**Commits and pushes**
- Every commit ends with the `Co-Authored-By:` trailer of the model that authored it, for example `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before every push and every pull, run the EtherHiding config scan from the workspace `CLAUDE.md` (pre-flight P1).
- `git push` and `gh` need `dangerouslyDisableSandbox: true`.

## Spec values (verbatim — tasks cite these and never restate them differently)

### §6.5 Scoring model

**Units.** "Typed turn *t* (human origin); episode *e* = first human prompt of a session / after `/clear` / after a ≥ 30-min gap; `A_t` = actions attributable to *t* (main + subagents + child threads); `s_t = 1` unless followed by interrupt/correction within 10 min or the run ends on ≥ 2 errors."

**Transforms.** "counts → `log1p`, rates → `logit` (clamped), then `z` against the reference table, then display score `= 100·Φ(z)` (a percentile vs the *reference*, open-tailed — no hard caps)."

**Dimensions** (formula, then minimum evidence):

| Dimension | Formula | Minimum evidence |
|---|---|---|
| Leverage | 0.6 z(mean s_t·log2(1+A_t)) + 0.4 z(log p90 successful run) | 60 turns, 5 sessions, 10 days |
| Orchestration | 0.35 z(parallel buckets share) + 0.30 z(finished fan-out / episode) + 0.20 z(headless runs / active week) + 0.15 z(background share) | 14 days, 20 episodes |
| Verification | 0.5 z(VAE weighted by log lines changed) + 0.3 z(closure) + 0.2·guardrails (check-running hooks, CI/pre-commit, instructions naming test commands) | 20 edit turns |
| Steering | 0.4 z(−correction rate after briefs) + 0.3 z(healthy-interrupt share) + 0.3 z(−human turns per log work) | 30 follow-up turns |
| Context | 0.35·(active repos with maintained instruction files) + 0.35 z(used artifacts, provenance-weighted) + 0.15·hygiene + 0.15 z(task-start brief structure) | 20 episodes or 3 repos |
| Judgment | 0.4 z(deliberate switches / active week) + 0.4 z(ρ tier vs task size) + 0.2 z(−cost per landed unit) | 30 episodes with known model+effort |
| Delivery | 0.5 z(edit episodes → commit/PR ≤ 24 h) + 0.35 z(−rework ≤ 72 h) + 0.15 z(PRs / active week) | 10 edit episodes in git repos |

**Confidence.** "Low / Medium / High = 1× / 3× / 10× the minimum **and** ≥ 1 / 3 / 6 distinct weeks. Below minimum → 'insufficient (n=12, needs 50)', excluded from the overall, and turned into an interview probe (A) or a 'not enough data yet' note (B)."

**Shrinkage and intervals.** "shown `z' = z·n/(n+n_min)`; **intervals:** session-level bootstrap (B=200) over per-session sufficient statistics → '71 [63–78]'."

**Field gating.** "each component declares the fields it needs per tool version; missing → fallback or 'not measurable on this version', never 0."

**Reference table v0.** "per component an expert-set p50/p90 on the transformed scale (μ = p50, σ = (p90 − p50)/1.2816) with a written rationale, sanity-checked against synthetic personas (novice → expert) and a local run on real data (results never committed)."

**Overall.** "confidence-weighted mean of dimension z over dimensions at ≥ Medium confidence; weights Verification 0.20; Leverage, Orchestration, Steering, Context 0.15 each; Judgment, Delivery 0.10 each; displayed as band + interval + coverage ('6/7 dimensions'). Bands: Exceptional / Strong / Developing / Limited / Insufficient evidence."

**Unscored panels.** "Exposure, Agent-touched stack (languages/toolchains — relabelled, not 'knowledge'), Risk posture, Coverage."

**Personas.** "top-3 role names derived from signal mix (no '% match')."

### §6.2 Two time layers and coverage

- "Every metric carries `{source, window: "detail"|"lifetime", from, to, n}`; numerator and denominator always come from the same store and window."
- "Days count as active only with ≥ 1 human prompt (zero-count days and file mtimes never count)."

### §6.4 Signals catalogue (the time windows)

- Parallelism: "share of active 10-min buckets with ≥ 2 sessions doing agent work".
- Delivery: "share of edit episodes followed by commit/PR within 24 h; reverts/fix-ups on the same files within 72 h".

### §6.6 Forensics and integrity

| Check | Rule |
|---|---|
| C1 CC `req_`/`msg_` IDs linear in time (base58 after 4-char prefix) | "> 1% of messages off by > 10 min → fail; scheme change → 'n/a'" |
| C2 ID order vs time order | "Spearman < 0.99 → fail" |
| C3 history.jsonl vs transcripts vs stats-cache | "< 75% match → warn; transcript days missing from stats-cache → fail" |
| C4 session `accountUuid` vs `~/.claude.json` (compared as keyed hashes) | "0% match → fail; > 1 account → note" |
| C5 file times | "mtime < last event or ctime ≫ mtime → fail; ≥ 80% of files born in one 10-min window spanning > 7 days of events → 'copied/restored on DATE — ask about it'" |
| C6 every Codex rollout has a `threads` row | "missing → fail" |
| C7 Codex UUIDv7 time ≤ filename time | "later → fail" |
| C8 Codex rate-limit ledger monotone within windows | "contradictions → fail (spliced traces)" |
| C9 tool versions / models vs release dates (dated table shipped per release) | "used before release → fail" |
| C10 provenance fields (`promptSource`, `turnOrigin`, `entrypoint`, `originator`) | "classify only" |

- Soft flags: "prompt-rhythm regularity, ≥ 200-char prompts repeated ≥ 5×, activity share in the 14 days before the scan, `tool_use` without `tool_result`, config created < 7 days before scan"
- "Do **not** use (misfire on genuine data): monotonic timestamps within files, duplicate-prompt share, tokens vs cost ratios."
- "Output: band **Consistent / Consistent with notes / Inconsistent / Unverifiable**, the share of scored activity backed by server-minted data, and per-check reasons with an 'ask about' question. No automatic rejection."
- Server-backed share "never changes scores, evidence minimums, or confidence".
- Tools with no server-minted IDs "(Cursor, Copilot, Antigravity, all P2) are labelled 'not anchorable' — neutral, not a penalty".

### §6.7 Privacy layer

**Field decisions.**
- "drop hostname, machine user, emails, usernames, Copilot/Antigravity identity;
- projects → salted opaque labels (`P-3F2A`) + aggregates (candidate may reveal chosen names);
- MCP servers → names on a public allowlist, others 'custom #n';
- tool names → built-ins only;
- daily activity → weekly buckets for 12 months;
- hours → four coarse day-part bands (B only, private);
- tech terms → category counts;
- `agentIds` → count;
- account bindings → HMAC(invite nonce or per-run salt, id)."

**Allowlisted export schema** (`core/privacy/schema.ts`): "every exported field is declared with type and sensitivity class; the exporter walks the schema and drops everything else (deny by default)."

**Preview contract.** "both apps can render exactly the bytes that would be exported."

### §6.1 Repo signals

"Only for repos discovered from session `cwd`s, never by crawling:
- `git log` metadata (timestamps, trailers, file-path hashes, revert/fix-up markers);
- instruction files (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.cursorrules`, `.cursor/rules/*`) scanned in memory for test/build/lint command mentions → booleans and counts;
- `.claude/settings.json` hooks → event + command category;
- `.github/workflows/*.yml`, `.pre-commit-config.yaml`, `lefthook.yml`, `.husky/` → exists + invokes checks (boolean).

Source files are never read. `--explain` lists all of it; A's consent step and B's `--no-repo-signals` switch it off (Verification guardrails and Delivery then show 'not measured')."

### §11 P2 acceptance

"the 7 dimensions + exposure + forensics run on fixtures and on real local data; a heavy user's real data does not saturate (no dimension pinned at 100 without an open-tail mark); every metric carries window + n; canary tests pass."

## Builder's calls (binding here; spec §14 leaves them open)

1. **All components enter as z.** Every component enters its dimension as a z against reference v0. That includes the spec's `0.2·guardrails`, `0.35·(active repos …)` and `0.15·hygiene`: they are shares, and shares take the rate transform (§6.5 Transforms). Each dimension then centres on the reference.

2. **Transforms.**
   - Rates are smoothed before the logit: `r' = (r·n + 0.5)/(n + 1)`, clamped to [0.02, 0.98].
   - Correlations take `atanh(clamp(ρ, −0.95, 0.95))`.
   - "Lower is better" components are negated after the transform, so higher is always better and every p90 > p50.

3. **Missing data.**
   - A component without data is `not-measurable`, and its weight is spread over the dimension's measured components.
   - A dimension whose measured weight is < 0.5 is `not-measurable`. It is `not-measured` instead when what is missing needs repo signals that are off.

4. **Evidence ratio and shrinkage.**
   - The evidence ratio `r` is the smallest `n/minimum` over a dimension's "and" parts. For Context's "or" parts, it is the largest.
   - Shrinkage uses that same part: `z' = z·r/(r+1)`, which equals `z·n/(n+n_min)`.

5. **Display score.** `round(100·Φ(z'))`, clamped to [1, 99]. Set `openTail` whenever the displayed score is 99 (pre-flight P16).

6. **Overall.**
   - `overall = Σ w·z' / Σ w` over the dimensions at Medium or High confidence. Shrinkage carries the confidence weighting.
   - With fewer than 3 such dimensions, the overall is `insufficient`.
   - Bands, on the overall score: Exceptional ≥ 80; Strong 60–79; Developing 35–59; Limited ≤ 34.

7. **Bootstrap.**
   - Resample the detail-window top-level sessions with replacement, keeping the same count. The seed defaults to `0x5eed`.
   - Components computed across sessions stay at their point values: parallel buckets, headless runs per week, repo shares, lifetime rates, artifacts, PRs per week and rework (the `f` rows of Task 7's table).
   - The interval is the sorted replicate scores at 0-based ranks `floor(0.025·(B−1))` and `ceil(0.975·(B−1))`.
   - The interval is null when fewer than B/2 replicates score the dimension.

8. **Forensic tolerances.** The rules stay the spec's; these are the measurement tolerances.
   - **C1/C2:** need ≥ 50 recognized anchors per kind.
   - **C3:** count only days inside the stats-cache's own span. Fail at ≥ 2 missing days and ≥ 2%; a single missing day is a note.
   - **C5:**
     - "≫" means more than 24 h.
     - Files in a restore cluster are exempt from the ctime rule.
     - At least 5 files are needed.
     - Fail when at least max(2, 1% of files) violate.
   - **C6:** ignore rollouts named within 10 min of the scan. n/a without a readable thread index.
   - **C7:**
     - Allow 1 s, since file names are truncated to the second.
     - An offset that is a non-zero whole number of quarter hours within 14 h is read as a time-zone change, which is a note (pre-flight P17).
   - **C8:**
     - A contradiction is a drop of more than 2 points within one reset window.
     - Fail at ≥ 3 contradictions and > 0.5% of pairs.
     - n/a under 20 pairs.
   - **C9:** allow 2 days.

9. **Dedupe across tools** (the VS Code agent host, and any other case where two tools report the same work).
   - Two human or scripted prompts from different tools with an equal `textHash`, within 60 s of each other, are one prompt.
   - When ≥ 50% of one session's prompts pair with another tool's session, one of the two is a host copy (rules in Task 4).

10. **No double counting.**
    - Memory files are shown, not scored, because the agent writes them.
    - Hooks count only in Verification, never in Context as well.

The reference v0 values are in Task 7, the persona knobs in Task 9, and the turn and episode rules in Task 5.

## Review Focus

1. **A home with nothing to score.** Either no tools are installed, or only lifetime indexes remain after transcripts were pruned. Expected:
   - every dimension is `insufficient` or `not-measurable`, with `n` and `needs`;
   - the overall is `insufficient` and forensics are `unverifiable`;
   - exposure is computed from the lifetime layer;
   - the export is valid, and nothing anywhere is NaN or Infinity.

   Pinned by Task 13 (empty and lifetime-only `ScanResult`s) and Task 16 (an empty home, end to end).
2. **Degenerate statistics.** Every rate at 0 or 1, a single session, all tiers equal, zero variance. Expected: finite transformed values (smoothed and clamped), ρ `not-measurable` rather than NaN, and an interval that collapses to the point. Pinned by Tasks 7 and 8.
3. **Clock and calendar edges.** TZ=Pacific/Auckland vs UTC, a session crossing midnight or a DST change, ISO week 53 and the year boundary. Expected:
   - correct day and week keys;
   - 10-minute buckets on epoch time;
   - components that are neither per-day nor per-week rates unchanged by the zone.

   Pinned by Task 4 (the keys) and Task 13 (one persona under two zones).
4. **Hostile or odd repositories.** Repo config that would run programs (`log.showSignature` plus `gpg.program`, `core.fsmonitor`), a partial clone, a cwd that is not a repo or no longer exists, a long history, paths with spaces or unicode. Expected:
   - no program from repo config runs, and there is no lazy fetch;
   - repo signals stay within their time budget;
   - the scan finishes.

   Pinned by Tasks 2 and 3.
5. **The same work reported twice.** Three forms: a VS Code-hosted agent session that the agent's own CLI also wrote, a Codex thread present in both windows, and a commit seen both as a Claude Code commit marker and in git. Each must be counted once. Pinned by:
   - Task 4: the prompt-pair dedupe;
   - Task 5: landed units keyed by sha;
   - the store's window merge.

## File map (new or reshaped)

```
core/model/constants.ts                      window constants                                   0B
core/io/observe.ts                           open observer                                      0C
core/io/signals.ts · core/model/store.ts     shared scan trap, order-free session merge          0D
test/docs.test.ts                            public docs state formats, not local figures       0E
core/sources/common/{sqlite,stream,history,uri,hooks}.ts                                         0A 0B 3
core/text/langs.ts                           extension → language, toolchain match              1
core/git/{types,run,discover,commits,files,index}.ts                                             2 3
core/analysis/{types,sessions,dedupe,activity,walk,tiers,exposure,panels,labels}.ts              4 5 10
core/signals/{types,globals,compute}.ts                                                          6
core/scoring/{normal,transform,reference,components,dimensions,score,random,bootstrap,overall,roles}.ts, reference/v0.json   7 8 10
core/forensics/{types,anchors,claude,files,codex,releases,provenance,soft,index}.ts, releases.json           11 12
core/analyze.ts                                                                                  13
core/privacy/{schema,export,allowlists,jcs}.ts                                                   14
test/kit/scanresult.ts · test/fixtures/{repos,personas}.ts                                       4 2 9
```

---

### Task 0A: One async SQLite pager that yields; WAL hardening

**Files:**
- Create: `core/sources/common/sqlite.ts`, `test/core/sources/common.sqlite.test.ts`, `test/core/sources/wal.test.ts`
- Modify:
  - `core/io/sqlite.ts`, `test/kit/home.ts`, `test/core/io/sqlite.test.ts`
  - the store and paging code of `core/sources/codex/indexdb.ts`, `core/sources/copilot/cli.ts`, `core/sources/cursor/{diskkv,itemtable,tracking,agentcli,index}.ts` and `core/sources/antigravity/{cli,ide}.ts`
  - `core/sources/copilot/index.ts`, which must await the now-async `readSessionStore` (pre-flight P4)

**Interfaces:**
- Consumes:
  - `openRo`, `RoDb`, `isBusyError`, `MAX_COPY_BYTES` (`core/io/sqlite.ts`)
  - `maybeYield` (`core/io/yield.ts`)
  - `Tally` (`core/sources/common/coverage.ts`)
  - `ScanCtx`
- Produces: `core/sources/common/sqlite.ts`. The code moves here from `cursor/diskkv.ts` and becomes async.
```ts
export const PAGE = 2_000;
export const q: (ident: string) => string;          // '"' + ident with each '"' doubled + '"'
export function readStore(file: string, ctx: ScanCtx, tally: Tally, logPrefix: string,
  body: (db: RoDb, tables: Set<string>) => void | Promise<void>): Promise<boolean>;   // logs `<logPrefix>.db-unopenable` / `.db-unreadable`
export function tableColumns(db: RoDb, tables: ReadonlySet<string>, table: string, wanted: readonly string[], tally: Tally): Set<string> | undefined;
export function pageableColumns(db: RoDb, tables: ReadonlySet<string>, table: string, wanted: readonly string[], tally: Tally): Set<string> | undefined;
export function keyIndexed(db: RoDb, table: string): boolean;
export class Pass {
  constructor(db: RoDb, table: string, tally: Tally, ctx: ScanCtx, logCode: string, o?: { page?: number; busyLogCode?: string });   // page = rows per page, default PAGE; busyLogCode = log code for busy failures, default logCode (pre-flight P2, amended after Task 0A review)
  failed: boolean; unreadable: boolean;
  byKey(sql: string, lo: string, hi: string, each: (rows: Obj[]) => void): Promise<boolean>;
  byRowid(sql: string, each: (rows: Obj[]) => void): Promise<boolean>;
  lookup(sql: string, params: unknown[]): Obj | undefined;
}
export function eachRow(map: () => void, tally: Tally): void;
```
- `Pass` keeps the current semantics of the `Pass` in `cursor/diskkv.ts`:
  - the first non-busy failure of a pass is drift `table-unreadable:<table>`;
  - a busy error, or any later failure, is `io-error`;
  - any failure ends the pass.

  It adds two behaviours: it awaits `maybeYield()` before every page, and it returns `false` once `ctx.signal.aborted` is set.
- Antigravity keeps its 32-row step pages (`page = 32`): a step row carries blobs of up to 1 MiB each, so a 2,000-row page would break the memory budget (pre-flight P2).
- Copilot's store pager moves onto these semantics, an accepted output change: a first non-busy failure becomes drift `table-unreadable:<table>`, where today every failure is `io-error` (pre-flight P2).
- `core/io/sqlite.ts`: `openRo(file, temp, opener?, o?: { maxCopyBytes?: number })` refuses the copy fallback (returns null) when `size(db) + size(db-wal)` exceeds `o?.maxCopyBytes ?? MAX_COPY_BYTES`.
- `test/kit/home.ts`:
  - signature: `sqliteLive(rel: string, ddl: string[], rows?: Record<string, unknown[][]>): { path: string; insert(table: string, row: unknown[]): void; close(): void }`
  - the store is in WAL mode with `PRAGMA wal_autocheckpoint=0`;
  - the writer stays open, so rows inserted afterwards live only in `-wal`.

- [ ] **Step 1: Branch and re-read the contract.**
  1. Do not create the branch: the controller created `feat/core-analysis` at `d30404e` (= `origin/main`). Confirm that `HEAD` is that branch and equals `main` (pre-flight P1).
  2. On `main`, read `core/model/{events,ids,store}.ts`, `core/sources/types.ts` and `core/scan.ts`.
  3. Confirm that every name this plan consumes exists with the type it states:
     - `ScanResult{store, coverage, warnings, cwds, salt, startedAt, finishedAt, tempClean}`
     - `ScanOptions.signal`, `ScanOptions.onLog`, `ScanOptions.onProgress`
     - `EventStore.all`, `EventStore.forSession`, `EventStore.session`
     - `SessionEv.{mode, effort, background, workflowId, parentId, agentType, approval, sandbox}`
     - `ToolEv.outcome`
     - `MarkerEv.{detail, proxyTs}`
     - `DailyEv.{zone, unit, count}`
     - `TotalsEv.tokens`
     - `RateLimitEv.bucket`
     - `CoverageEv.{window, status, beta, unknownTypes}`
  4. If anything differs, stop and report BLOCKED with the difference. Names this plan does not consume (for example `SourcePlugin.primary`) are not checked.
- [ ] **Step 2: Write the failing tests.**
  - `common.sqlite.test.ts`:
    - (a) A stub `RoDb` whose `all()` busy-waits 30 ms and returns 3 full pages, then a short page. A `setTimeout(fn, 1)` armed before `byRowid` must fire before `byRowid` resolves.
    - (b) Abort inside page 1's `each`: `byRowid` resolves `false` after at most 2 pages.
    - (c) A non-busy first-query error gives `tally.unknownTypes["table-unreadable:t"] === 1` and `unreadable === true`. A busy error on page 2 gives `tally.skipped["io-error"] === 1`.
    - (d) `q('a"b') === '"a""b"'`.
    - (e) `new Pass(…, 3).byRowid` over 7 rows reads pages of 3, 3 and 1 rows (pre-flight P2).
  - `test/core/io/sqlite.test.ts`: use a busy-on-first-open opener with a 4,096-byte store and an 8,192-byte `-wal`.
    - `{ maxCopyBytes: 8_192 }` → `null`, and `temp.active === 0`.
    - `{ maxCopyBytes: 16_384 }` → `copied === true`.
  - `wal.test.ts` covers both WAL paths through `codex.threads`:
    - **Live:** a `sqliteLive` `state_5.sqlite` holds one thread row; a second row is `insert`ed after checkpoints are off. While the writer is open, `scan({ plugins: [cxThreads] })` emits 2 `codex-thread-row` events.
    - **Closed:** a WAL store is written and then closed (`fakeHome.sqlite(…, true)`). Its rows are read, and afterwards there is no `-wal` or `-shm` file beside it.
- [ ] **Step 3: Run** `bun test test/core/sources/common.sqlite.test.ts test/core/io/sqlite.test.ts test/core/sources/wal.test.ts` → FAIL.
- [ ] **Step 4: Implement.**
  1. Write `common/sqlite.ts` and move every copy onto it, deleting the copies:
     - Codex `readStore`, `pages`, `eachRow`;
     - Copilot `storePages`, `eachRow`;
     - Cursor `readStore`, `tableColumns`, `pageableColumns`, `keyIndexed`, `Pass`, `eachRow`, `q`, `PAGE`;
     - Antigravity `readStore`, `each`, and its pager.
  2. Log codes keep their values: `logPrefix` is `cx`, `cp`, `cu` or `ag`. Copilot keeps `cp.db-busy` for busy failures via `busyLogCode` and logs `cp.db-query` for every other failure (pre-flight P2, amended after Task 0A review).
- [ ] **Step 5: Run** `bun test && bunx tsc --noEmit` → PASS, with every Plan 1 suite unchanged.
- [ ] **Step 6: Commit** `refactor(sources): one async SQLite pager that yields; the copy limit counts -wal`.

---

### Task 0B: Shared stream, history and filesystem helpers; one constant per window

**Files:**
- Create: `core/model/constants.ts`, `core/sources/common/{stream,history,uri}.ts`, `core/sources/antigravity/ids.ts`, `core/sources/{cursor,copilot}/ids.ts` (pre-flight P3), `test/core/sources/common.{stream,history}.test.ts`
- Modify:
  - core: `core/io/{fs,jsonl,protobuf}.ts`, `core/sources/common/roots.ts`
  - every reader that holds a copy:
    - claude-code `transcripts`, `history`, `config` (its `isFile` copy, pre-flight P4)
    - codex `rollouts`, `history`, `config`, `tools`
    - copilot `map`, `cli`, `index`
    - cursor `diskkv`, `itemtable`, `index`, `agentcli`, `tracking` (it imports `TOOL`, pre-flight P3)
    - antigravity `cli`, `history`, `ide`, `brain`
  - other: `scripts/smoke-local.ts`, `test/core/io/{fs,jsonl}.test.ts`

**Interfaces:**
```ts
// core/model/constants.ts — one copy of each §6.4/§6.5 window
export const TASK_GAP_MS = 30 * 60_000;
export const CORRECTION_WINDOW_MS = 10 * 60_000;
export const BUCKET_MS = 10 * 60_000;
export const DELIVERY_WINDOW_MS = 24 * 3_600_000;
export const REWORK_WINDOW_MS = 72 * 3_600_000;
// core/io/fs.ts
export type FileState = "file" | "dir" | "missing" | "other" | "error";
export function fileState(p: string): FileState;  // stat, following links: ENOENT/ENOTDIR → missing; EACCES, ELOOP, any other failure → error
export const isDir: (p: string) => boolean;       // === "dir"; the one policy: a linked folder counts; walk()/listDir traversal never follows links
export const isFile: (p: string) => boolean;
// core/sources/common/stream.ts
export interface StreamResult { read: boolean; size: number; stat?: import("node:fs").Stats }
export function streamJsonlFile(file: string, ctx: ScanCtx, tally: Tally, onRecord: (v: unknown) => void | "stop",
  o?: { sniffSkip?: (head: string) => boolean; ioLog?: string }): Promise<StreamResult>;
// core/sources/common/history.ts
export class PromptLog {
  constructor(ctx: ScanCtx, tool: ToolId, source: string, tally: Tally);
  add(p: { text: string; ts: number; sessionId?: string; hasPaste?: boolean }): void;
  finish(): void;
}
```
- **`readJsonl`** yields nothing only when `fileState` is `missing`. For `error`, `dir` and `other` it throws, and callers count `io-error`.
- **`streamJsonlFile`:**
  - A link to a regular file is read through the link.
  - A path that exists but is not a regular file counts as `skipped["not-file"]`.
  - For each record it does `tally.records++` and calls `onRecord`. A throw counts as `bad-record`; returning `"stop"` ends the file.
  - An I/O failure counts as `io-error` and logs `ctx.log("warn", o.ioLog)`.
  - If the scan is aborted, it returns `read: false`.
  - When the file is read to its end, it adds `tally.files++` and `tally.bytes += size`.
- **`PromptLog.add`** emits a lifetime human `PromptEv` with intent, features and `textHash = ctx.hash(text.trim())`.
  - `isTaskStart` is true for the first prompt of a session key, or for a prompt ≥ `TASK_GAP_MS` after that session's previous prompt.
  - `prevText` is that previous prompt.
- **`PromptLog.finish()`** emits one `DailyEv{zone:"local", unit:"prompts"}` per local day.
- **Moves:**
  - Every copy of `TASK_GAP_MS` → `constants.ts`.
  - Every copy of `isDir` and `isFile` → `core/io/fs`.
  - The JSONL file loops → `streamJsonlFile`. These are in: Claude Code transcripts, Codex rollouts, the Copilot journal and CLI events, the Antigravity transcript and history, and the Claude Code and Codex history readers (pre-flight P4).
  - The three history readers keep their own field mapping and call `PromptLog`.
  - `pbStr`, `pbNum`, `pbTime` → `core/io/protobuf.ts`.
  - `agSessionId` and `TOOL` → `antigravity/ids.ts`; `TOOL`, `IDE_SOURCE` and `cuSessionId` → `cursor/ids.ts`; `TOOL`, `cpSessionId` and `cpModel` → `copilot/ids.ts` (pre-flight P3). After this, a reader imports another module only from its own tool's `ids.ts`.
  - `uriToPath` → `common/uri.ts`.
  - `codex/tools.ts` exports `SHELL_TOOLS`. The smoke imports it and drops its own copy.

- [ ] **Step 1: Write the failing tests.**
  - `fs.test.ts`:
    - `fileState` returns `file`, `dir` and `missing` for those paths.
    - A dangling link → `missing`.
    - A file inside a `chmod 000` dir → `error` (POSIX).
    - `isDir` of a link to a dir → `true`.
  - `jsonl.test.ts`: iterating a file inside a `chmod 000` dir throws (POSIX).
  - `common.stream.test.ts`:
    - A linked `history.jsonl` is read: `files === 1`, 3 records.
    - A dir at the path → `not-file` 1.
    - `onRecord` throwing on line 2 of 3 → `bad-record` 1, records 3.
    - `"stop"` after line 1 → records 1.
    - An unreadable file → `io-error` 1, and the log code reaches `onLog`.
  - `common.history.test.ts`:
    - Two interleaved sessions get `isTaskStart` per session.
    - A prompt 31 min after its session's previous prompt is a task start.
    - Under `TZ=Pacific/Auckland`, there are two `DailyEv`s, on the expected local days.
- [ ] **Step 2: Run** `bun test test/core/io test/core/sources/common.stream.test.ts test/core/sources/common.history.test.ts` → FAIL.
- [ ] **Step 3: Implement** the helpers and the moves.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS, with every Plan 1 suite unchanged.
- [ ] **Step 5: Commit** `refactor(sources): shared stream, history and fs helpers; one constant per window`.

---

### Task 0C: Pin never-opened files and the smoke's counts-only output

**Files:**
- Create: `core/io/observe.ts`, `test/core/never-opened.test.ts`, `test/core/static-io.test.ts`, `test/scripts/smoke.test.ts`
- Modify:
  - `core/io/{jsonl,fs,sqlite}.ts`, so that they report opens;
  - `core/sources/codex/config.ts`, which now reads `config.toml` through `readTextLines`;
  - `scripts/smoke-local.ts`.

**Interfaces:**
```ts
// core/io/observe.ts
export type OpenHow = "stream" | "read" | "sqlite" | "header" | "copy";
export function noteOpen(path: string, how: OpenHow): void;   // every core/io primitive calls it before it opens file content
export function __observeOpens(fn?: (path: string, how: OpenHow) => void): void;   // test hook; undefined = off
// core/io/fs.ts
export function readTextLines(p: string, o: { maxBytes: number; signal?: AbortSignal }): AsyncGenerator<string>;
```
- **Static rule:**
  - Outside `core/io/`, no `core/**/*.ts` file may contain any of: `readFileSync`, `openSync`, `readSync`, `createReadStream`, `copyFileSync`, `Bun.file(`, `new Database(`.
  - Outside `core/git/run.ts`, none may contain any of: `Bun.spawn`, `spawnSync`, `child_process`.
- **Smoke error handling:** handlers for `unhandledRejection` and `uncaughtException` print `error: <class name>` and exit 1.
- **Smoke output grammar:** every value in a `key=value` token matches
  `/^(-?\d+(\.\d+)?|\d+\/\d+|n\/a|-|true|false|\d{4}-\d{2}\.\.\d{4}-\d{2}|-\.\.-|[a-z][a-z0-9_.:-]{0,47})$/`.
  This grammar is pinned; Task 16 extends it. Keys contain no `=` (pre-flight P19).

- [ ] **Step 1: Write the failing tests.**
  - `never-opened.test.ts`:
    - Build a `fakeHome` with all Plan 1 builders. Plant these files, each containing `CANARY.secret`:
      - `.codex/auth.json`
      - `.claude/.credentials.json`
      - `.config/github-copilot/apps.json`
      - `.config/github-copilot/hosts.json`
      - `.ssh/id_ed25519`
      - `.codex/x.key`
    - Record opens with `__observeOpens`, then run `scan({ env: h.env })`.
    - No recorded path ends in `auth.json`, `.credentials.json`, `apps.json`, `hosts.json`, `id_ed25519` or `.key`.
    - Every recorded path lies inside `h.root`.
    - Each P0 tool has at least one recorded open.
  - `static-io.test.ts`: reads every `core/**/*.ts` file as text and applies the static rule.
  - `smoke.test.ts`:
    - **Setup:**
      - Spawn `bun scripts/smoke-local.ts` with a 60 s timeout.
      - Point these variables into a `fakeHome` built with all Plan 1 builders: `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_STATE_HOME`, `TMPDIR`, `TEMP`, `TMP`.
      - Remove `CLAUDE_CONFIG_DIR` and `CODEX_HOME`.
    - **Shared output checks**, for runs (a) and (b):
      - `expectNoCanaries(stdout + stderr)`;
      - no line contains `h.root`, its basename, or any fixture session id or cwd;
      - every `key=value` value matches the grammar.
    - **Cases:**
      - (a) exit 0, and the last line is `RESULT: PASS`.
      - (b) POSIX: with `.claude/projects` at `chmod 000`, exit 1, and the last line starts `RESULT: FAIL`.
      - (c) `--concurrency x` exits 1, with stdout exactly `error: Error\n`.
- [ ] **Step 2: Run** `bun test test/core/never-opened.test.ts test/core/static-io.test.ts test/scripts/smoke.test.ts` → FAIL.
- [ ] **Step 3: Implement** the observer calls in every opening primitive, `readTextLines`, the Codex config switch and the smoke handler.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `test(core): never-opened files and the smoke's counts-only output are pinned`.

---

### Task 0D: Signals at the scan's tail and while unwinding; an order-free session merge; the zero-yield guard

Task 0A's pagers yield between pages, which shortens the synchronous stretches. The tail turn added here covers what is left: a job's last synchronous work and `temp.close()`.

**Files:**
- Modify: `core/io/signals.ts`, `core/scan.ts`, `core/model/store.ts`, `core/sources/common/coverage.ts`, `test/kit/scan-child.ts`
- Test: extend `test/core/scan.signals.test.ts`, `test/core/model/store.test.ts`, `test/core/scan.test.ts`

**Interfaces:**
```ts
// core/io/signals.ts — one process-wide trap, shared by every scan that handles signals; trapSignals stays as the primitive
export interface ScanTrap { readonly caught: TermSignal | undefined; leave(): Promise<void> }
export function enterScanTrap(o: { abort: () => void; closeSync: () => void }): ScanTrap;
// core/model/store.ts
export function mergeSessions(reports: readonly SessionEv[]): SessionEv;   // the same result for any order of the reports
export function mergeSession(a: SessionEv, b: SessionEv): SessionEv;       // = mergeSessions([a, b])
// core/sources/common/coverage.ts
export const INERT_SKIPS: readonly string[];   // ["copied", "empty"]: records read on purpose that yield nothing
```

**Signal rules.**
- `enterScanTrap` installs one SIGINT/SIGTERM listener pair while at least one scan is inside the trap. Later scans join that pair.
- **First signal:** record it, and call every active scan's `abort`.
- **A second signal**, arriving before every active scan has left:
  1. call every active scan's `closeSync`, best effort;
  2. remove the listeners;
  3. send the signal again at once.

  The process then ends by that signal without waiting for the unwinding.
- **`leave()`:**
  1. First it awaits one `setImmediate` turn. A signal that landed during the last job's synchronous work, or during `temp.close()`, is dispatched there.
  2. If no signal was caught, it leaves the trap (removing the listeners when it is the last scan) and resolves.
  3. If a signal was caught and this is the last active scan, it removes the listeners and re-raises.
  4. If a signal was caught and other scans are still inside, it never resolves. The last scan's re-raise ends the process, so no caller's post-scan code runs.
- **`scan()`:** `enterScanTrap` replaces the direct `trapSignals` call. In `finally`, run `temp.close()`, then `await trap.leave()`. `handleSignals: false` enters no trap, as before.

**Merge rule.** The store keeps every report it receives for a session id; the merged session is `mergeSessions(reports)`.
- Sort the reports by rank: detail window first, then `source` ascending, then canonical JSON as the final tiebreak.
- Each field without a rule of its own takes the first defined value in that order. Among reports that tie on window and source, it takes the `smaller` value.
- `start` is the minimum and `end` the maximum; `models` is the sorted union; `origin` follows `ORIGIN_PRECEDENCE`; `window` is `detail` when any report is.

**Zero-yield guard** (the coverage stamp in `scan.ts`):
- It is skipped when the scan was aborted; the abort stamp alone decides that coverage.
- It fires only when `records − Σ skipped[r] over r ∈ INERT_SKIPS > 0` and no primary kind yielded.

- [ ] **Step 1: Write the failing tests.**
  - `scan.signals.test.ts` (child processes, POSIX):
    - **(a) Tail.** The child's only plugin ends with about 1.5 s of synchronous work after its last `await`. Send SIGINT 300 ms after `ready`. The child must exit by SIGINT, `after-scan` never prints, and no `aipr-*` is left.
    - **(b) Overlapping scans.** Two scans run at once, each with a plugin that works for 2 s in 25 ms yielding slices. Send one SIGINT. The child exits by SIGINT, and neither `after-scan A` nor `after-scan B` prints.
    - **(c) Second signal.** A plugin ignores the abort and works for 3 s in yielding slices. Send SIGINT, then SIGINT again 200 ms later. The child exits by SIGINT within 500 ms of the second signal, and `after-scan` never prints.
    - Plan 1's existing signal tests pass unchanged.
  - `store.test.ts`: three reports of one session id:
    - R1 `{window: "detail", source: "codex.rollouts"}`, without `approval`;
    - R2 `{window: "lifetime", source: "codex.threads", approval: "on-request"}`;
    - R3 `{window: "lifetime", source: "codex.zz", approval: "never"}`.

    In all 6 arrival orders, `store.session(id)` is deep-equal and `approval === "on-request"`. A field that R1 sets wins over R2's and R3's values.
  - `scan.test.ts`:
    - A plugin reads records and is aborted before emitting any primary kind → coverage `status: "error"`, `note: "aborted"`, no `zero-yield` key, and no `drift` warning for its source.
    - A history fixture whose entries all have blank text (`skipped.empty` equals `records`) → no `zero-yield` key, and the status is not `drift`.
    - A Claude Code root whose only transcript records are fork copies (`skipped.copied` equals `records`) → no `zero-yield` key.
- [ ] **Step 2: Run** `bun test test/core/scan.signals.test.ts test/core/model/store.test.ts test/core/scan.test.ts` → FAIL.
- [ ] **Step 3: Implement** the shared trap, the tail turn, `mergeSessions` and the guard changes.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `fix(core): no signal is lost at the scan's tail; a second one exits; session merge is order-free`.

---

### Task 0E: Reader residue — raw channels, a double count, `proxyTs`, docs

**Files:**
- Modify:
  - `core/sources/claude-code/{transcripts,tools}.ts`, `core/sources/claude-code/FORMAT.md`
  - `core/sources/copilot/{map,cli}.ts`, `core/sources/copilot/FORMAT.md`
  - `core/sources/antigravity/FORMAT.md`, `docs/design.md`
  - `core/sources/codex/FORMAT.md` (pre-flight P5)
  - `core/model/events.ts`: the semantics block's Copilot `surface` sentence (pre-flight P4) and the `commit` row of the marker table (pre-flight P8)
- Create: `test/docs.test.ts`
- Test: extend `test/core/sources/{claude-code.transcripts,copilot}.test.ts`

**Interfaces:**
```ts
// core/sources/claude-code/tools.ts
export const CC_BUILTIN_TOOLS: ReadonlySet<string>;   // every name ccToolCategory maps, plus the CLI's other built-in tools that FORMAT.md lists
export const BUILTIN_AGENTS: ReadonlySet<string>;     // moved from transcripts.ts: general-purpose, Explore, Plan, claude, fork, statusline-setup,
                                                      // output-style-setup, claude-code-guide, comment-thread-analyst, workflow-subagent
```

**Rules.**
- **Claude Code `ToolEv.name`:** `mcp` for MCP tools; the name itself when it is in `CC_BUILTIN_TOOLS`; otherwise `other`. This replaces the `TOOL_NAME` shape test.
- **Claude Code `SessionEv.agentType`:** the agent type when it is in `BUILTIN_AGENTS`; otherwise its keyed hash. The meta's `isBuiltIn` no longer decides.
- **`stopped-by-user` interrupt:** it is stamped at the session's last record, so it carries `proxyTs: true`.
- **Claude Code `commit` marker `detail`:** `ctx.hash` of the sha's first 7 hex digits, lower-cased, so that it equals Task 2's `shaKey` for the same commit. The `commit` row in `events.ts` and the Claude Code `FORMAT.md` say so (pre-flight P8).
- **Copilot session store `surface`:**
  - `host_type` names a repository host, not a client, so it is never used as `surface`.
  - Store sessions take their surface from the store they come from: `vscode` for the extension's copy, `cli` for the CLI's own store.
  - The Copilot `surface` sentence of the semantics block in `core/model/events.ts`, which still names `host_type`, is rewritten to match (pre-flight P4).
- **Copilot VS Code request times:**
  - An implausible but well-formed timestamp counts once, as `bad-ts`.
  - `no-ts` counts only a missing or shapeless timestamp, together with its drift key.
- **Docs:**
  - `docs/design.md`, the per-tool table in §6.1 (the Claude Code, Codex, Copilot and Antigravity rows): remove every figure measured on the author's machine. Keep the requirement and its `[measured]` citation. Format constants go in code spans: field names, `kind:0/1/2`, version numbers, and dates of format changes. Rewrite any other `[measured]` line that the docs test flags the same way.
  - `core/sources/antigravity/FORMAT.md`: two sentences report what local records showed — that no model field was seen, and how `input_tokens` compares with `cache_read_tokens` on most records. Rewrite them as statements about the format, marked "(unverified)".
  - `core/sources/codex/FORMAT.md` and `core/sources/copilot/FORMAT.md`: their evidence legends say a field was confirmed "on this machine". Reword each legend to name the method, not the machine (pre-flight P5).

- [ ] **Step 1: Write the failing tests.**
  - `claude-code.transcripts`:
    - A `tool_use` named `CANARY.project` → `name: "other"`, and `expectNoCanaries` passes on the tool events. `Read` stays `Read`.
    - A meta with `agentType: CANARY.project` and `isBuiltIn: true` → `agentType` is a 16-hex keyed hash. `Explore` stays `Explore`.
    - The `stopped-by-user` interrupt has `proxyTs: true`.
    - A `gitOperation.commit.sha` of `ABC1234def` gives a `commit` marker whose `detail` is `ctx.hash("abc1234")` (pre-flight P8).
  - `copilot`:
    - A CLI-store row with `host_type: "github"` → `surface: "cli"`. The VS Code store copy → `surface: "vscode"`.
    - A request with timestamp `631152000000` (1990) → `skipped["bad-ts"] === 1`, and no `no-ts`.
    - A request without a timestamp → drift key `request.timestamp:shape`, and `skipped["no-ts"] === 1`.
  - `docs.test.ts`:
    1. On every line of `docs/design.md` that contains `[measured]`, no digit remains once code spans are removed.
    2. No line of any `core/sources/*/FORMAT.md` contains "was seen", "were seen", "on most records", "on this machine" or "on this Mac".
- [ ] **Step 2: Run** `bun test test/docs.test.ts test/core/sources/claude-code.transcripts.test.ts test/core/sources/copilot.test.ts` → FAIL.
- [ ] **Step 3: Implement** the allowlists, the surface rule, the single count, `proxyTs`, and the doc rewrites.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `fix(sources): built-in names only, store surfaces by client, one bad-ts count, proxy times; docs state formats`.

---

### Task 1: Finish text features; additive contract fields and their readers

**Files:**
- Create: `core/text/langs.ts`, `test/core/text/langs.test.ts`
- Modify:
  - **Contract and text:** `core/model/{ids,events}.ts`, `core/text/{structure,commands,tech}.ts`
  - **The six `classifyCommand` call sites:**
    - `claude-code/tools.ts`, plus `claude-code/transcripts.ts`, which copies its `checks` into each `ToolEv` (pre-flight P4)
    - `codex/tools.ts` and `rollouts.ts`, where the category is re-derived from the completed item
    - `copilot/map.ts`
    - `copilot/cli.ts`
    - `cursor/diskkv.ts`
    - `antigravity/cli.ts`
  - **Config and patches:** `claude-code/config.ts`, `codex/config.ts`, `codex/tools.ts`, and the `FORMAT.md` files involved
  - **Tests:** `test/core/text/{structure,commands,tech}.test.ts`; the reader tests `claude-code.{transcripts,lifetime}`, `codex.{rollouts,index}`, `copilot`, `cursor`, `antigravity`

**Interfaces:**
```ts
// ids.ts
export type Toolchain = "js" | "py" | "go" | "rust" | "jvm" | "dotnet" | "ruby" | "php" | "swift" | "dart" | "native" | "shell" | "any";
// events.ts — additive, optional; add one line each to the semantics block
PromptFeatures.chars?: number      // UTF-16 length of the trimmed prompt
ToolEv.toolchain?: Toolchain       // toolchain of the command that produced the call's first check
ConfigEv.firstSeen?: number        // the artifact's birth time (ctime where the FS has none) by stat — never opened — or an install time the tool records
// commands.ts
export function classifyCommand(cmd: string): { category: ToolCategory; checks: CheckKind[]; toolchain?: Toolchain };
// langs.ts
export type EditLang = Toolchain | "doc";
export function langOfExt(ext: string | undefined): EditLang | undefined;   // undefined: no extension; an unlisted code extension → "any"
export function toolchainMatches(check: Toolchain | undefined, edited: ReadonlySet<Toolchain>): boolean;  // check undefined or "any", edited has "any", or edited has check
// tech.ts
export const TECH_TERMS: Readonly<Record<TechCategory, readonly string[]>>;   // the list the consent preview shows
```

**Toolchain of a command:**

| Toolchain | Commands |
|---|---|
| js | bun, npm, pnpm, yarn, deno, and the js tools vitest, jest, mocha, ava, karma, eslint, prettier, biome, tsc, vue-tsc, svelte-check, vite, next, nuxt, astro, webpack, esbuild, rollup, stylelint, playwright, cypress |
| py | pytest, py.test, tox, nox, unittest, mypy, pyright, ruff, flake8, pylint, black, isort, `python -m <x>` |
| go | go, golangci-lint, gofmt |
| rust | cargo, rustfmt |
| jvm | mvn, gradle, gradlew, ktlint |
| dotnet | dotnet |
| ruby | rspec, rake, rubocop |
| php | phpunit, pest, phpcs, phpstan, psalm, composer, `php artisan` |
| swift | swift, xcodebuild, swiftlint |
| dart | dart, flutter |
| native | cmake, ctest |
| shell | shellcheck |
| any | make, just, pre-commit, bazel, bazelisk, nix |

**Extension → language:**

| Language | Extensions |
|---|---|
| js | ts tsx js jsx mjs cjs vue svelte astro css scss sass less html |
| py | py pyi ipynb |
| go | go |
| rust | rs |
| jvm | java kt kts scala groovy clj |
| dotnet | cs fs vb |
| ruby | rb erb |
| php | php |
| swift | swift m mm |
| dart | dart |
| native | c h cc cpp cxx hpp hh |
| shell | sh bash zsh fish ps1 |
| doc | md mdx txt rst adoc json jsonc yaml yml toml ini cfg csv tsv lock svg png jpg jpeg gif webp ico pdf |
| any | any other extension |

**Wrapper flags that take a value** are skipped together with their value: `env -u|-C|-S <v>`, `sudo -u|-g|-C|-h|-p <v>`, `nice -n <v>`.

**Package runners** (pre-flight P6): a JS package runner (`npm`, `pnpm`, `yarn` or `bun`, optionally followed by `run`, `exec` or `x`) followed by a tool the toolchain table names runs that tool, so `pnpm vitest run` is read as `vitest run`. A package script named like such a tool is read as that tool.

**Claude Code config:**
- When `settings.json` has `disableAllHooks: true`:
  - emit no `hook` events;
  - emit one `ConfigEv{kind:"feature", name:"hooks-disabled", provenance:"authored"}`;
  - set `skipped["hooks-disabled"]` to the number of hook entries left out.
- Set `firstSeen` on:
  - skill folders, command files and agent files (stat, following links);
  - plugins, from their cache folder's stat when it exists.

**Codex:**
- `config`: set `firstSeen` on skill folders.
- `tools`: a shell call whose command, in argv or string form, starts with the word `apply_patch` is read as `apply_patch`. That gives one `edit` per patched file, with the body taken from `argv[1]`, or from the heredoc when the string uses `<<`.
- A `*** Delete File:` section gives `linesAdded: 0` and no `linesRemoved`, meaning unknown.

- [ ] **Step 1: Write the failing tests.**
  - `structure`: `promptFeatures("  hello  ").chars === 5`.
  - `commands`: add these rows:

    | Command | Expected |
    |---|---|
    | `cd web && pnpm vitest run` | `{test, ["test"], "js"}` |
    | `uv run pytest -q` | `py` |
    | `cargo clippy` | `{lint, "rust"}` |
    | `make test` | `any` |
    | `go vet ./...` | `{typecheck, "go"}` |
    | `env -u FOO npm test` | `{test, "js"}` |
    | `sudo -u ci pytest` | `{test, "py"}` |
    | `ls -la` | no toolchain |

  - `langs`:
    - `langOfExt("tsx") === "js"`;
    - `langOfExt("md") === "doc"`;
    - `langOfExt("sql") === "any"`;
    - `langOfExt(undefined) === undefined`;
    - `toolchainMatches("py", new Set(["js"])) === false`;
    - `toolchainMatches(undefined, new Set(["py"])) === true`;
    - `toolchainMatches("js", new Set(["any"])) === true`.
  - `tech`: `TECH_TERMS.frontend` includes `"react"`.
  - Readers:
    - **Toolchains:**
      - Claude Code Bash `bun test` → `toolchain: "js"`;
      - Codex `pytest` → `"py"`, including through the category re-derived from the completed item;
      - Copilot terminal `npm test` → `"js"`;
      - Cursor `pytest -q` → `"py"`;
      - an Antigravity `run_command` step carries its command's toolchain.
    - **Claude Code config with `disableAllHooks: true`:** 0 `hook` events, 1 `hooks-disabled` feature, and skill `firstSeen > 0`.
    - **Codex patches:**
      - `shell {command:["apply_patch","*** Begin Patch\n*** Update File: a.py\n+x\n*** End Patch"]}` → one `edit` `{editExt:"py", linesAdded:1}`;
      - a delete section leaves `linesRemoved` absent.
- [ ] **Step 2: Run** `bun test test/core/text test/core/sources` → FAIL.
- [ ] **Step 3: Implement.** Readers copy `toolchain` wherever they copy `checks`.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(core): prompt length, check toolchains, artifact first-seen, disabled hooks`.

---

### Task 2: Repo signals I — safe git runner, repo discovery, commits, scan after-pass

**Files:**
- Create: `core/git/{types,run,discover,commits,index}.ts`, `test/fixtures/repos.ts`, `test/core/git/{run,commits,repos}.test.ts`
- Modify: `core/scan.ts` (option, after-pass, result field), `core/index.ts` (types)

**Interfaces:**
```ts
// core/git/types.ts
export type AiTool = "claude" | "codex" | "copilot" | "cursor" | "gemini" | "antigravity" | "aider" | "other";
export type InstructionKind = "claude" | "agents" | "gemini" | "cursorrules" | "cursor-rules";
export interface CommitFact { ts: number; shaKey: string; ai?: AiTool; generated?: AiTool; rework?: "revert" | "fixup" | "fix"; files: string[] }
export interface InstructionFacts { files: InstructionKind[]; namesChecks: CheckKind[]; touched: number; lastTouched?: number }
export interface HookFacts { entries: number; checks: CheckKind[]; disabled: boolean }
export interface CheckFacts { present: boolean; checks: CheckKind[] }
export interface RepoFacts { repoKey: string; projectKeys: string[]; identity: boolean; commits: CommitFact[]; commitsTruncated: boolean; fileLists: boolean;
  instructions: InstructionFacts; hooks: HookFacts; ci: CheckFacts; precommit: CheckFacts }        // Task 3 fills the last four; until then empty
export interface RepoSignals { status: "ok" | "partial" | "off" | "git-missing"; repos: RepoFacts[]; roots: Map<string /* repoKey */, string /* rawRoot, memory only (P3 pre-flight F16) */>;
  skipped: Record<string, number>; since?: number; ms: number }
// core/git/run.ts
export interface GitResult { code: number | null; stdout: string; timedOut: boolean; truncated: boolean }
export type GitRunner = (args: readonly string[], o: { cwd: string; timeoutMs: number; maxBytes: number; signal: AbortSignal }) => Promise<GitResult>;
export const GIT_SAFE_ARGS: readonly string[];  // ["--no-pager","-c","core.fsmonitor=false","-c","log.showSignature=false","-c","core.quotepath=off","-c","color.ui=never"]
export function gitEnv(base: Record<string, string | undefined>): Record<string, string>;
export const runGit: GitRunner;
// core/git/commits.ts
export function classifyCommit(message: string): Pick<CommitFact, "ai" | "generated" | "rework">;   // in memory; the message is dropped
export function parseLog(stdout: string, o: { salt: Uint8Array; email: string; maxFiles: number }): CommitFact[];
// core/git/index.ts
export interface RepoSignalOptions { timeoutMs?: number /* 10_000 */; budgetMs?: number /* 20_000 */; maxRepos?: number /* 200 */;
  maxCommits?: number /* 5_000 */; maxFiles?: number /* 200 */; concurrency?: number /* 4 */; runner?: GitRunner }
export function collectRepoSignals(input: { cwds: ReadonlyMap<string, string>; recent: ReadonlySet<string>; detailFrom?: number;
  salt: Uint8Array; now: number; signal: AbortSignal }, o?: RepoSignalOptions): Promise<RepoSignals>;
export const REPO_SIGNALS_DESCRIBE: { reads: string[]; runs: string[] };   // for --explain (Plan 3)
// core/scan.ts
ScanOptions.repoSignals?: boolean | RepoSignalOptions;   // default true
ScanResult.repos: RepoSignals;                          // status "off" when disabled
```

**The runner.** `runGit` spawns `git` with `GIT_SAFE_ARGS`, then `args`.
- Process setup:
  - `cwd` is the given `o.cwd`.
  - stdin and stderr are ignored, and stdout is streamed.
- Environment, from `gitEnv`:
  - start from the inherited environment with every `GIT_*` variable removed;
  - then set `GIT_OPTIONAL_LOCKS=0`, `GIT_TERMINAL_PROMPT=0`, `GIT_NO_LAZY_FETCH=1`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_PAGER=cat` and `LC_ALL=C`.
- Termination:
  - the process is killed on timeout or abort;
  - once stdout passes `maxBytes`, the output is cut there, the process is killed and the result is marked `truncated`.

**Discovery.**
1. Take `recent`: the projectKeys of sessions in any window that ended within 180 days before `now`.
2. For each raw cwd of `recent` that `isDir` accepts, walk up at most 20 ancestors to the filesystem root, looking for `.git` as a dir or a file. A cwd with no such ancestor is "not a repo"; it spawns nothing and counts as `skipped["not-a-repo"]`.
3. Each distinct candidate gets one `git rev-parse --show-toplevel`, run with a 5 s timeout. The toplevel is the root.
4. Group projectKeys by root, sort the roots by detail-session count in descending order, and keep the first `maxRepos`. The rest count as `skipped["too-many-repos"]`.

**Commits** (per root):
1. Run `git config --get user.email`. The email is held in memory, compared case-insensitively, and never stored. If there is none, set `identity: false` and read no commits.
2. Run `git log --all --no-merges --no-renames --date-order --since=<ISO of detailFrom − 3 days> --max-count=<maxCommits> --name-only --format=%x1e%H%x1f%ct%x1f%ae%x1f%B%x1f`.
3. Keep only commits whose author email equals `user.email`.
4. Set the fields:
   - `ts` = `%ct × 1000`;
   - `shaKey` = `keyedHash(salt, sha.slice(0, 7).toLowerCase())`, the normalised 7-hex prefix, so it equals the `detail` of the Claude Code `commit` marker for the same commit, which Task 0E keys the same way (pre-flight P8);
   - `files` = each path as `keyedHash(salt, path)`, capped at `maxFiles`.
5. Partial clones: when git is older than 2.44 (from `git --version`, pre-flight P20) and the repo is a partial clone (`extensions.partialClone` is set), read commits without `--name-only`. Set `fileLists: false`, so rework cannot be measured in that repo.

**`classifyCommit`** looks at the message:
- **AI co-authors:** `Co-authored-by:` lines are matched, case-insensitively, against these patterns. Non-AI co-authors are ignored.
  - `claude|anthropic` → claude
  - `codex|openai|chatgpt` → codex
  - `copilot` → copilot
  - `cursor` → cursor
  - `gemini|jules` → gemini
  - `antigravity` → antigravity
  - `aider` → aider
  - `devin|windsurf|codeium|amp|factory|droid|qwen|kiro|cline|roo|kilo|goose|opencode|crush|junie` → other
- **Generated-with:** a line matching `generated (with|by) \[?<tool>` → `generated`, using the same patterns.
- **Rework**, from the first line:
  - `^Revert "` → revert
  - `^(fixup|squash|amend)! ` → fixup
  - `^(fix|hotfix|bugfix)(\([^)]*\))?!?:` → fix

**Budget.** No new repo starts after `budgetMs`, and a running one is killed at the budget. Either way, the status becomes `partial` and the case counts as `skipped["budget"]`.

**Scan after-pass.**
- It runs after the plugin pool, inside the scan's `try`. It is skipped when `repoSignals === false` or the scan was aborted.
- `detailFrom` is the minimum `start` over detail-window sessions.
- It reports progress as `onProgress({ plugin: "repo-signals", done, total })`.
- An abort kills running git processes and gives status `partial`.
- If git is missing, the status is `git-missing`; coverage and warnings are unchanged.

- [ ] **Step 1: Write the fixture builder.**
  - Signature: `makeRepo(dir: string, commits: Array<{ files: Record<string, string>; message: string; at: number; email?: string }>, o?: { email?: string; config?: Record<string, string> }): string`.
  - It uses real `git`, sets `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE`, passes `-c user.email`, and uses `commit.gpgsign=false`.
- [ ] **Step 2: Write the failing tests.**
  - `run.test.ts`:
    - `runGit(["--version"])` → `code 0`.
    - A fake `git` that sleeps 5 s, put on `PATH`, with `timeoutMs: 200` → `timedOut` within 1 s (POSIX).
    - `maxBytes: 100` on `git log` → `truncated`.
    - An inherited `GIT_DIR=/nonexistent` does not break `rev-parse`.
    - An abort kills the process.
  - `commits.test.ts`, pure:
    - `"feat: x\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"` → `ai: "claude"`.
    - `"…\n🤖 Generated with [Claude Code](https://claude.com/claude-code)"` → `generated: "claude"`.
    - `Revert "feat: x"` → revert.
    - `fixup! feat` → fixup.
    - `fix(api): y` → fix.
    - `Co-authored-by: Jane <jane@x.test>` → no `ai`.
    - `parseLog` keeps only the given email's commits, turns paths into 16-hex keyed hashes, and keeps 200 of 250 paths. It keys each commit by its sha's first 7 hex digits (pre-flight P8).
  - `repos.test.ts`, with real git:
    - **Setup:** a `fakeHome` with two repos.
      - Repo 1 lives at a path containing `CANARY.project`. Its files are named after `CANARY.project`, its messages contain `CANARY.prompt`, and one commit has the co-author `CANARY.email`.
    - **Sessions:** a fake plugin calls `registerCwd` for:
      - the root of repo 1;
      - a subfolder of repo 1;
      - repo 2;
      - a folder that is not a repo;
      - a deleted folder.
    - **Expected:**
      - `r.repos.status === "ok"`, with 2 repos;
      - repo 1 has both projectKeys and own commits only;
      - its `ai`, `generated` and `rework` flags are as built;
      - `expectNoCanaries(r.repos.repos)`, while `r.repos.roots` holds the path (memory only).
    - **Security (POSIX):** repo 2 has `log.showSignature=true`, and its `gpg.program` and `core.fsmonitor` scripts each touch a marker. After the scan, neither marker exists.
    - **Lazy fetch** (git ≥ 2.44, else skip):
      - Set up a `--filter=tree:0` clone of a local repo, with `uploadpack.allowFilter=true` on the source.
      - Its object count is unchanged after the scan, and the repo is listed.
    - **Odd repos (Review Focus 4):**
      - repo 2 lives at a path with a space and a non-ASCII letter (`dir with space/ünï`) and is read like any other;
      - a repo of 8 commits read with `maxCommits: 5` keeps 5 commits and sets `commitsTruncated`.
    - **Other cases:**
      - `repoSignals: false` → status `off`, and a counting runner is never called.
      - A runner that never settles, with `budgetMs: 300` → status `partial`, and `scan()` resolves in under 2 s.
      - A runner throwing `ENOENT` → status `git-missing`.
      - An abort during the after-pass → status `partial`.
- [ ] **Step 3: Run** `bun test test/core/git` → FAIL.
- [ ] **Step 4: Implement** the runner, discovery, commits and the after-pass.
- [ ] **Step 5: Run** `bun test && bunx tsc --noEmit` → PASS. Task 0C's static rule now finds spawn only in `core/git/run.ts`.
- [ ] **Step 6: Commit** `feat(git): repo signals from session repos — safe read-only git, commits as keyed facts`.

---

### Task 3: Repo signals II — instruction files, hooks, CI and pre-commit

**Files:**
- Create: `core/git/files.ts`, `core/sources/common/hooks.ts`, `test/core/git/files.test.ts`
- Modify:
  - `core/io/fs.ts` (`readTextSmall`)
  - `core/git/index.ts` (fills the four facts, and adds every file and folder `readRepoFiles` opens or lists to `REPO_SIGNALS_DESCRIBE.reads`, pre-flight P21)
  - `core/sources/claude-code/config.ts` (now uses `parseHooks`)
  - `test/core/never-opened.test.ts` (repo plants)

**Interfaces:**
```ts
// core/io/fs.ts — observed by Task 0C's hook
export function readTextSmall(p: string, maxBytes: number): { ok: true; text: string } | { ok: false; reason: "missing" | "not-file" | "too-large" | "io-error" };
// core/sources/common/hooks.ts — Claude Code's user and project settings share it
export interface ParsedHooks { entries: number; events: string[]; checks: CheckKind[]; disabled: boolean }
export function parseHooks(settings: Obj | undefined, onShape?: (key: string) => void): ParsedHooks;
// core/git/files.ts
export const INSTRUCTION_FILES: Readonly<Record<InstructionKind, string>>;  // CLAUDE.md, AGENTS.md, GEMINI.md, .cursorrules, .cursor/rules/
export function mentionedChecks(text: string): CheckKind[];               // inline code spans, fenced code lines, "$ "-prefixed lines → classifyCommand
export function ciChecks(yaml: string): CheckKind[];                      // `run:` values and their block-scalar lines
export function precommitChecks(kind: "pre-commit" | "lefthook" | "husky", text: string): CheckKind[];
export function readRepoFiles(root: string, cwds: readonly string[], o: { signal: AbortSignal; runner: GitRunner; now: number; timeoutMs: number }):
  Promise<Pick<RepoFacts, "instructions" | "hooks" | "ci" | "precommit">>;
```

**Rules:**
- **What is opened.**
  - Only exact relative paths are opened.
  - Three folders are listed, one level deep only:
    - `.cursor/rules/`: `*.md` and `*.mdc`;
    - `.github/workflows/`: `*.yml` and `*.yaml`;
    - `.husky/`: files not starting with `_` or `.`.
  - At most 64 files per folder.
  - At most 256 KiB per file. A larger file still counts as present, but its content is skipped as `too-large`.
- **Where.** `CLAUDE.md` and `AGENTS.md` are also read at each session cwd inside the repo.
- **Hooks.** `.claude/settings.json` goes through `parseHooks`, which honours `disableAllHooks`. `.claude/settings.local.json` is never opened: the spec's allowlist names `.claude/settings.json` only (pre-flight P21).
- **Pre-commit hook ids:**

  | Check | Hook ids |
  |---|---|
  | test | pytest |
  | lint | ruff, ruff-format, black, flake8, pylint, eslint, prettier, isort, shellcheck, rubocop, golangci-lint, markdownlint |
  | typecheck | mypy, pyright, tsc |

  `entry:` lines also go through `classifyCommand`.
- **Instruction history.** `instructions.touched` counts commits by any author that touched an instruction path within the 180 days before `now`, using `git log -n 50 --since=<now − 180 d> --format=%ct -- <paths>`. `lastTouched` is the newest of them.
- **No text.** Text never leaves these functions; they return only kinds, check lists, booleans and counts.

- [ ] **Step 1: Write the failing tests.**
  - Detection, one repo per case:

    | Input | Expected |
    |---|---|
    | `CLAUDE.md` names `` `bun test` `` and has a fenced `npm run lint` | `namesChecks` `["test", "lint"]` |
    | `.cursor/rules/a.mdc` exists | `files` includes `"cursor-rules"` |
    | `.github/workflows/ci.yml` with `run: \|` and a `pnpm test` line under it | `ci.checks` `["test"]` |
    | `.pre-commit-config.yaml` with `id: ruff` | `precommit.checks` `["lint"]` |
    | `.husky/pre-commit` with `npx vitest run` | includes `test` |
    | `.claude/settings.json` hook `PostToolUse` running `bun test` | `hooks.checks` `["test"]` |
    | the same, plus `disableAllHooks: true` | `disabled: true`, no checks |
    | a 300 KiB `CLAUDE.md` | listed in `files`, no `namesChecks` |

  - Instruction history: two commits touch `AGENTS.md`, one of them older than 180 days → `touched: 1`.
  - Canaries are planted in every file's text and name → none appear in the facts.
  - In `never-opened.test.ts`, add `src/index.ts`, `.env`, `secrets.json`, `package.json` and `.claude/settings.local.json` (pre-flight P21) to a repo. None of them is ever opened.
  - `REPO_SIGNALS_DESCRIBE.reads` names every file and folder that `readRepoFiles` opens or lists (pre-flight P21).
  - The `claude-code.lifetime` suite passes unchanged.
- [ ] **Step 2: Run** `bun test test/core/git test/core/never-opened.test.ts` → FAIL.
- [ ] **Step 3: Implement** `files.ts` and `hooks.ts`, and wire them into `collectRepoSignals`.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(git): instruction files, hooks, CI and pre-commit as booleans`.

---

### Task 4: Session table — dedupe, exclusions, repo map, activity

**Files:**
- Create: `core/analysis/{types,sessions,dedupe,activity}.ts`, `test/kit/scanresult.ts`, `test/core/analysis/{sessions,dedupe,activity}.test.ts`
- Modify: `core/model/events.ts`, for the sentence on workflow-run totals under "Orphan events" (pre-flight P4)

**Interfaces:**
```ts
// core/analysis/types.ts
export interface MetricMeta { window: Window; sources: string[]; from?: number; to?: number; n: number }
export interface Metric extends MetricMeta { value: number | null }   // null = not measurable, never a default 0
export interface Exclusions { tools?: ToolId[]; projects?: string[] /* projectKeys */; from?: number; to?: number }
export interface SessionRow { id: string; tool: ToolId; source: string; window: Window; origin: Origin; start: number; end: number;
  parentId?: string; orphan: boolean; children: string[]; depth: number; topId: string; projectKey?: string; repoKey?: string;
  models: string[]; effort?: string; background?: boolean; agentType?: string; workflowId?: string; surface?: string;
  mode?: "agent" | "chat"; approval?: string; sandbox?: string; version?: string }
export interface Capabilities { outcomes: ToolId[]; lines: ToolId[]; background: ToolId[]; usage: ToolId[]; effort: ToolId[] }
export interface Activity { detailDays: string[]; lifetimeDays: string[]; detailWeeks: string[]; lifetimeWeeks: string[];
  byTool: Partial<Record<ToolId, { detailDays: string[]; lifetimeDays: string[] }>> }
export interface SessionTable {
  rows: Map<string, SessionRow>; detailTop: SessionRow[]; hosts: Set<string>; repoOf: Map<string, string>;
  isHuman(p: PromptEv): boolean;      // origin human, or relabelled by the dedupe
  activity: Activity; capabilities: Capabilities;
  dedupe: { hostSessions: number; pairedPrompts: number; relabelled: number };
  exclusions: { tools: number; projects: number; sessions: number }; orphans: Partial<Record<Ev["k"], number>>;
}
export const PR_LINK_TOOLS: ReadonlySet<ToolId>;   // tools whose readers emit pr-link markers: claude-code
export const SWITCH_TOOLS: ReadonlySet<ToolId>;    // tools whose readers emit model-switch and effort-switch markers: claude-code (pre-flight P10)
// sessions.ts / activity.ts
export function buildSessionTable(raw: ScanResult, o: { now: number; timeZone: string; exclude?: Exclusions }): SessionTable;
export function dayKey(ms: number, timeZone: string): string;   // localDay
export function isoWeek(day: string): string;                    // "YYYY-Www", ISO-8601
// test/kit/scanresult.ts
export function scanResultOf(events: Ev[], o?: { repos?: RepoSignals; cwds?: Map<string, string>; salt?: Uint8Array; finishedAt?: number }): ScanResult;
```

**Rules:**
- **Rows.** One row per `SessionEv` in the store.
  - `children` comes from `parentId`. An `EdgeEv` supplies the parent when the child row lacks one.
  - `topId` is the root ancestor. In a cycle, the first repeated node becomes a root.
  - A row whose parent is missing gets `orphan: true`. It is kept out of `detailTop` and counted in `orphans.session`.
  - `repoKey` is `repoOf.get(projectKey)`, built from `RepoFacts.projectKeys`.
- **detailTop.** Rows that are:
  - in the detail window;
  - without a parent;
  - not a host copy;
  - not excluded.
- **Exclusions.**
  - **Tools.** Drop that tool's rows.
  - **Projects.** Drop the rows with that `projectKey`, together with their descendants.
  - **Date range.** Drop whole sessions that lie outside `[from, to]`, and drop prompts and daily counts outside it from the activity.
  - **Counts.** Count the tools excluded that had rows, the distinct projectKeys excluded, and the rows dropped.
- **Orphan events.** Events whose `sessionId` names no row are counted per kind and left out of the per-session walk. This also covers Claude Code workflow-run totals: add one sentence about them to the semantics block in `events.ts`.
- **Lifetime counts.** Activity, switches and exposure take events whether or not their session has a row.
  - Tool and date exclusions apply.
  - A project exclusion applies only when the session row is known.
- **Dedupe.** Builder's call 9.
  1. Pair detail-window prompts from different tools that have an equal `textHash` within 60 s of each other.
  2. A session pair where ≥ 50% of one side's human-or-scripted prompts are paired has a host copy. The host copy is the `copilot` session with surface `vscode`; otherwise, the session whose tool sorts later.
  3. The host copy joins `hosts` and is left out of every metric.
  4. In the other session, paired prompts whose origin is `scripted` count as human (`isHuman`), and a top-level `scripted` row becomes `human`.
- **Capabilities** are derived from the data:

  | Capability | Tools that have at least one… |
  |---|---|
  | `outcomes` | check `ToolEv` with `ok` defined |
  | `lines` | edit or write `ToolEv` with line counts |
  | `background` | session with `background` defined |
  | `usage` | `UsageEv` |
  | `effort` | `TurnEv` or `SessionEv` carrying `effort` |

- **Activity.**
  - `detailDays` are the local days (`dayKey`) of human detail prompts from rows that are neither excluded nor host copies.
  - `lifetimeDays` are the days of human lifetime prompts, plus the days of `DailyEv{unit:"prompts", zone:"local"}` with `count ≥ 1`.
  - Weeks are `isoWeek` of those days.
  - The same is kept per tool.
  - Zero-count days and file times never count.

- [ ] **Step 1: Write the failing tests.**
  - `sessions.test.ts`:
    - a 3-level tree gives correct `children`, `depth` and `topId`;
    - a cycle resolves;
    - an orphan child is counted and kept out of `detailTop`;
    - each exclusion kind is applied and counted;
    - a `TotalsEv` naming no session is counted in `orphans.totals`.
  - `dedupe.test.ts`:
    - **Pairing:**
      - a `copilot`/`vscode` session `H` has 4 human prompts;
      - a `claude-code` session `A` has 4 `scripted` prompts with the same hashes, within 5 s.
    - **Expected:**
      - `H` is in `hosts`;
      - `isHuman` holds for all of `A`'s prompts, and `A.origin === "human"`;
      - `dedupe` is `{hostSessions:1, pairedPrompts:4, relabelled:4}`.
    - **No host copy:** when only 1 of 5 prompts pair, or when equal hashes are 3 min apart.
  - `activity.test.ts` (Review Focus 3):
    - **Keys:** a 23:30 UTC prompt has different day keys under `TZ=Pacific/Auckland` and UTC.
    - **ISO weeks:**
      - `isoWeek("2026-12-31") === "2026-W53"`;
      - `isoWeek("2027-01-03") === "2026-W53"`;
      - `isoWeek("2027-01-04") === "2027-W01"`.
    - **What counts:**
      - a `DailyEv` with `count: 0` adds no day;
      - `FileFactEv` times never add days.
- [ ] **Step 2: Run** `bun test test/core/analysis` → FAIL.
- [ ] **Step 3: Implement** the table, the dedupe and the activity.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(analysis): session table with cross-tool dedupe, exclusions, repo map and activity`.

---

### Task 5: Turns, episodes and per-session statistics

**Files:**
- Create: `core/analysis/{walk,tiers}.ts`, `test/core/analysis/walk.test.ts`

**Interfaces:**
```ts
export type ChildType = "explore" | "plan" | "review" | "implement" | "custom" | "other";
export type Hist = Record<number, number>;                 // value → count
export interface SessionStats {
  id: string; tool: ToolId; source: string; origin: Origin; start: number; end: number; repoKey?: string; scripted: boolean;
  days: string[];                                          // local days with ≥ 1 typed turn
  turns: number; stickySum: number; actions: number; successRuns: Hist;           // successRuns: A_t of turns with s_t = 1, capped at 1,000
  gatedVae: boolean; editTurns: number; editWeight: number; verifiedWeight: number;
  failingChecks: number; closedChecks: number; fixCycles: Hist;                   // fixCycles capped at 50
  episodes: number; followUps: number; briefs: number; correctedBriefs: number; briefScoreSum: number;
  interrupts: number; healthyInterrupts: number; workEpisodes: number; turnsPerWorkSum: number; queued: number;
  children: number; finishedChildren: number; bgKnown: number; bgChildren: number; childTypes: Partial<Record<ChildType, number>>;
  workflowRuns: number; maxDepth: number;
  compactAuto: number; compactManual: number; freshEpisodes: number;
  tierPairs: number[];                                     // flat [tier, size, tier, size, …]
  tokens: number; tokensKnown: boolean; usd: number; usdKnown: boolean; landed: number;
  editEpisodes: number; editEpisodesInRepo: number; landedEpisodes: number; prKeys: string[]; commitShaKeys: string[];
  buckets: number[];                                       // distinct ⌊ts / BUCKET_MS⌋ with ≥ 1 action
}
export function buildSessionStats(t: SessionTable, store: EventStore, repos: RepoSignals, o: { timeZone: string }): SessionStats[];
export function isAction(e: ToolEv): boolean;              // walk rule 2; Plan 3's exhibits import it (P3 pre-flight F14)
export function briefScore(f: PromptFeatures): number;     // walk rule 11's brief score, the mean of its five marks; Plan 3 imports it (P3 pre-flight F14)
// tiers.ts
export function modelTier(model: string): 1 | 2 | 3 | undefined;  // 1 haiku|mini|nano|flash-lite|small; 2 sonnet|flash|standard (gpt-N, codex without max); 3 opus|max|pro|ultra|large
export function effortRank(effort: string): 1 | 2 | 3 | 4 | undefined;   // none|minimal|low 1, medium 2, high 3, xhigh|max|ultra 4
export function childType(agentType: string | undefined): ChildType;  // /^explore(r)?$/i explore; /^plan$/i plan; /review/i review; general-purpose|claude|fork|default|workflow-subagent implement; 16-hex keyed hash custom; else other
```

**Walk rules.** These are the algorithm; the signature does not determine them.
1. **Collect.** For each `detailTop` row, take the events of the row and of all its descendants via `store.forSession`: prompt, tool, turn, marker, usage, totals.
   - Prompts, turns and markers are taken from the detail window only. A marker's window is that of its source's coverage: markers come only from sources that report a detail coverage, except lifetime `clear` markers, which rule 7 uses (pre-flight P9).
   - Order is by `ts`, then kind (prompt < tool < marker < turn < usage), then emission index.
2. **Actions** are tool events with category ≠ `meta` and `outcome` ∉ {`denied`, `cancelled`}. The walk tests this with the exported `isAction(e)` (P3 pre-flight F14).
3. **Typed turns** are the row's own human prompts (`t.isHuman`). A turn's span runs to the row's next typed turn, or to the row's end. A `command`-intent prompt with no action in its span is not a turn, and its span joins the previous turn's.
4. **Child attribution.** A child `c` goes to the parent turn containing the `ToolEv` with `delegateTo === c.id`. Failing that, it goes to the turn containing `c.start`; failing that, to the first turn. Descendants roll up to their root's turn.
5. **`A_t`** = the actions in the span, plus the actions of the children attributed to the turn.
6. **`s_t`** is 0 when any of these holds; otherwise it is 1. Here and in rule 10, a marker with `proxyTs` never counts: its time is a stand-in.
   - a person's interrupt marker (detail `user`, `replaced`, or none) in the row falls within (turn start, span end];
   - the next typed turn has intent `correction` and arrives ≤ `CORRECTION_WINDOW_MS` after the span's last event;
   - the span's last two row actions both have `ok === false`.
7. **Episodes.** A typed turn starts an episode when it is the row's first turn, or a `clear` marker lies between it and the previous turn, or it comes ≥ `TASK_GAP_MS` after the previous event of the row. The episode is fresh when it is the row's first or follows a `clear`.
8. **VAE.**
   - **Edit turn:** a turn with at least one edit or write action, in the row or its attributed children, whose `langOfExt` is a `Toolchain`, i.e. not `doc` and not undefined.
   - **Weight:** `log2(2 + Σ known (linesAdded + linesRemoved))` over those edits.
   - **Verified:** a check action comes after the last such edit, within the turn (row or children). The check needs non-empty `checks`, no `outcome`, `ok` defined, and `toolchainMatches(check.toolchain, edit languages)`.
   - **Gating:** a row whose tool is not in `capabilities.outcomes` gets `gatedVae: false`, and its edit turns are not counted.
9. **Closure.** Within an episode, a failing check (`ok === false`, non-empty `checks`) is closed when a later check in the same episode, with an overlapping check kind and a matching toolchain, has `ok === true`. Each closed chain records its run of consecutive failures in `fixCycles`.
10. **Healthy interrupts.** An interrupt (detail `user`, `replaced`, or none) is healthy when all three hold:
    - it is early: ≤ 5 actions, or ≤ 120 s after its turn's prompt;
    - the next typed turn comes ≤ 10 min later, with intent ∈ {spec, redirect, correction, question}, ≥ 4 words, and `simToPrev` < 0.6 or absent;
    - no person's interrupt follows within 10 min of that turn.
11. **Briefs.**
    - A brief is the first typed turn of an episode with intent `spec` or `question`.
    - It is corrected when the episode's next typed turn has intent `correction`.
    - Its score is the mean of [`hasContext`, `fileRefs ≥ 1`, `listLines ≥ 2`, `constraintTerms ≥ 1`, `lenBucket ≥ 2`], computed by the exported `briefScore(f)` (P3 pre-flight F14).
12. **Work per turn.** For each episode with at least one action, `typed turns / log2(2 + episode actions)`.
13. **Children.**
    - A child is finished unless it has a `stopped-by-user` interrupt, or its last two actions both have `ok === false`.
    - `bg` comes from `background`, and `childTypes` from `childType(agentType)`.
    - `workflowRuns` is the number of distinct `workflowId`s among descendants; `maxDepth` is the deepest depth.
14. **Hygiene.** The row's `compact-auto` and `compact-manual` markers, plus `freshEpisodes`.
15. **Tier pairs.** For each episode with a known model tier and effort rank, record `[10·modelTier + effortRank, log2(1 + episode actions)]`. Take the maximum over the episode's `TurnEv`s; if they lack model or effort, use the row's single model and its effort.
16. **Tokens and cost.**
    - `tokens` = Σ(`inTok` + `outTok` + `cacheW`) over the usage of the row and its descendants.
    - `usd` comes from the row's `TotalsEv.usd`.
17. **Delivery.**
    - An edit episode is an episode that contains an edit turn.
    - It counts as in a repo when the row's repo has `identity`.
    - It is landed when either:
      - an own commit of that repo has `ts` in [episode start, episode end + `DELIVERY_WINDOW_MS`]; or
      - a `commit` or `pr-link` marker of the row falls in that interval.
    - `prKeys` and `commitShaKeys` are the marker details.
18. **Landed units.** Each own commit is assigned to the latest-starting `detailTop` row of its repo with `start ≤ ts ≤ end + DELIVERY_WINDOW_MS`. A row's landed units = |`commitShaKeys` ∪ the `shaKey`s assigned to it| + its distinct PRs.
19. **Buckets.** Over the actions of the row and its descendants.
20. **Scripted rows.** A row is scripted when its origin is `scripted` or `scheduled`. It has no turns, but it carries buckets, tokens and children.

- [ ] **Step 1: Write the failing tests.** Use hand-built `scanResultOf` sessions, with one assertion group per rule:
  - **Attribution (1–5):**
    - an Agent call delegating to a 6-action child adds 6 to `A_t`;
    - Copilot-style equal timestamps put the request's tools into that request's turn, in emission order.
  - **`s_t` (6):**
    - an interrupt inside the span → 0;
    - a correction 9 min after → 0;
    - a correction 11 min after → 1;
    - the last two actions failing → 0.
  - **Episodes (7):**
    - `clear` → a fresh episode;
    - a 31-min gap → a new episode that is not fresh.
  - **Markers (1, 14)** (pre-flight P9): a `/compact` that both `claude-code.history` and the transcript report gives `compactManual: 1`.
  - **VAE (8):**
    - an edit followed by `bun test` → verified;
    - a check before the last edit → not verified;
    - a `.py` edit followed by `npm test` → not verified;
    - a check with no toolchain → verified;
    - `.md`-only edits → not an edit turn;
    - a tool without `outcomes` → `gatedVae` false;
    - weights follow the line counts.
  - **Closure (9):**
    - fail, fail, pass → 2 of 2 closed, `fixCycles {2:1}`;
    - a denied `npm test` is never a failing check.
  - **Interrupts and briefs (10–11):**
    - one healthy interrupt and one that is not;
    - one brief score.
  - **Tiers and tokens (15–16):**
    - tier pairs come from `TurnEv`;
    - child tokens roll up to the row.
  - **Delivery (17–18):**
    - landed edit episodes and landed units, against a `RepoSignals` stub;
    - a git commit whose `shaKey` equals a `commit` marker's detail counts once (Review Focus 5).
  - **Scripted (20):** a scripted row has `turns 0`, `scripted true` and `buckets > 0`.
  - **Budget:** a row with 200,000 tool events finishes in under 2 s, and its stats are plain data: numbers, strings, arrays and records only.
- [ ] **Step 2: Run** `bun test test/core/analysis/walk.test.ts` → FAIL.
- [ ] **Step 3: Implement** the walk and the tier helpers.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(analysis): typed turns, episodes and per-session sufficient statistics`.

---

### Task 6: Signals catalogue

**Files:**
- Create: `core/signals/{types,globals,compute}.ts`, `test/core/signals/signals.test.ts`

**Interfaces:**
```ts
export interface Evidence { typedTurns: number; sessions: number; days: number; weeks: number; episodes: number; editTurns: number;
  followUps: number; briefs: number; failingChecks: number; interrupts: number; workEpisodes: number; tierEpisodes: number;
  editEpisodesInRepo: number; landed: number; repos: number; buckets: number; bgKnown: number; artifacts: number;
  lifetimeWeeks: number; ownCommits: number }
export interface Signals {
  vae: Metric; closure: Metric; medianFixCycles: number | null;
  stickyMean: Metric; p90Run: Metric; actionsPerTurn: Metric;
  parallelShare: Metric; peakConcurrency: number; backgroundShare: Metric;
  fanoutPerEpisode: Metric; childTypes: Record<ChildType, number>; workflowRunsPerEpisode: Metric; maxDepth: number;
  correctionRate: Metric; healthyInterruptShare: Metric; turnsPerWork: Metric; queuePerTurn: Metric;
  maintainedShare: Metric; artifacts: Metric; memoryFiles: number; briefScore: Metric; hygiene: Metric;
  switchesPerWeek: Metric; rho: Metric; tokensPerLanded: Metric; usdPerLanded: Metric;
  landedShare: Metric; reworkShare: Metric; prsPerWeek: Metric; aiCoauthoredShare: Metric; commitAfterSession: Metric;
  guardrails: Metric; headlessPerWeek: Metric;
  evidence: Evidence; repoSignals: RepoSignals["status"];
}
export type Globals = Pick<Signals, "parallelShare" | "peakConcurrency" | "headlessPerWeek" | "guardrails" | "maintainedShare" | "artifacts"
  | "memoryFiles" | "switchesPerWeek" | "reworkShare" | "prsPerWeek" | "aiCoauthoredShare" | "commitAfterSession" | "repoSignals">
  & { evidence: Pick<Evidence, "repos" | "buckets" | "artifacts" | "lifetimeWeeks" | "ownCommits">;
      firstParallelBucket?: number };   // start (epoch ms) of the earliest parallel bucket, from the walk's buckets; exposure reads it (pre-flight P14)
export function computeGlobals(t: SessionTable, stats: readonly SessionStats[], raw: ScanResult, o: { now: number }): Globals;
export function computeSignals(sample: readonly SessionStats[], g: Globals): Signals;   // pure; runs once per bootstrap replicate
```

**Formulas.** The value is null when `n = 0`, or when the needed capability or repo signals are missing.

**From the sample:**

| Signal | Value | n |
|---|---|---|
| `vae` | Σ`verifiedWeight` / Σ`editWeight`, over gated rows | Σ`editTurns` |
| `closure` | Σ`closedChecks` / Σ`failingChecks` | Σ`failingChecks` |
| `stickyMean` | Σ`stickySum` / Σ`turns` | turns |
| `p90Run` | 90th percentile (nearest rank) of the merged `successRuns` | its count |
| `backgroundShare` | Σ`bgChildren` / Σ`bgKnown` | Σ`bgKnown` |
| `fanoutPerEpisode` | Σ`finishedChildren` / Σ`episodes` | episodes |
| `correctionRate` | Σ`correctedBriefs` / Σ`briefs` | briefs |
| `healthyInterruptShare` | Σ`healthyInterrupts` / Σ`interrupts` | interrupts |
| `turnsPerWork` | Σ`turnsPerWorkSum` / Σ`workEpisodes` | work episodes |
| `briefScore` | Σ`briefScoreSum` / Σ`briefs` | briefs |
| `hygiene` | mean of the available parts: manual share = Σ`compactManual` / Σ(`compactAuto` + `compactManual`); fresh share = Σ`freshEpisodes` / Σ`episodes` | compactions + episodes |
| `rho` | Spearman correlation (average ranks) over the merged `tierPairs`; null under 3 pairs or when either side is constant | pairs |
| `tokensPerLanded` | Σ`tokens` / Σ`landed`, over `tokensKnown` rows | landed |
| `usdPerLanded` | the same as `tokensPerLanded`, with `usd` over `usdKnown` rows | landed |
| `landedShare` | Σ`landedEpisodes` / Σ`editEpisodesInRepo` | edit episodes in repos |

`medianFixCycles` comes from the merged `fixCycles`. `actionsPerTurn`, `queuePerTurn`, `childTypes`, `workflowRunsPerEpisode` and `maxDepth` are shown and not scored.

**Global:**
- An **active repo** is the `repoKey` of at least one `detailTop` row.

| Signal | Definition | n |
|---|---|---|
| `parallelShare` | **active bucket:** a bucket with ≥ 1 `detailTop` row (scripted rows included). **Parallel bucket:** one with ≥ 2 distinct rows. `parallelShare` = parallel buckets / active buckets | active buckets |
| `peakConcurrency` | the most rows in one bucket | — |
| `headlessPerWeek` | scripted `detailTop` rows / detail active weeks | detail weeks |
| `guardrails` | mean over active repos of the mean of 3 booleans: <br>1. **hook with checks:** the repo has hooks with checks and they are not disabled, or there is a user-level hook `ConfigEv` with checks and no `hooks-disabled` feature; <br>2. **CI or pre-commit:** `ci` or `precommit` has checks; <br>3. **instructions:** `namesChecks` includes `test` | active repos |
| `maintainedShare` | active repos with instruction files and `touched ≥ 1` / active repos | active repos |
| `artifacts` | **counted:** each distinct used (kind, name), over kinds skill, command, agent, plugin and mcp-server. **Used means:** `uses > 0`, or for MCP servers a detail `ToolEv.mcpServer` naming them, or a custom child `agentType` seen. **Weight:** authored 1.0; installed, bundled or unknown 0.3 | distinct used artifacts |
| `memoryFiles` | count of memory files, shown | — |
| `switchesPerWeek` | `model-switch` and `effort-switch` markers carrying a detail / lifetime active weeks of the `SWITCH_TOOLS` tools, from `Activity.byTool` (lifetime window); null when none of them has lifetime weeks (pre-flight P10) | those weeks |
| `reworkShare` | own commits in [detail from − 3 days, now] that a later own revert, fix-up or fix commit touches on an overlapping file hash within `REWORK_WINDOW_MS` / own commits that are not reverts (repos with `fileLists`) | those commits |
| `prsPerWeek` | distinct `prKeys` over all `detailTop` rows / detail active weeks of the `PR_LINK_TOOLS` tools, from `Activity.byTool`; null when none of them has detail weeks (pre-flight P10) | those weeks |
| `aiCoauthoredShare` | own commits with `ai` or `generated` / own commits (shown) | own commits |
| `commitAfterSession` | rows in repos with an own commit within `DELIVERY_WINDOW_MS` after their end / such rows (shown) | those rows |
| `firstParallelBucket` (a `Globals` field, not a metric) | start of the earliest parallel bucket, for exposure's `firstSeen` (pre-flight P14) | — |

**`MetricMeta`:**
- **Sample and detail metrics:** window `detail`; `from` and `to` are the min start and max end of the contributing rows; `sources` are the sorted distinct row sources.
- **Repo metrics:** window `detail`, with `sources ["git"]`.
- **`switchesPerWeek`:** window `lifetime`.

- [ ] **Step 1: Write the failing tests.**
  - Each formula, on hand-built stats and globals.
  - The value is null when `n = 0`.
  - With repo signals `off`: `guardrails`, `maintainedShare`, `landedShare` and `reworkShare` are null, and `repoSignals === "off"`.
  - `switchesPerWeek` and `prsPerWeek` divide by the weeks of the tools that emit their markers; with Codex data only, both are null, never 0 (pre-flight P10).
  - `firstParallelBucket` is the start of the earliest bucket with ≥ 2 rows (pre-flight P14).
  - `computeSignals` is pure: the same input gives deep-equal output, and inputs are not mutated.
  - A 5,000-row sample, computed 200 times, takes under 2 s.
- [ ] **Step 2: Run** `bun test test/core/signals` → FAIL.
- [ ] **Step 3: Implement** the globals and the per-sample computation.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(signals): the §6.4 catalogue as metrics with window and n`.

---

### Task 7: Scoring — transforms, reference v0, components, dimensions

**Files:**
- Create: `core/scoring/{normal,transform,reference,components,dimensions,score}.ts`, `core/scoring/reference/v0.json`, `test/core/scoring/{normal,transform,reference,score}.test.ts`

**Interfaces:**
```ts
export function phi(z: number): number;          // standard normal CDF, |error| < 1e-7
export function phiInv(p: number): number;       // Acklam; for tests and reports
export type Transform = "identity" | "log1p" | "logit" | "atanh";
export function transform(kind: Transform, raw: number, n: number): number;   // builder's call 2
export interface ReferenceEntry { p50: number; p90: number; transform: Transform; rationale: string }
export interface ReferenceTable { version: "v0"; components: Record<string, ReferenceEntry> }
export function loadReference(v?: "v0"): ReferenceTable;   // v0.json loads with import … with { type: "json" }, so a compiled binary carries it (P3 pre-flight F17)
export type DimensionId = "leverage" | "orchestration" | "verification" | "steering" | "context" | "judgment" | "delivery";
export type Confidence = "low" | "medium" | "high";
export interface ComponentResult { id: string; weight: number; status: "ok" | "not-measurable" | "not-measured"; raw: number | null; x: number | null; z: number | null; n: number; meta: MetricMeta }
export interface DimensionResult { id: DimensionId; status: "scored" | "insufficient" | "not-measurable" | "not-measured";
  z: number | null; score: number | null; interval: [number, number] | null; openTail: boolean; confidence: Confidence | null;
  n: number; needs: number; ratio: number; weeks: number; components: ComponentResult[]; meta: MetricMeta }
export function scoreDimensions(s: Signals, ref: ReferenceTable): DimensionResult[];
export function displayScore(z: number): { score: number; openTail: boolean };   // builder's call 5
```

**Components and reference v0** (`v0.json`, pinned):
- `x` is the transformed value, oriented so that higher is better; `−` marks a negated component.
- Units: `s` means resampled per session; `f` means fixed in the bootstrap.
- Each p50/p90 is stored to 4 decimals and carries the rationale shown. Rationales use only characters Plan 3's fonts cover: "about", never ≈, and "rho", never ρ; the lev.sticky and jud.rho rows are worded so (P3 pre-flight F1).

| id | dim · w · unit | transform | p50 | p90 | rationale |
|---|---|---|---|---|---|
| lev.sticky | L · 0.6 · s | identity | 2.5 | 4.2 | about 8 attributable actions per typed turn with 4 in 5 sticking; about 24 incl. subagent work with 9 in 10 |
| lev.run | L · 0.4 · s | log1p | 2.7726 | 3.9318 | the 90th-percentile successful run is 15 actions for a regular user, 50 for a strong one |
| orc.parallel | O · 0.35 · f | logit | −2.1972 | −0.4055 | 1 in 10 active ten-minute windows have two sessions working; 4 in 10 |
| orc.fanout | O · 0.30 · s | log1p | 0.4055 | 1.3863 | a finished subagent every second episode; three per episode |
| orc.headless | O · 0.20 · f | log1p | 0.6931 | 2.5649 | one scripted run per active week; a dozen |
| orc.background | O · 0.15 · s | logit | −2.1972 | 0 | 1 in 10 child runs in the background; half |
| ver.vae | V · 0.5 · s | logit | −0.4055 | 1.0986 | 4 in 10 code-edit turns checked after the last edit; 3 in 4 |
| ver.closure | V · 0.3 · s | logit | 0.6190 | 1.9924 | two thirds of failing checks pass later in the episode; nearly 9 in 10 |
| ver.guardrails | V · 0.2 · f | logit | −0.7082 | 1.3863 | one of three guardrails per active repo; most of them |
| ste.correction | S · 0.4 · s | logit − | 1.7346 | 2.7515 | 15% of briefs need a correction next; 6% |
| ste.interrupts | S · 0.3 · s | logit | 0 | 1.2657 | half of interrupts are early, substantive redirects; nearly 4 in 5 |
| ste.turnsPerWork | S · 0.3 · s | log1p − | −0.5878 | −0.3716 | 0.8 typed turns per doubling of work; 0.45 |
| ctx.instructions | C · 0.35 · f | logit | −0.4055 | 1.7346 | 4 in 10 active repos keep a maintained instruction file; 85% |
| ctx.artifacts | C · 0.35 · f | log1p | 1.3863 | 2.3979 | three provenance-weighted artifacts in use (two own skills plus a few installed); ten |
| ctx.hygiene | C · 0.15 · s | logit | −0.6190 | 0.6190 | a third of compactions and episode starts are deliberate; two thirds |
| ctx.briefs | C · 0.15 · s | logit | −0.4055 | 0.6190 | task briefs meet 2 of the 5 structure marks; more than 3 |
| jud.switches | J · 0.4 · f | log1p | 0.6931 | 1.7047 | one deliberate model or effort switch per active week; four to five |
| jud.rho | J · 0.4 · s | atanh | 0.1511 | 0.4847 | weak tier-to-size match (rho 0.15); clear (rho 0.45) |
| jud.cost | J · 0.2 · s | log1p − | −13.3047 | −12.2061 | 600k fresh tokens per landed commit or PR; 200k |
| del.landed | D · 0.5 · s | logit | −0.2007 | 1.3863 | 45% of edit episodes reach a commit or PR within a day; 80% |
| del.rework | D · 0.35 · f | logit − | 1.9924 | 2.9444 | 12% of commits reverted or fixed up on the same files within 72 h; 5% |
| del.prs | D · 0.15 · f | log1p | 0.6931 | 1.7918 | one PR per active week; five |

**Components read from `Signals`:**

| Component | Signal |
|---|---|
| lev.sticky | `stickyMean` |
| lev.run | `p90Run` |
| orc.parallel | `parallelShare` |
| orc.fanout | `fanoutPerEpisode` |
| orc.headless | `headlessPerWeek` |
| orc.background | `backgroundShare` |
| ver.vae | `vae` |
| ver.closure | `closure` |
| ver.guardrails | `guardrails` |
| ste.correction | `correctionRate` |
| ste.interrupts | `healthyInterruptShare` |
| ste.turnsPerWork | `turnsPerWork` |
| ctx.instructions | `maintainedShare` |
| ctx.artifacts | `artifacts` |
| ctx.hygiene | `hygiene` |
| ctx.briefs | `briefScore` |
| jud.switches | `switchesPerWeek` |
| jud.rho | `rho` |
| jud.cost | `tokensPerLanded` |
| del.landed | `landedShare` |
| del.rework | `reworkShare` |
| del.prs | `prsPerWeek` |

These components need repo signals: ver.guardrails, ctx.instructions and all three del.* components. Without repo signals they are `not-measured`.

**Evidence parts** (the spec's minimums; `Evidence` field ≥ minimum):

| Dimension | Parts |
|---|---|
| leverage | `typedTurns` ≥ 60 and `sessions` ≥ 5 and `days` ≥ 10 |
| orchestration | `days` ≥ 14 and `episodes` ≥ 20 |
| verification | `editTurns` ≥ 20 |
| steering | `followUps` ≥ 30 |
| context | `episodes` ≥ 20 or `repos` ≥ 3 |
| judgment | `tierEpisodes` ≥ 30 |
| delivery | `editEpisodesInRepo` ≥ 10 |

Delivery is `not-measured` when `repoSignals` is `off` or `git-missing`.

**Results.**
- `insufficient` reports `n` and `needs` of the binding part.
- Confidence uses `weeks = evidence.weeks`, with builder's calls 3–5.
- `dimension.meta.window` is `detail`.

- [ ] **Step 1: Write the failing tests.**
  - `normal`:
    - `phi(0) === 0.5`;
    - `phi(1.2816)` ≈ 0.9 (±1e-4);
    - `phi(−1.96)` ≈ 0.025 (±1e-4);
    - `phiInv(0.975)` ≈ 1.95996 (±1e-4).
  - `transform`:
    - logit of rate 0 with n 0 → 0;
    - logit of rate 1 with n 1,000 → `logit(0.98)`, i.e. 3.8918;
    - log1p of −3 → 0;
    - atanh of 1 → `atanh(0.95)`.
  - `reference`:
    - v0 loads 22 components, whose ids equal the component table's;
    - every `p90 > p50`, and every rationale is non-empty.
  - `score`:
    - **At the anchors:**
      - every signal at its p50, with evidence at 10× the minimum and 6 weeks → every dimension scores 50, `high`;
      - every signal at its p90 → each score is 88 (z = 1.2816, shrunk by 10/11);
      - `displayScore(2.4)` → `{99, openTail: true}`, and `displayScore(2.2)` (98.6, shown as 99) → `{99, openTail: true}` (pre-flight P16).
    - **Repo signals off:**
      - Verification scores from vae and closure, with weights 0.625 and 0.375;
      - Delivery is `not-measured`.
    - **Evidence:**
      - Leverage with 59 turns → `insufficient`, with `{n:59, needs:60}`;
      - Context with 3 repos and 5 episodes → ratio 1, `low`.
    - **Degenerate input** (Review Focus 2): all rates 0 with n 10,000, all counts 0, `rho` null → finite z or `not-measurable`, never NaN.
- [ ] **Step 2: Run** `bun test test/core/scoring` → FAIL.
- [ ] **Step 3: Implement** the scoring modules and `v0.json`, exactly as pinned.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(scoring): reference v0, components, dimensions with evidence, confidence and shrinkage`.

---

### Task 8: Bootstrap intervals, overall and bands

**Files:**
- Create: `core/scoring/{random,bootstrap,overall}.ts`, `test/core/scoring/{bootstrap,overall}.test.ts`

**Interfaces:**
```ts
export function mulberry32(seed: number): () => number;
export interface BootstrapResult { intervals: Partial<Record<DimensionId, [number, number]>>; overall: [number, number] | null; B: number }
export function bootstrap(stats: readonly SessionStats[], g: Globals, ref: ReferenceTable, included: readonly DimensionId[], o: { B: number; seed: number }): BootstrapResult;
export type Band = "exceptional" | "strong" | "developing" | "limited" | "insufficient";
export interface Overall { status: "scored" | "insufficient"; z: number | null; score: number | null; interval: [number, number] | null;
  band: Band; included: DimensionId[]; coverage: string /* "6/7" */; meta: MetricMeta }
export const WEIGHTS: Readonly<Record<DimensionId, number>>;   // verification 0.20; leverage, orchestration, steering, context 0.15; judgment, delivery 0.10
export function overall(dims: readonly DimensionResult[], interval: [number, number] | null): Overall;
```

**Rules.**
1. B defaults to 200.
2. One replicate resamples `stats` with replacement, keeping the same count, then runs `computeSignals(sample, g)` and `scoreDimensions`.
3. In each replicate:
   - each dimension's z′ shrinks with the point estimate's evidence ratio, not the replicate's, since resampled duplicates add no distinct days (pre-flight P23);
   - the overall z uses the point estimate's `included` set.
4. Intervals follow builder's call 7.
5. `overall` follows builder's call 6. Its `coverage` is `"<scored dimensions>/7"`.

- [ ] **Step 1: Write the failing tests.**
  - **Degenerate:** a single-row sample → every interval is `[s, s]` (Review Focus 2).
  - **Seeds:** the same seed twice gives equal results; with B = 200, the interval ranks are 4 and 195.
  - **Coverage:** on a synthetic 50-row sample, every interval contains its point score.
  - **Overall:**
    - with 2 dimensions at medium → `insufficient`;
    - weights renormalize over the included dimensions;
    - the band edges are 34/35, 59/60 and 79/80.
- [ ] **Step 2: Run** `bun test test/core/scoring` → FAIL.
- [ ] **Step 3: Implement** the random generator, the bootstrap and the overall.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(scoring): session bootstrap intervals, overall band and coverage`.

---

### Task 9: Persona fixtures and calibration

**Files:**
- Create: `test/fixtures/personas.ts`, `test/core/scoring/calibration.test.ts`

**Interfaces:**
- Signature: `personaScan(kind: "novice" | "intermediate" | "expert", o?: { now?: number; hourUtc?: number; canaries?: boolean }): ScanResult`. With `canaries: true`, its config names, cwds and model ids embed canaries (pre-flight P13). Each canary model id is a canary value with no vendor prefix (for example `CANARY.slug`), so `modelExportId` maps it to `other` (P3 pre-flight F25).
- It builds events, coverage and `RepoSignals` directly, with no files.
- It is deterministic, with no RNG: shares are spread with `spread(i, share) = floor((i+1)·share) > floor(i·share)`.
- Activity sits at `hourUtc`, default 12.

**Persona knobs** (pinned; "after a gap" means more than 30 min):

| knob | novice | intermediate | expert |
|---|---|---|---|
| detail weeks · active days per week | 6 · 2 | 12 · 4 | 20 · 5 |
| human top-level sessions per week | 1 (pre-flight P11) | 8 | 24 |
| episodes per session (2nd and later after a gap) | 3 | 5 sessions of 1, 3 sessions of 2 | 1 |
| typed turns per episode | 4 | 4 | 3 |
| actions per turn (main) | 2 | 7 | 12 |
| finished children per episode × actions each | 0 | 0.5 × 8 | 2.5 × 15 |
| background share of children | — | 0.1 | 0.45 |
| non-sticky turns | 0.35 | 0.2 | 0.1 |
| code-edit turns · verified share | 0.5 · 0.15 | 0.6 · 0.40 | 0.6 · 0.75 |
| code-edit file extension (pre-flight P12) | sh | tsx | go |
| failing checks closed | 0.40 | 0.65 | 0.85 |
| briefs followed by a correction · healthy interrupts | 0.30 · 0.25 | 0.15 · 0.5 | 0.06 · 0.75 |
| parallel share of active buckets · headless runs per week | 0.02 · 0 | 0.10 · 1 | 0.35 · 12 |
| brief structure score | 0.2 | 0.4 | 0.65 |
| compactions (auto : manual) | 1 per session : 0 | 1 per 2 sessions : 0 | 7 : 3 per 10 sessions |
| deliberate switches per lifetime week · tier–size ρ | 0.2 · ≈ 0 | 1 · ≈ 0.15 | 4 · ≈ 0.45 |
| fresh tokens per landed unit | 1.5 M | 600 k | 250 k |
| repos with identity · edit episodes landed ≤ 24 h | 1 · 0.2 | 3 · 0.45 | 5 · 0.8 |
| rework share · PRs per active week | 0.25 · 0.1 | 0.12 · 1 | 0.05 · 5 |
| guardrails (per-repo mean) · repos with maintained instructions | 0 · 0 of 1 | 0.33 · 1 of 3 | 0.8 · 4 of 5 |
| used artifacts (authored, installed) | (0, 0) | (2, 3) | (8, 6) |

- [ ] **Step 1: Write the failing tests.**
  1. **Ordering.** Wherever two personas both score, novice < intermediate < expert, strictly: on z′ for every dimension and on x for every component.
  2. **No saturation.** No persona has an `openTail`, a score above 98, or a score below 2.
  3. **Intermediate centred.**
     - Every dimension is scored at medium or high confidence.
     - Each dimension score is in [35, 65].
     - The overall is in [40, 60], with band `developing`.
  4. **Expert.**
     - Every dimension is medium or high.
     - Each dimension score is ≥ 75.
     - The overall band is `exceptional`.
  5. **Novice.** Orchestration is `insufficient`, and the overall is `insufficient` (no dimension at medium).

  If a calibration test fails, fix the analysis or the generator. Never edit the anchors, and say so in the report.
- [ ] **Step 2: Run** `bun test test/core/scoring/calibration.test.ts` → FAIL.
- [ ] **Step 3: Implement** the generator so that it realizes the knobs exactly.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `test(scoring): novice, intermediate and expert personas order and never saturate`.

---

### Task 10: Exposure, unscored panels, project labels and personas

**Files:**
- Create: `core/analysis/{exposure,panels,labels}.ts`, `core/scoring/roles.ts`, `test/core/analysis/{exposure,panels}.test.ts`, `test/core/scoring/roles.test.ts`

**Interfaces:**
```ts
export type Feature = "subagents" | "workflows" | "background-agents" | "plan-mode" | "skills" | "mcp" | "headless" | "parallel-sessions" | "model-switching" | "manual-compaction";
export interface Exposure {
  tenureWeeks: Metric; activeWeeks: { detail: Metric; lifetime: Metric };
  weekly: Array<{ week: string; activeDays: number; detailPrompts: number; lifetimePrompts: number }>;   // the 52 ISO weeks ending at now's week
  tools: Array<{ tool: ToolId; window: Window; sessions: number; prompts: number; actions: number; from?: number; to?: number }>;
  rotation: { active90d: ToolId[]; ever: ToolId[] };
  arcs: { prompts: Record<"1" | "2-3" | "4-10" | "11-30" | "31+", number>; medianPrompts: number | null; durations: Record<"<10m" | "10-60m" | "1-4h" | ">4h", number> };
  firstSeen: Partial<Record<Feature, number>> }   // model counts are private: panels().privateModels (pre-flight P13)
export interface Stack { languages: Partial<Record<EditLang, number>>; toolchains: Partial<Record<Toolchain, number>>; techCategories: Partial<Record<TechCategory, number>>;
  roleEdits: Partial<Record<"frontend" | "backend" | "mobile" | "data", number>>;   // code edits per stack role, from editExt (pre-flight P12)
  meta: MetricMeta }
export interface RiskPosture { permission: Record<string, number>; approval: Record<string, number>; sandbox: Record<string, number>; meta: MetricMeta }
export interface ConfigPanel { byKind: Partial<Record<ConfigEv["kind"], { authored: number; installed: number; other: number; used: number }>>; hooksDisabled: boolean; memoryFiles: number }
export interface CoveragePanel { rows: Array<{ tool: ToolId; window: Window; sources: Array<{ source: string; status: CoverageEv["status"]; beta: boolean }>;
  from?: number; to?: number; sessions: number; prompts: number; formatChanged: boolean }> }
export interface DayParts { night: number; morning: number; afternoon: number; evening: number }
export interface ProjectSummary { key: string; label: string; sessions: number; activeWeeks: number; tools: ToolId[]; inRepo: boolean; lastWeek?: string }
export function exposure(t: SessionTable, raw: ScanResult, o: { now: number; timeZone: string; firstParallelBucket?: number /* Globals, pre-flight P14 */ }): Exposure;
export function panels(t: SessionTable, raw: ScanResult, o: { timeZone: string }): { stack: Stack; risk: RiskPosture; config: ConfigPanel; coverage: CoveragePanel; dayParts: DayParts;
  privateConfig: Array<{ kind: ConfigEv["kind"]; name: string; key: string /* keyedHash(raw.salt, name), pre-flight P15 */; provenance: ConfigEv["provenance"]; used: boolean }>;
  privateModels: Record<string, number> /* raw model id → count, pre-flight P13 */ };
export function projectLabels(salt: Uint8Array, keys: Iterable<string>): Map<string, string>;   // "P-" + upper-case 4 hex of keyedHash(salt, "label:" + key); 6 hex for keys that collide
export function projects(t: SessionTable, labels: Map<string, string>): ProjectSummary[];
export function roles(dims: readonly DimensionResult[], stack: Stack): string[];
```

**Rules.**
- **Prompt window per tool.** Where an analysis needs prompts and a tool has prompts in both windows, it uses the window with more human prompts for that tool. This applies to `techCategories`, `dayParts` and `weekly` (which reports the two windows separately).
- **`firstSeen`** is the minimum `ts` of the first evidence for each feature:

  | Feature | First evidence |
  |---|---|
  | subagents | a subagent row |
  | workflows | a `workflowId` |
  | background-agents | `background: true` |
  | plan-mode | a plan marker without `proxyTs`, or a `plan` tool |
  | skills | a `skill` tool, or a skill's `firstSeen` |
  | mcp | an `mcp` tool |
  | headless | a scripted top row |
  | parallel-sessions | the first parallel bucket: `o.firstParallelBucket`, with no second walk (pre-flight P14) |
  | model-switching | a `model-switch` marker |
  | manual-compaction | a `compact-manual` marker |

- **Stack.**
  - `languages` count detail edit actions by `langOfExt`.
  - `toolchains` count check actions.
  - `techCategories` sum `PromptFeatures.techCats` over human prompts.
- **Risk posture.**
  - `permission` counts sessions per `permission-mode` detail.
  - `approval` and `sandbox` count rows per value.
- **Coverage panel.**
  - Rows come from `raw.coverage`, grouped by tool and window.
  - `formatChanged` is true when any source in the row has drift.
- **Day parts** count human prompts by local hour: [0, 6), [6, 12), [12, 18), [18, 24).
- **Roles:**
  - **Practice roles.** A role is eligible when its dimension is scored at medium or above, with a score ≥ 60:

    | Dimension | Role |
    |---|---|
    | leverage | Force multiplier |
    | orchestration | Orchestrator |
    | verification | QA |
    | steering | Navigator |
    | context | Context engineer |
    | judgment | Right-sizer |
    | delivery | Shipper |

  - **Stack roles.** A stack role is eligible when its share of code edits is ≥ 25% and there are ≥ 50 such edits:

    | Stack role | Edits counted |
    |---|---|
    | Frontend | tsx, jsx, vue, svelte, css, scss, html |
    | Backend | py, go, rust, jvm, dotnet, ruby, php, and the other js extensions |
    | Mobile | swift, kt, dart |
    | Data | sql, ipynb |
    | AI engineer | `techCategories.ai` is the largest category, with ≥ 30 prompts |

    `panels` counts each code edit toward at most one role, by its `editExt`, into `Stack.roleEdits`. The Frontend, Mobile and Data extensions are matched first; Backend takes the remaining py, go, rust, jvm, dotnet, ruby, php and js extensions. A role's share is its count over all code edits (pre-flight P12).

  - **Picking.** Take first the strongest stack role, if any, then practice roles by z in descending order, until there are 3. Break ties by role name.
  - **No percentages** anywhere.

- [ ] **Step 1: Write the failing tests.**
  - **Exposure:**
    - tenure and weeks come from the lifetime days only;
    - `weekly` has 52 entries, and the last one is now's week;
    - a tool active 100 days ago is in `ever` but not in `active90d`;
    - the arcs buckets;
    - `firstSeen` for each feature, on a hand-built table.
  - **Panels:**
    - stack counts, including `roleEdits`: `kt` counts as Mobile, `ipynb` as Data, `tsx` as Frontend and `ts` as Backend (pre-flight P12);
    - risk counts;
    - `config.byKind` provenance and used counts;
    - `hooksDisabled` from the feature event;
    - a coverage row with drift has `formatChanged: true`;
    - day parts at the hour boundaries.
  - **Labels:** 5 keys give 5 distinct labels matching `^P-[0-9A-F]{4}$`; a forced collision gives 6 hex for the colliding keys.
  - **Roles:**
    - with Task 9's pinned extensions (pre-flight P12), the expert persona's roles are Backend (its `go` edits), then the roles of its top-z dimensions; the intermediate's first role is Frontend (its `tsx` edits);
    - the novice gets none (its `sh` edits count toward no role, pre-flight P12);
    - each role list has at most 3 entries and no duplicates.
- [ ] **Step 2: Run** `bun test test/core/analysis test/core/scoring/roles.test.ts` → FAIL.
- [ ] **Step 3: Implement** exposure, panels, labels and roles.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(analysis): exposure, agent-touched stack, risk, config, coverage, labels and roles`.

---

### Task 11: Forensics I — Claude Code anchors, history, account and file times (C1–C5)

**Files:**
- Create: `core/forensics/{types,anchors,claude,files}.ts`, `test/core/forensics/{anchors,claude,files}.test.ts`

**Interfaces:**
```ts
export type CheckStatus = "pass" | "note" | "warn" | "fail" | "n/a" | "info";
export type CheckId = "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7" | "C8" | "C9" | "C10"
  | "soft:rhythm" | "soft:repeated-long" | "soft:recent-burst" | "soft:unclosed-tools" | "soft:new-config";
export interface CheckResult { id: CheckId; status: CheckStatus; n: number; reason: string; values: Record<string, number | string>; askAbout?: string; tools: ToolId[] }
export function checkAnchors(raw: ScanResult): [CheckResult, CheckResult];    // C1, C2
export function checkClaudeHistory(raw: ScanResult, t: SessionTable): CheckResult;   // C3
export function checkAccount(raw: ScanResult): CheckResult;                   // C4
export function checkFileTimes(raw: ScanResult, o: { timeZone: string }): CheckResult;   // C5
```

**Algorithms.**
- **C1 and C2**, per anchor kind (`cc-msg`, `cc-req`). The worse result of the two kinds wins.
  1. **Recognized scheme:** `idTail` starts with the 2-char marker `01`, which at least 90% of that kind's anchors share, and `idTail.slice(2)` matches `/^[1-9A-HJ-NP-Za-km-z]{20,40}$/` (pre-flight P7). Anchors that do not match are excluded.
  2. Fewer than 50 recognized anchors → `n/a` (`too-few`).
  3. **Decoded value:** `v = Number(base58(idTail.slice(2, 14)) − min over the sample)`, computed with BigInt (pre-flight P7).
  4. **Fit:** ordinary least squares of `ts` on `v`, over a deterministic stride sample of at most 5,000 anchors. Refit once without the points whose |residual| > 10 min.
  5. A median |residual| > 10 min → `n/a` (`scheme-changed`).
  6. **C1** fails when more than 1% of the anchors are off by more than 10 min. Its values are `offShare` and `p99Seconds`.
  7. **C2** is Spearman of `v` against `ts` over a stride sample of at most 20,000. It fails below 0.99, and is `n/a` wherever C1 is `n/a`.
- **C3.**
  - **Match:** the share of human transcript prompts (`claude-code.transcripts`, detail) that have a `claude-code.history` prompt with an equal `textHash` within 10 s.
    - Only prompts inside the history's span count.
    - Below 75%, the result is `warn`.
  - **Missing days:** UTC days that have human transcript prompts, fall inside the span of the `claude-code.stats` days, and have no stats `DailyEv`. Builder's call 8 decides fail or note.
  - `n/a` when either side is empty.
- **C4.**
  - Compare session `IdentityEv` hashes with config hashes.
  - A 0% match → `fail`.
  - More than 1 distinct session hash → `note`, with the value `accounts`.
  - `n/a` when either side is missing.
- **C5**, over `FileFactEv`.
  - **Violations:** a file violates when either holds:
    - `mtime < lastTs − 2 s`;
    - `ctime − mtime > 24 h`, unless the file is in the restore cluster.
  - **Restore cluster:**
    - find the 10-min window holding the most file births (birth, else ctime);
    - it is a cluster when it holds at least 80% of the files, and those files' events span more than 7 days;
    - a cluster gives `note` with the value `date` (local `YYYY-MM-DD`).
  - **Thresholds:** fail and minimum file count follow builder's call 8.
- **Ask-about wording.** Each check gets one fixed English question that names only numbers and dates. For example, C5's note asks: "Most trace files were created on {date} although their activity spans {days} days. Was this history copied or restored from a backup then?" Every `reason` and `askAbout` string, in this task and Task 12, uses only characters Plan 3's fonts cover (U+0020–00FF, U+2000–206F and `−` U+2212): words such as "at least", "at most", "to" and "about", never ≈ → ≤ ≥ (P3 pre-flight F1).

- [ ] **Step 1: Write the failing tests.** These include the §10 tamper suites (edited timestamps, copied directories, LLM-fabricated JSONL), each of which must be flagged.
  - **C1/C2:**
    - A genuine-like set: 2,000 anchors whose `idTail` is `01` followed by base58 that encodes time linearly, the shape the reader emits → C1 `pass`, C2 `pass` (pre-flight P7).
    - **Edited timestamps:** shift 3% of the anchors by +2 h → C1 `fail`.
    - **Fabricated:** append a session of 100 random base58 ids at plausible times → C1 `fail`.
    - Every id out of scheme → `n/a`.
    - Reversed order → C2 `fail`.
  - **C3:**
    - 10 transcript prompts, 9 of them in history → `pass`;
    - 6 of 10 in history → `warn`;
    - 3 transcript days missing from the stats span → `fail`;
    - a day after the stats span → not counted.
  - **C4:**
    - matching hashes → `pass`;
    - no match → `fail`;
    - 2 session accounts → `note`.
  - **C5:**
    - clean files → `pass`;
    - 3 files with `mtime < lastTs` → `fail`;
    - **copied directory:** 20 files all born within one 10-min window, spanning 30 days of events → `note`, with that date;
    - in a restore cluster, `ctime ≫ mtime` is not a violation;
    - 4 files → `n/a`.
- [ ] **Step 2: Run** `bun test test/core/forensics` → FAIL.
- [ ] **Step 3: Implement** C1–C5 and their ask-about texts.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(forensics): C1–C5 — server ids, history consistency, account, file times`.

---

### Task 12: Forensics II — Codex checks, release dates, provenance, soft flags, band (C6–C10)

**Files:**
- Create: `core/forensics/{codex,releases,provenance,soft,index}.ts`, `core/forensics/releases.json`, `test/core/forensics/{codex,releases,soft,band}.test.ts`

**Interfaces:**
```ts
export interface ReleaseTable { version: number; models: Array<{ match: string /* RegExp source */; released: string /* YYYY-MM-DD */; source: string }>;
  tools: Partial<Record<ToolId, Array<{ version: string; released: string; source: string }>>> }
export function checkRollouts(raw: ScanResult, o: { now: number }): [CheckResult, CheckResult, CheckResult];   // C6, C7, C8
export function checkReleases(t: SessionTable, table: ReleaseTable): CheckResult;   // C9
export function provenance(raw: ScanResult, t: SessionTable): CheckResult;          // C10: info, prompt counts by tool × origin × window
export function softFlags(raw: ScanResult, t: SessionTable, o: { now: number; timeZone: string }): CheckResult[];
export interface Forensics { band: "consistent" | "consistent-with-notes" | "inconsistent" | "unverifiable"; serverBacked: number | null;
  anchorable: ToolId[]; notAnchorable: ToolId[]; checks: CheckResult[] }
export function runForensics(raw: ScanResult, t: SessionTable, stats: readonly SessionStats[], o: { now: number; timeZone: string; releases?: ReleaseTable }): Forensics;
```

**Rules.**
- **C6.**
  - Each `RolloutFactEv` needs a `ThreadRowEv` with the same `threadId`.
  - Any rollout missing one → `fail`.
  - Rollouts with `fileTs` within 10 min of `now` are excluded.
  - `n/a` when `codex.threads` coverage is not `ok` or `drift` with records > 0, or when there are no rollouts.
- **C7.**
  - A violation is `uuidTs − fileTs > 1,000 ms`.
  - An offset that is a non-zero whole number of quarter hours, within ±2 s, up to 14 h, is a time-zone change: `note`, not a violation (pre-flight P17).
  - Any violation → `fail`.
- **C8.**
  - Per (bucket, window): sort by `ts`.
  - Pair consecutive snapshots of one reset window: `|resetsAt diff| ≤ 60 s`. Without `resetsAt`, use the same `windowMinutes` and a gap below it.
  - A contradiction is a drop of more than 2 points. Builder's call 8 decides the thresholds.
- **C9.**
  - **Matching:** a session's model matches the first `match`; its version matches an exact tool entry.
  - **Violation:** a session `start` more than 2 days before the matched release date.
  - **Result:** any violation → `fail`; `n/a` when nothing matches.
  - **Shipped `releases.json`:** only entries whose public release date is certain to the builder, each with a public `source` URL. An unlisted model or version is not checked. Tests inject their own table. It loads with `import … with { type: "json" }`, so a compiled binary carries it (P3 pre-flight F17).
- **Soft flags:**

  | Flag | Raised when |
  |---|---|
  | rhythm | the coefficient of variation of the gaps (< 30 min) between consecutive human prompts of one session is < 1.0, with ≥ 50 gaps |
  | repeated-long | any `textHash` with `features.chars ≥ 200` occurs ≥ 5× among human prompts; the value is the count of such hashes |
  | recent-burst | ≥ 50% of lifetime active days fall in the 14 days before `now`, and the lifetime span is > 60 days |
  | unclosed-tools | > 10% of Claude Code detail `ToolEv`s have neither `ok` nor `outcome` |
  | new-config | used artifacts with `firstSeen ≥ now − 7 days`; the value is their count |

  A raised flag is a `note`; otherwise `pass`. Every flag is `n/a` without data. `rhythm` and `repeated-long` take each tool's prompts from one window, by Task 10's prompt-window-per-tool rule (pre-flight P18).
- **Band:**
  - `inconsistent` if any check fails.
  - Otherwise `consistent-with-notes` if any check is `warn` or `note`, or any soft flag is raised.
  - Otherwise `consistent` if at least one of C1–C9 passed.
  - Otherwise `unverifiable`.
- **Anchorable tools.** `claude-code` and `codex` are anchorable. `cursor`, `copilot`, `antigravity` and P2 tools are not.
- **Server-backed share** (display only) = typed turns from tools whose server checks passed or noted (claude-code: C1 and C2; codex: C8) / all typed turns, both summed from `stats`.

- [ ] **Step 1: Write the failing tests.** These include the §10 spliced-ledger tamper suite, which must be flagged.
  - **C6:**
    - every rollout has a row → `pass`;
    - 1 rollout missing its row → `fail`;
    - a rollout named 2 min before `now` is ignored;
    - no thread store → `n/a`.
  - **C7:**
    - `uuidTs` 1 s before `fileTs` → `pass`;
    - 2 s after → `fail`;
    - an offset of exactly +3 h → time-zone `note`.
  - **C8:**
    - a monotone ledger → `pass`;
    - **spliced ledgers:** two accounts' snapshots interleaved in one window → `fail`, with the "more than one account" ask-about;
    - 10 pairs → `n/a`.
  - **C9:** with an injected table, a model used 5 days before its release → `fail`; 1 day before → `pass`.
  - **Soft flags:** each one's raise and pass cases. A long prompt present in both windows counts once toward `repeated-long` (pre-flight P18).
  - **Band:**
    - only Cursor and Copilot data → `unverifiable`, with `notAnchorable` listing them;
    - a C3 warn and nothing failing → `consistent-with-notes`;
    - a C1 fail → `inconsistent`;
    - `serverBacked` equals the expected share, and a forensic fail never changes any dimension score.
  - **Wording** (P3 pre-flight F1): every `reason` and `askAbout` that the Task 11 and Task 12 suites produce has every character in U+0020–00FF or U+2000–206F, or is `−` (U+2212).
- [ ] **Step 2: Run** `bun test test/core/forensics` → FAIL.
- [ ] **Step 3: Implement** C6–C10, the soft flags and `runForensics`.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(forensics): C6–C10, soft flags, integrity band and server-backed share`.

---

### Task 13: `analyze()` and the `Analysis` object

**Files:**
- Create: `core/analyze.ts`, `test/core/analyze.test.ts`
- Modify: `core/index.ts`, which exports `analyze`, `AnalyzeOptions`, `Analysis` and the analysis types

**Interfaces:**
```ts
export interface AnalyzeOptions { reference?: "v0"; bootstrap?: number /* 200 */; seed?: number /* 0x5eed */; now?: number /* raw.finishedAt */;
  timeZone?: string /* the process zone */; exclude?: { tools?: ToolId[]; projects?: string[] /* labels or keys */; from?: number; to?: number }; releases?: ReleaseTable }
export interface Analysis {
  meta: { core: string; reference: "v0"; bootstrap: number; seed: number; now: number; timeZone: string; repoSignals: RepoSignals["status"] };
  coverage: CoveragePanel; signals: Signals; dimensions: DimensionResult[]; overall: Overall; personas: string[];
  exposure: Exposure; stack: Stack; risk: RiskPosture; config: ConfigPanel; projects: ProjectSummary[]; forensics: Forensics;
  identity: { accounts: number; hashes: string[] }; exclusions: { tools: number; projects: number; sessions: number };
  diagnostics: { orphans: Partial<Record<Ev["k"], number>>; dedupe: { hostSessions: number; pairedPrompts: number; relabelled: number }; warnings: Warning[] };
  private: { dayParts: DayParts; config: Array<{ kind: ConfigEv["kind"]; name: string; key: string /* pre-flight P15 */; provenance: ConfigEv["provenance"]; used: boolean }>;
    models: Record<string, number> /* raw model id → count, pre-flight P13 */ };
}
export function analyze(raw: ScanResult, o?: AnalyzeOptions): Analysis;
```

**Order of work:**
1. Defaults and the reference table.
2. `projectLabels`, then resolve labels in `exclude.projects` to keys.
3. `buildSessionTable`.
4. `buildSessionStats`.
5. `computeGlobals`.
6. `computeSignals`.
7. `scoreDimensions`.
8. `bootstrap`, which writes the intervals.
9. `overall`.
10. `exposure` (given `Globals.firstParallelBucket`, pre-flight P14), then `panels`.
11. `projects`.
12. `roles`.
13. `runForensics`.
14. `identity`: the distinct `IdentityEv` hashes.

The result is plain data. It contains no `Map`, `Set`, class instance or function, and no non-finite number.

- [ ] **Step 1: Write the failing tests.**
  - **Determinism:** `analyze(personaScan("expert"))` run twice is deep-equal; `JSON.parse(JSON.stringify(a))` deep-equals `a`; a walker finds only finite numbers.
  - **Every metric has its meta:** every object with a numeric or null `value` also has `window`, `n` and `sources`.
  - **Canaries:** `expectNoCanaries({ ...a, private: undefined })` on `personaScan("expert", { canaries: true })`, whose config names, cwds and model ids embed canaries (pre-flight P13). With `allow` empty, the canaries appear only under `private`.
  - **Exclusions:** excluding the expert's busiest project by label gives `exclusions.projects === 1`, and that project's sessions are gone.
  - **Review Focus 1:**
    - **Empty `ScanResult`:**
      - every dimension is `insufficient` or `not-measurable`, with `n` and `needs`;
      - `overall.status` is `insufficient` and `forensics.band` is `unverifiable`;
      - nothing is NaN.
    - **Lifetime-only `ScanResult`:** exposure has tenure and weeks, and every detail dimension is `insufficient`.
  - **Review Focus 3:** `personaScan("intermediate", { hourUtc: 0 })` under UTC and under `Pacific/Auckland`. Every component other than `orc.headless`, `jud.switches` and `del.prs` has an equal `x`.
- [ ] **Step 2: Run** `bun test test/core/analyze.test.ts` → FAIL.
- [ ] **Step 3: Implement** `analyze()` and the exports.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(core): analyze() — a pure, deterministic analysis object`.

---

### Task 14: Privacy layer — allowlisted `aiprof/2` export

**Files:**
- Create: `core/privacy/{schema,export,allowlists,jcs}.ts`, `test/core/privacy/{schema,export,jcs}.test.ts`, `test/core/privacy/__snapshots__/` (generated)
- Modify: `core/index.ts` (exports `exportPayload`, `ExportOptions`, `canonicalJson`)

**Interfaces:**
```ts
// jcs.ts — RFC 8785: keys sorted by UTF-16 code units, no whitespace, ECMAScript number form; throws on non-finite numbers
//   and on a string or key that holds a lone surrogate, as RFC 8785 / I-JSON require (P4 pre-flight G6)
export function canonicalJson(v: unknown): string;
// schema.ts
export type Sensitivity = "public" | "aggregate" | "pseudonymous" | "revealed";
export type FieldSpec =
  | { t: "number" | "integer" | "boolean"; s: Sensitivity } | { t: "enum"; values: readonly string[]; s: Sensitivity }
  | { t: "string"; pattern: RegExp; s: Sensitivity } | { t: "nullable"; of: FieldSpec }
  | { t: "array"; of: FieldSpec; max: number } | { t: "object"; fields: Readonly<Record<string, FieldSpec>> }
  | { t: "record"; key: RegExp; of: FieldSpec; maxKeys: number };
export const AIPROF2: FieldSpec;
export function sanitize(value: unknown, spec: FieldSpec): unknown;   // deny by default: drops undeclared keys and values failing type, pattern or enum; truncates arrays
// allowlists.ts
export const MCP_PUBLIC: ReadonlySet<string>;     // exactly: github, gitlab, git, filesystem, fetch, memory, time, sequential-thinking, playwright, puppeteer, context7, sentry, linear, atlassian, slack, postgres, sqlite, supabase, stripe, cloudflare, vercel, docker, kubernetes, figma, brave-search
export function mcpExportName(raw: string): string | undefined;   // lower-case; strip "@scope/", "server-", "mcp-", "-mcp"; a public name or undefined
export function mcpLabels(config: Analysis["private"]["config"]): Map<string, string>;   // mcp-server entries: key → public name (mcpExportName), else "custom #n" in keyed-hash order; the export's config.mcpServers and B's anonymized report both use it (P3 pre-flight F15)
export function modelExportId(raw: string): string;  // /^(claude|gpt|o\d|gemini|codex|grok|llama|mistral|qwen|deepseek)[a-z0-9.\-]{0,40}$/ kept; "ft:" → "fine-tuned"; else "other"
// no surfaceExport: no exported field carries a surface, so surfaces never leave the machine (pre-flight P15)
// export.ts
export interface ExportOptions { schema: "aiprof/2"; reveal?: Array<{ label: string; name: string }> }
export interface ExportResult { schema: "aiprof/2"; value: unknown; json: string; bytes: number }
export function exportPayload(a: Analysis, o: ExportOptions): ExportResult;
```

**Payload `aiprof/2`.** The tables list each field, its form and its sensitivity class: `pub` (public), `agg` (aggregate), `ps` (pseudonymous), `rev` (revealed).

*Header and scores*

| Field | Form | Class |
|---|---|---|
| `schema` | "aiprof/2" | pub |
| `core` | version | pub |
| `reference` | "v0" | pub |
| `coverage[]` | {tool, window, status, beta, from/to as YYYY-MM, sessions, prompts, formatChanged} | agg |
| `overall` | {status, score, interval, band, coverage} | agg |
| `dimensions[]` | {id, status, score, interval, openTail, confidence, n, needs, window, components[]{id, status, x, z, n, weight}}; `x` and `z` rounded to 4 decimals (pre-flight P22) | agg |
| `personas[]` | role names | pub |
| `signals` | every `Metric` as {value, n, window, from/to as YYYY-MM} | agg |

*Panels*

| Field | Form | Class |
|---|---|---|
| `exposure` | {tenureWeeks, activeWeeks{detail, lifetime}, weekly[] (≤ 52, ISO week keys), tools[] (window, counts, months), rotation, arcs, firstSeen as ISO week, models: `analysis.private.models` under `modelExportId` keys, with counts summed (pre-flight P13)} | agg |
| `stack` | {languages, toolchains, techCategories} | agg |
| `risk` | permission, approval and sandbox as known tokens, else "other", with counts | agg |
| `config` | {byKind counts, hooksDisabled, memoryFiles, mcpServers[]} | mcpServers is pub/ps; the rest agg |
| `projects[]` | ≤ 100, ranked by sessions; {label, name?, sessions, activeWeeks, tools, inRepo, lastWeek}, plus `otherProjects` | label ps; name rev |

`config.mcpServers[]` takes the public name, or `custom #n` numbered in order of keyed hash (`private.config[].key`, pre-flight P15). `mcpLabels(a.private.config)` computes these labels, and B's anonymized report uses the same function (P3 pre-flight F15).

*Integrity and identity*

| Field | Form | Class |
|---|---|---|
| `forensics` | {band, serverBacked, anchorable, notAnchorable, checks[]{id, status, reason, values (numbers; C5 date), askAbout}} | agg |
| `identity` | {accounts, bindings[]} — keyed hashes | ps |
| `exclusions` | counts | agg |

**Tool names.** Tool-call names are never exported; the payload carries categories, checks and toolchains only. That is how "tool names → built-ins only" holds.

**Never exported:**
- `private` (day parts, raw config names);
- `diagnostics`;
- session ids, `textHash`, `pathHash`, `callId`, `idTail`, `projectKey`, repo keys;
- raw model ids, raw surface values, raw tool names;
- any timestamp finer than an ISO week, except C5's date.

- [ ] **Step 1: Write the failing tests.**
  - **jcs:** `canonicalJson({b:1, a:[1, "é"]}) === '{"a":[1,"é"],"b":1}'`; `NaN` throws. A string holding a lone surrogate, `String.fromCharCode(0xd800)`, throws, and so does an object key holding one. A valid pair, `String.fromCodePoint(0x1f600)`, serializes unchanged (P4 pre-flight G6).
  - **schema:** `sanitize` drops an undeclared key, a string failing its pattern, and an out-of-enum value, and truncates an array to `max`.
  - **export:**
    1. **Canaries end to end.** All Plan 1 builders, plus a git repo with canaries, go through `scan`, `analyze` and `exportPayload`. Then `expectNoCanaries(result.json)` passes with no `allow`.
    2. **Raw channels** (no surface case, since no exported field carries a surface: pre-flight P15):
       - model `ft:gpt-4o:acme:x:y` → `"fine-tuned"`;
       - an MCP server named `CANARY.mcp` → `"custom #1"`, while `github` stays `github`, and `mcpLabels` gives the same two labels (P3 pre-flight F15);
       - no `idTail`, session id or `projectKey` string appears in the JSON.
    3. **Reveal:** `reveal: [{label, name:"my-lib"}]` puts `name` on that project only. Without `reveal`, no name appears.
    4. **No fine timestamps:** no day parts, no 13-digit epoch, and no `T\d\d:` timestamp in the JSON.
    5. **Preview contract:** `JSON.parse(result.json)` deep-equals `result.value`, and `result.bytes === Buffer.byteLength(result.json)`.
    6. **Deny by default:** a property added to `analysis.dimensions[0]` is not exported.
    7. **Golden snapshot:** the intermediate persona with a fixed salt, `now`, seed and `TZ=UTC` gives `expect(result.json).toMatchSnapshot()`. Every exported `x` and `z` has at most 4 decimals (pre-flight P22).
    8. **Persona canaries** (P3 pre-flight F25): `exportPayload(analyze(personaScan("expert", { canaries: true })), { schema: "aiprof/2" }).json` passes `expectNoCanaries` with no `allow`.
- [ ] **Step 2: Run** `bun test test/core/privacy` → FAIL.
- [ ] **Step 3: Implement** the schema, the allowlists, canonical JSON and the export.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS. The snapshot is written on the first run; commit it.
- [ ] **Step 5: Commit** `feat(privacy): allowlisted aiprof/2 export with canonical bytes`.

---

### Task 15: Scaling — adaptive GC pacer and the analysis memory budget

**Files:**
- Modify: `core/io/jsonl.ts`, `core/scan.ts`, `test/core/io/jsonl.test.ts` (its positional `GcPacer` test moves to `gcpacer.test.ts`, pre-flight P4)
- Create: `test/kit/synth.ts`, `test/core/io/gcpacer.test.ts`, `test/core/scale.test.ts`

**Interfaces:**
- `GcPacer` becomes adaptive.
  - Signature: `new GcPacer({ checkEvery: number /* 8 MiB */; minRss: number /* 384 MiB */; slack: number /* 128 MiB */ }, collect, rss)`.
  - It checks RSS every `checkEvery` bytes streamed.
  - It collects when `rss > minRss` and `rss − rssAfterLastCollect > slack`, then sets `rssAfterLastCollect = rss()`.
  - `enabled: boolean` is an instance field.
  - `collections` is a read-only counter.
- `ScanOptions.gc?: "auto" | "off"`, defaulting to `auto`. It sets `STREAM_GC.enabled` for the scan and restores it in `finally`. The scan logs `onLog("debug", "scan.gc", collections)`.
- `test/kit/synth.ts`: `synthStore(events: number): ScanResult`.
  - It builds a deterministic mix directly in memory, with no files.
  - The mix uses sessions with subagents, human prompts, tools, usage, anchors, markers and turns, in Claude Code-like proportions, plus `RepoSignals`.

- [ ] **Step 1: Write the failing tests.**
  - `gcpacer.test.ts`, with a fake `rss` and `collect`:
    - live heap fixed at 600 MiB, plus 10 MiB of garbage per 8 MiB read → a collection about every 128 MiB of growth, not every 64 MiB read;
    - `enabled = false` → no collections;
    - a heap that never grows → 0 collections.
  - `scale.test.ts`:
    - **Default (300,000 events):**
      - after `Bun.gc(true)`, `analyze` retains at most 25% of the store's heap, measured as the delta in `heapUsed` before and after with the result held;
      - it runs in ≤ 5 s;
      - the export is ≤ 300 KB.
    - **`SLOW=1` (3,000,000 events):** the same 25% bound, and ≤ 30 s. This test runs locally only and writes no files.
- [ ] **Step 2: Run** `bun test test/core/io/gcpacer.test.ts test/core/scale.test.ts` → FAIL.
- [ ] **Step 3: Implement** the adaptive pacer, the option and the synthetic store. Fix any per-event copy in the analysis that the budget exposes.
- [ ] **Step 4: Run** `bun test && SLOW=1 bun test test/core/scale.test.ts && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `perf(core): adaptive GC pacer with opt-out; analysis memory budget pinned at scale`.

---

### Task 16: Integration, smoke, local acceptance, PR

**Files:**
- Create: `test/core/analysis.integration.test.ts`
- Modify: `scripts/smoke-local.ts`, `test/scripts/smoke.test.ts`, `core/index.ts` (final exports, plus `REPO_SIGNALS_DESCRIBE`, plus the values `buildSessionTable`, `isAction`, `childType` and `modelExportId`, which Plans 4 and 5b import through `ai-practice-report/core` (P5 pre-flight J5))

**Interfaces:**
- The smoke runs `scan()`, then `analyze()` and `exportPayload()`, sampling RSS across all three.
- It adds only counts and pass/fail lines:
  - `analysis elapsed=<s>`
  - `dimensions scored=<k>/7`
  - `not-saturated=<PASS|FAIL>`
  - `metrics-have-window-and-n=<PASS|FAIL>`
  - `export-no-raw-paths=<PASS|FAIL>`: the JSON contains no home path, no cwd from `r.cwds`, and no root from `r.repos.roots`
  - `export-under-300kb=<PASS|FAIL>` (pre-flight P19)
  - `forensics-ran=<PASS|FAIL>`
  - `repo-signals=<status> repos=<n>`
- Exit 1 when any of these hold:
  - any analysis check fails;
  - scan plus analyze takes more than 60 s;
  - peak RSS exceeds 1 GiB.
- `not-saturated` passes when every scored dimension with a display score of 99 carries `openTail` (scores are clamped to [1, 99], so none can read 100). Every displayed 99 sets `openTail` (pre-flight P16), so this line guards that invariant.

- [ ] **Step 1: Write the failing integration test.**
  - **Setup:**
    - A `fakeHome` with all Plan 1 builders.
    - Two real git repos (`test/fixtures/repos.ts`), each with instruction files and CI.
    - One extra Claude Code transcript whose `cwd` is repo 1.
  - **Scan expectations:**
    - every P0 plugin reports coverage;
    - `r.repos.status === "ok"`;
    - the analysis has 7 dimension entries, each with an allowed status;
    - the metric walker passes;
    - every number is finite.
  - **Export expectations:**
    - the export passes `expectNoCanaries` with no `allow`;
    - it is ≤ 300 KB;
    - two `analyze` runs are deep-equal;
    - `forensics.band` is one of the 4 values.
  - **Repo signals off:** `scan({ repoSignals: false })` gives Delivery `not-measured`, and guardrails and instructions components `not-measured`.
  - **Review Focus 1:** an empty home gives a valid export, every dimension insufficient or not-measurable, and forensics `unverifiable`.
  - **Value exports** (P5 pre-flight J5): `import { buildSessionTable, isAction, childType, modelExportId } from "../../core/index"` compiles, and each is a function.
  - Extend `smoke.test.ts` for the new lines (same grammar, with `PASS`/`FAIL` tokens allowed).
- [ ] **Step 2: Run** → FAIL until the smoke and the exports are complete. **Step 3: Implement.** **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Local acceptance (P2).**
  - Run `bun scripts/smoke-local.ts` against the real HOME, outside the sandbox if it blocks reads. Expect exit 0 and every line `PASS`.
  - Confirm that no `$TMPDIR/aipr-*` is left: `ls -d "$TMPDIR"/aipr-* 2>/dev/null | wc -l` → 0.
  - Keep only the pass/fail lines for the PR. No values go into the repo, the PR, or reports.
- [ ] **Step 6: Commit, push, open the PR.** Do not merge: the final whole-branch review comes first.
```bash
git add -A && git commit -m "feat(core): analysis integration, smoke and P2 acceptance

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
# EtherHiding config scan → nothing printed
git push -u origin feat/core-analysis
gh pr create --base main --title "Core analysis: repo signals, signals, scoring, forensics, privacy" --body "<summary + P2 acceptance pass/fail lines + checklist; no figures from the owner's machine>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch   # green on ubuntu/macos/windows + security guard
```
