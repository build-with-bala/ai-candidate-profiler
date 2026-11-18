# Plan 3 — AI Practice Report app and the shared viz kit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Paths.** `<A>` and `<B>` stand for the roots of the local checkouts of A (`build-with-bala/ai-candidate-profiler`) and B (`build-with-bala/ai-practice-report`). `<research>` stands for the private research notes, which are in neither repo. `<scratch>` stands for the session scratchpad, a folder outside both repos. The controller gives the concrete paths at dispatch.

**Goal:** Build three things:
- the shared "assay certificate" visual system and viz kit in `core/viz/`, exported as `renderKit` and as `ai-practice-report/viz`;
- pre-binned exhibit data in `core/exhibits/`;
- B's app in `app/`: the `ai-practice` CLI. It writes a private, single-file, offline HTML report, plus, when asked, a share card and an unsigned `aiprof/2` employer export.

**Architecture:**
- **`core/viz/`** is a pure rendering vocabulary with no dependencies. It holds:
  - pinned tokens for three themes (ink, paper, print);
  - OFL fonts, embedded at render time from committed `.woff2` files;
  - SVG-string primitives that share one mark grammar;
  - a document shell that pins its own CSP by hash;
  - `auditHtml()`, which every render test runs.
- **`core/exhibits/`.** `computeExhibits(raw, a)` pre-bins the four exhibits that `Analysis` cannot express:
  - a day under the loupe;
  - the delegation tree;
  - per-tool habit lanes;
  - then and now.

  It rebuilds Plan 2's session table, and its output holds no free text.
- **`app/`** turns a `ScanResult`, its `Analysis`, the exhibits and the options into a deterministic `ReportModel`. It renders the model with the kit and writes the files the CLI asks for. Real names, meaning project folders and the person's own config names, exist only in the private report.

**Tech Stack:**
- Bun 1.3.11, TypeScript 5 (`strict`) and `bun test`.
- `node:crypto`, for the CSP hashes and the report number.
- Fonts: Fontsource 5.3.0 subsets of Archivo, JetBrains Mono and Newsreader (OFL 1.1).
- Playwright, from an install outside the repo, for visual QA only.
- No runtime dependencies.

**Spec:** `<A>/docs/superpowers/specs/2026-11-17-ai-leverage-suite-v2-design.md`.
- This plan implements:
  - §6.8, the shared visual system;
  - §6.9's `renderKit`;
  - §7.1, the CLI, without `--keep-history`, `--coach` and `--purge`;
  - §7.2, the report, without coach notes and month-over-month;
  - §7.5, the share card and the employer export;
  - B's name surfaces from §6.7;
  - the matching §10 tests and visual QA;
  - the §11 P3 acceptance.
- §2, §3, §13 and §14 bind every task.

**Builds on Plan 2:** `<A>/docs/superpowers/plans/2026-11-17-plan-2-core-analysis.md`, as merged into `main`.
- This plan consumes the names that Plan 2's Interfaces blocks state, mostly from Tasks 4–14.
- Task 1 re-verifies those names on `main` and stops if any differs.

**Research (private):** `<research>/05-report-design.md` (main), `04-product-workflow.md`, and `03-trust-privacy.md` §6. Never commit them, and never quote values from them.

**Repo and branch:** B lives at `<B>`.
- The controller creates `feat/practice-report` from `main` once Plan 2's PR is merged.
- Task 17 opens the PR into `main`. It is merged only after the final whole-branch review.

**Out of scope:**
- **Plan 4:** A's app. That includes its dossier and compare console, which reuse this kit, and any decision to carry exhibit data in `aiprof/2`.
- **Plan 5:**
  - the coach (§7.3);
  - history and month-over-month (§7.4);
  - the `--keep-history`, `--coach` and `--purge` flags;
  - the P1 and P2 tools, and WSL.
- **Plan 6:** the release workflows, the 5-target build, the README and polish of the methodology docs.

## Global Constraints

Plan 2's Global Constraints carry over unchanged. They cover the platform, SQLite, free text, what is read, repository content, real data, reading and temp files, network and git, identity and logging, analysis, performance, signals, tests, and commits and pushes. This plan adds the constraints marked ✚.

**Dependencies and tools**
- ✚ No runtime dependencies. The only devDependencies stay `typescript` and `@types/bun`.
- ✚ Playwright is used from an install outside the repo. It is never added to `package.json`.
- ✚ No font tool is used: the committed files are already Latin subsets.
- ✚ The network is used only at dev time. `bun scripts/fonts-fetch.ts` runs once, in Task 2, with `dangerouslyDisableSandbox: true`. CI never fetches.

**Core boundaries**
- ✚ `core/viz/` and `core/exhibits/` are pure.
  - They do no file I/O, except through `readAsset` (Task 2, in `core/io/`).
  - They spawn nothing.
  - They never call `Date.now()` and use no randomness.
  - They use no `Intl` and no `toLocale*`, except `localDay` from `core/io/time.ts` with an explicit zone.
  - Plan 2's static I/O rule (its Task 0C) applies to them.
- ✚ This plan changes no Plan 2 signature or type, and does not change the `aiprof/2` schema.

**Reports**
- ✚ A report is one HTML file with inline CSS, JS and fonts.
  - Its CSP is exactly `default-src 'none'; script-src 'sha256-…'; style-src 'sha256-…'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'`.
  - It has no `style=` attributes and no inline event handlers.
  - It references no resource other than `data:` and `#…`.
  - Task 4's `auditHtml` checks all of this.
- ✚ Every character that a report or share card renders from kit or app copy is covered by the embedded fonts: `uncoveredChars` returns `[]`. Terminal text (`--help`, `--explain`, logs) is exempt.
  - Marks and arrows are SVG icons.
  - Copy says "at least", "at most" and "to", never ≥, ≤ or →.
  - Greek letters appear only in mono formulas.
- ✚ Rendering is deterministic: a report is a pure function of its `ReportInput`, so the same input gives the same bytes. Dates come from `a.meta.now` in `a.meta.timeZone`, never from the process zone.
- ✚ Budgets:
  - **Payload:** the report model, without its export preview, is at most 300,000 bytes as canonical JSON.
  - **Export:** at most 300,000 bytes.
  - **Elements:** fewer than 5,000.
  - **Bins:** at most 600 per lane.
  - **HTML:** at most 1,500,000 bytes. The fonts take 283,732 bytes of that, as base64.

**Names (§6.7)**
- ✚ Real names appear only in B's private report, and not under `--anonymize`. They are:
  - project folder names;
  - the person's own skill, command, agent, plugin and MCP server names.
- ✚ They never appear in any of these: the share card, the `.aiprof` export, `--json`, logs, `--explain` and snapshots.
- ✚ No report contains a full path: written files appear by file name only, and stdout prints their `~` paths (pre-flight F20).
- ✚ Raw model ids are shown only through `modelExportId`.

**Files written:** ✚ only the report and the sidecars the person asks for.
- Files are 0600, and the default folder is 0700 (POSIX).
- No temp files are written.

**Visual QA:** ✚ it uses synthetic fixtures only.
- Screenshots and PDFs live outside the repo and are never committed.
- The controller reviews them before Task 16 is accepted.

**Tests:** ✚ render tests use Plan 2's personas (`personaScan`) and `scanResultOf`. Snapshots render with `fonts: "none"`.

**Pushes:** ✚ besides `git push` and `gh`, the font fetch also needs `dangerouslyDisableSandbox: true`.

## Spec values (verbatim — tasks cite these and never restate them differently)

**§6.8 Shared visual system and viz kit**
- "**World:** evolve v1's instrument dashboard into an **assay certificate** — ink + gold, the struck seal, data-ink over decoration."
- "**Type roles:** mono (JetBrains Mono, tabular) for every measurement; Archivo Expanded for structure (caps only ≥ 18 px); an embedded text serif (Source Serif 4 or Newsreader, OFL, Latin subset, 2–3 styles) for interpretation. Scale 12/14/16/20/28/44/64; min 12 px screen, 7.5 pt print."
- "**Colour = meaning:** gold only for the subject's measurements and the seal; vermilion for flags; verdigris for passes; no per-tool colours. Mark grammar: solid = sufficient evidence, hollow = thin, hatched = not measurable locally."
- "**Themes:** dark "ink" and light "paper" (paper = print theme), `prefers-color-scheme` + toggle; a build-time test enforces text contrast ≥ 4.5:1, marks ≥ 3:1, monotone heatmap ramps."
- "**Motion:** the seal strikes once (≤ 500 ms) only when integrity passes; no count-ups or scroll reveals; hovering a finding highlights the evidence it cites."
- "**Primitives (pure SVG strings, no libraries):** assay ledger (dot + interval + ceiling/reference marks + expandable components), swimlanes (relative time), delegation outline (text tree), verification funnel, habit & rotation lanes, then→now table, heatmap with fixed buckets, small multiples. Engine pre-bins: payload ≤ 300 KB, ≤ 600 bins/lane, < 5,000 DOM nodes."
- "**Print:** `@page{margin:14mm}`, running footer "Name · No. · p X/Y" (margin boxes, fixed fallback), `break-before:page` per chapter, `print-color-adjust:exact`, `beforeprint` → paper theme + open all `<details>`."
- "**Accessibility:** landmarks, `figure/figcaption` one-sentence summaries per chart, nothing hover-only (tap pins), keyboard navigation for any toggles."

**§3:** "Reports are one HTML file each: inline CSS/JS/fonts, no external requests, CSP meta `default-src 'none'` plus the inline/data: allowances needed."

**§7.1 CLI**
```
ai-practice                     scan → private report.html (opens in browser)
  --explain                     list every path/store that would be read, read nothing, exit
  --json                        also write the sanitized analysis JSON
  --keep-history                opt-in: append this run's aggregates to ~/.ai-practice/history.jsonl
  --coach [claude|codex|gemini] opt-in: own-agent coaching notes (§7.3)
  --share-card                  write share-card.svg/png (minimal, chosen fields only)
  --export-for-employer         write an unsigned aiprof/2 bundle (A shows it as "self-reported")
  --tools a,b  --since DATE  --no-open  --out PATH  --purge (delete history/cache)
```

**§7.2 Report information architecture**
```
┌ YOU ─────────────────────────────────────────────────────────────────────┐
│ name (optional) · coverage strip (tools × windows) · "reads as" 3 roles  │
│ Practice profile: 7-dim assay ledger (dot ± interval, components)        │
│ This month vs last (if history) · Then → Now (first 90 vs last 90 days)  │
├ NEXT 3 UPGRADES ─────────────────────────────────────────────────────────┤
│ each: the evidence (→ Ex.) · why it matters · a concrete recipe          │
│ (e.g. "add a hook that runs your tests after edits — 39% unchecked")     │
├ EXHIBITS ────────────────────────────────────────────────────────────────┤
│ A a day under the loupe · B delegation outline · C verification loop     │
│ D habit & rotation · E then→now · F agent-touched stack · day-part bands │
├ COACH NOTES (only with --coach, labelled with model id + input hash) ────┤
├ DATA HEALTH (forensics band, coverage, drift warnings) ──────────────────┤
├ SHARE / EXPORT ──────────────────────────────────────────────────────────┤
└ METHOD (sources, windows, reference v0, formulas, privacy statement) ────┘
```
- "Upgrade recipes are rule-based, keyed to the lowest-confidence-adjusted components, each citing its exhibit."
- "Tone: personal and encouraging but evidence-first; no trophies."

**§7.5 Share card and employer export**
- "Share card: SVG (and PNG rendered in-page via canvas) showing name (optional), top-3 roles, the 7-dim ledger without raw counts, date; user picks fields."
- "Employer export: an unsigned `aiprof/2` bundle; A's `verify` renders it with a "self-reported — not verified" banner and no integrity band."

**§6.7**
- "**Where real names may appear (my call):** only on surfaces that by design never leave the machine — A's terminal consent UI (a label ↔ name table used to exclude or reveal projects) and B's private report (names shown by default; `--anonymize` hides them). Never in A's `preview.html` or candidate copy (labels only — these files get forwarded by mistake), bundles, share cards, employer exports, or logs. `--explain` prints paths with the home directory collapsed to `~`. The canary harness encodes one rule per surface."
- "**Corrected privacy statement** (both READMEs, `--help`, Method section): "reads local history files, which contain your prompts, replies and code, in memory to count things; keeps none of the text; never opens credential files; shares nothing until you approve the preview; offline by default." (Full draft in brainstorm notes `03-trust-privacy.md` §6, adapted per product.)"

**§10**
- "report render tests (DOM budget, no external URLs, CSP present); contrast-token tests."
- "**Visual QA:** Playwright screenshots of both reports in dark/light, 1440 px and 390 px, and print-to-PDF; reviewed before declaring done."
- "**Performance budgets:** a full scan of a heavy history ≤ 60 s cold; peak RSS ≤ 1 GB; payload ≤ 300 KB; report < 5,000 DOM nodes."

**§11 P3 acceptance:** "report renders offline in both themes, prints to a clean PDF, passes the DOM/payload budgets, and shows upgrades with exhibit citations."

## Builder's calls (binding here; spec §14 leaves them open)

1. **Fonts.**
   - The files are Fontsource 5.3.0 Latin-subset variable `.woff2` files, fetched by exact version from jsDelivr's npm mirror and pinned by SHA-256 (Task 2).
   - The serif is **Newsreader**, which the spec allows: it is OFL 1.1 with no Reserved Font Name, so a subset needs no rename. It ships upright only, as one variable weight file that covers 2–3 styles, with `font-synthesis: none`.
   - Archivo Expanded is the variable width file at `font-stretch: 125%`.
   - JetBrains Mono also ships its Greek subset (for the formulas) and its Latin Extended subset (for names).
   - Display text whose characters Archivo's Latin subset lacks falls back to mono, through `displayText` (Task 4).
   - Size cost: 212,792 bytes on disk, which is 283,732 bytes of base64 in every report.
2. **Exhibit data lives in core.** `Analysis` holds no timelines, delegation trees, per-tool weeks or time-split prompt metrics. `computeExhibits(raw, a)` (Task 6) derives them from Plan 2's `buildSessionTable` and the event store.
   - The `Exhibits` type holds only numbers, enums, ISO weeks and months.
   - Its times are relative: a loupe never says which day it shows.
   - `aiprof/2` is unchanged; Plan 4 may add `Exhibits` to it.
3. **Glyphs.** The fonts are subsets, so arrows, triangles, dots, diamonds, flags and the theme and print symbols are inline SVG icons. Box drawing is CSS borders. Copy avoids math symbols.
4. **Path-per-class.** Within one lane or row, every mark of one class is a single `<path>`. Element counts therefore do not grow with the data; only the length of the path data does, and the bins bound that.
5. **Reference marks.**
   - The reference tick sits at score 50, which is the reference v0 median by construction (spec §6.5).
   - The ceiling mark is the open-tail triangle, drawn when `openTail` is set.
   - The score mark is the ◆ of §8.4's legend: solid at medium or high confidence, hollow at low.
6. **The seal in B** shows the overall band, interval and coverage.
   - **struck:** the overall is scored and no check failed. A "not anchorable" tool is neutral.
   - **provisional:** the overall is insufficient.
   - **flagged:** the forensics band is `inconsistent`; the seal reads "CHECK DATA".
   - The seal strikes only in the struck state.
7. **Names.**
   - **A project's name** is the last segment of its cwd (`raw.cwds`).
     - It is `~` when the cwd is the home folder.
     - It is cleaned and cut to 40 characters.
     - When two names are equal, each gets ` · <label>` appended.
   - **A repo's name** comes from `raw.repos.roots`, with the same rules; a repo without a root is named by its label.
   - **Config names** are the person's own, from `a.private.config`.
   - **`--anonymize`:**
     - projects become their labels;
     - MCP servers take `mcpLabels(a.private.config)` from Plan 2 Task 14: the public name, else `custom #n`, exactly as the export labels them (pre-flight F15);
     - other config names become `<kind> #n`, numbered by keyed-hash order.
8. **The default output folder** is `~/.ai-practice/reports/`, so a private report that shows names never lands in a repo. The file stem is `ai-practice-report-<YYYY-MM-DD>`; the date is `a.meta.now` in the analysis zone. The sidecars share the stem: `.json`, `.share-card.svg` and `.aiprof`.
9. **Upgrades.**
   - The candidates are `ok` components of scored dimensions.
   - Each candidate's adjusted value is `zAdj = z·r/(r+1)`, where `r` is the dimension's `ratio`. Components with `zAdj ≥ 0.5` are left out.
   - Priority is `WEIGHTS[dim] × weight × (0.5 − zAdj)`, in descending order, with ties broken by component id.
   - At most three upgrades are kept, with at most one per dimension.
   - With fewer than three candidates, fewer are shown, never padded.
10. **Share card.**
    - It is 1200×630 in the ink palette, whatever the page theme.
    - Its fields are chosen from `name`, `roles`, `ledger`, `band` and `date`.
    - The default fields are `roles`, `ledger` and `date`, plus `name` when `--name` is given.
    - Its date is the month only.
    - The CLI writes the SVG, because rasterizing needs a browser or a dependency. The PNG comes from the report page's canvas, as §7.5 says.
11. **Employer bundle:** `{ format: "aiprof/2", meta: { producer, version, core, createdAt, selfReported: true }, payload, signature: null }`, serialized as canonical JSON.
    - `payload` is `exportPayload(a).value`.
    - The report's Share section shows exactly these bytes, and the CLI writes those same bytes.
12. **Then and now** needs a lifetime span of at least 180 days. Its two windows are the first 90 days and the 90 days ending at `now`.
13. **Flags left to Plan 5.** `--keep-history`, `--coach` and `--purge` are usage errors that say "not available in this version".

## Design system (pinned; Tasks 3–7 implement it, Task 16 reviews it)

```
DESKTOP 1440 — first screen
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ AI PRACTICE REPORT · No. 7F3A-91C2 · 18 Nov 2026 · v1.0.0                 [◐ Paper] [⎙ Print] │
├────────────┬─────────────────────────────────────────────────────────────────────────────────┤
│ CONTENTS   │ YOU                                                                             │
│ You        │ JORDAN EXAMPLE                                                 ╭────────────╮   │
│ Upgrades   │ READS AS  ORCHESTRATOR · QA · BACKEND                          │     71     │   │
│ Exhibits   │ "You run several agents at once, you check agent edits with    │  [63–78]   │   │
│ Data health│  tests and builds, and you have kept that up most weeks…"      │   STRONG   │   │
│ Share      │ DETAIL  48 sessions · 600 typed turns · 120 subagent runs      │ 6/7 DIMS   │   │
│ Method     │ LIFE    6 months · 5 tools (3 active) · 22 active weeks        ╰────────────╯   │
│            │ COVERAGE   tools × detail/lifetime, one mark per cell                           │
│            │ PRACTICE PROFILE      0     25     50     75    100    score     conf  window   │
│            │ WORKING WITH AGENTS                                                             │
│            │   Leverage           ├──────┼──────┼─┆──[──◆──]──┤    71 [63–78]  ●●●  DETAIL   │
│            │ QUALITY · SETUP & JUDGMENT …            then and now: 3 better · 1 same → Ex.E  │
└────────────┴─────────────────────────────────────────────────────────────────────────────────┘
MOBILE 390 — masthead on two lines · name + seal (144 px, ring text hidden) on one row · roles ·
verdict · evidence · coverage (scrolls inside its box) · ledger rows stacked (label and value above
the rule) · then-and-now line. The page itself never scrolls sideways.
```

**Colour tokens.**
- Text tokens meet at least 4.5:1, and mark tokens at least 3:1, on `bg`, `surface` and `raised`.
- `onAccent` meets at least 4.5:1 on `gold`, `vermilion` and `verdigris`.
- `rule` is decorative only: hairlines between chapters, never a mark.
- `print` is a refinement of `paper`: it keeps paper's ink and accent tokens and overrides only the grounds, `rule` and `onAccent` shown in its column; every contrast pair passes in it (pre-flight F18).
- The heat ramp is monotone: luminance rises in ink and falls in paper and print.

| token | ink (dark) | paper (light) | print | role |
|---|---|---|---|---|
| bg | `#0B0E13` | `#F6F1E6` | `#FFFFFF` | page ground |
| surface | `#11161E` | `#EDE6D6` | `#FFFFFF` | panels |
| raised | `#18202B` | `#E3DAC6` | `#F3EFE6` | rows, table heads |
| rule | `#232C3A` | `#D6CCB7` | `#DDD6C8` | hairlines (decorative) |
| axis | `#69758C` | `#7A715F` | = paper | scale rules and ticks (mark) |
| ink | `#EDE7DA` | `#17150F` | = paper | text |
| muted | `#B0B7C4` | `#4B463C` | = paper | secondary text |
| faint | `#8D97AA` | `#655E51` | = paper | tertiary text, labels |
| ref | `#8D97AA` | `#655E51` | = paper | reference tick, hatch strokes |
| gold | `#D8A443` | `#7E5A0C` | = paper | the subject's measurements, the seal (text and marks) |
| goldHi | `#EBC06E` | `#5E420A` | = paper | focus ring, cited-evidence outline |
| vermilion | `#F0705A` | `#AD3418` | = paper | flags |
| verdigris | `#5BC2A7` | `#1F6B57` | = paper | passes |
| onAccent | `#0B0E13` | `#F6F1E6` | `#FFFFFF` | text on gold, vermilion or verdigris |
| heat0–heat4 | `#1A212C` `#3D3524` `#6A532B` `#A07B36` `#D8A443` | `#E6DDCA` `#D9C291` `#C49C50` `#9C7222` `#694A0C` | = paper | fixed heat levels |

**Type roles.** These are the only type classes.
- Every class sets `font-synthesis: none`.
- Mono sets `font-variant-numeric: tabular-nums slashed-zero`.
- Display is `"Archivo Variable"` at `font-stretch: 125%`, upper-case.

| class | family | px (print pt) | weight | line-height · tracking | used for |
|---|---|---|---|---|---|
| `t-disp-44` | display | 44 (24) | 760 | 1.0 · 0.02em | the name, or "Your practice" (h1) |
| `t-disp-28` | display | 28 (16) | 720 | 1.05 · 0.06em | chapter heads (h2) |
| `t-disp-20` | display | 20 (12) | 700 | 1.1 · 0.08em | exhibit titles (h3), masthead brand |
| `t-serif-20` | serif | 20 (12) | 420 | 1.45 · 0 | verdict, upgrade titles (weight 560) |
| `t-serif-16` | serif | 16 (10) | 400 | 1.55 · 0; at most 66ch | interpretation, captions, "why", recipes |
| `t-mono-64` | mono | 64 (32) | 600 | 1.0 · 0 | seal score: 64 units in the seal, so 48 px when the seal is 144 px |
| `t-mono-44` | mono | 44 (24) | 600 | 1.0 · 0 | fallback for an h1 name the display face cannot set |
| `t-mono-20` | mono | 20 (12) | 500 | 1.3 · 0 | exhibit key figures |
| `t-mono-16` | mono | 16 (10) | 500 | 1.4 · 0 | ledger scores, figures in tables |
| `t-mono-14` | mono | 14 (9) | 400 | 1.45 · 0 | labels, intervals, table cells, the tree |
| `t-mono-12` | mono | 12 (7.5) | 500 | 1.4 · 0.08em caps | window and n tags, axis labels, footer |

**Spacing and layout.**
- The spacing scale is `--s1`…`--s9` = 4, 8, 12, 16, 24, 32, 48, 64, 96 px.
- Chapters are 96 px apart (64 px on mobile). Exhibits are 48 px apart. Padding inside an exhibit is 24 px; rows are 12 px apart.
- **At least 1024 px wide:** a grid of `208px minmax(0,1040px)` with a 48 px gap. The left rail is a sticky `nav` with the contents.
- **640–1023 px:** the rail becomes a sticky chapter bar.
- **Below 640 px:** one column with 16 px side gutters. The chapter bar scrolls sideways inside itself, and ledger rows stack.
- Corners are square except the seal. There are no shadows.

**Mark grammar (CSS classes; SVG fills and strokes use classes, never attributes with colours).**

| class | means | draws |
|---|---|---|
| `m-solid` | the subject's measurement, sufficient evidence | fill `gold` |
| `m-hollow` | thin evidence | fill `bg`, stroke `gold` 1.5 |
| `m-hatch` | not measurable here, or not retained | fill `url(#kit-hatch)`: 45°, 4-unit pitch, 1-unit `ref` stroke |
| `m-ref` | reference v0 median | stroke `ref` 1, dash `2 2` |
| `m-axis` | scale rule and ticks | stroke `axis` 1 |
| `m-flag` / `m-pass` | flag / pass | `vermilion` / `verdigris` |
| `m-heat-0`…`m-heat-4` | fixed heat level | fill `heatN` |
| `m-prompt` | your prompts | fill `ink` |
| `m-wait` | agent idle, waiting on you | stroke `faint` 1, dash `1 3` |
| `m-track` | the empty part of a bar | fill `raised` |

The hatch pattern is defined once per page in `<svg class="kit-defs">`. That element is absolutely positioned at 0×0, never `display:none`.

**Primitive grammar.**
- **Ledger row.**
  - The rule is `viewBox="0 0 400 24"`, with `x(s) = 8 + 3.84·s`.
  - The axis is a line at y 12 from x 8 to 392, with ticks at 0, 25, 50, 75 and 100 (y 9–15).
  - `m-ref` is at x(50), y 4–20.
  - The interval is drawn from x(lo) to x(hi), stroke 2 in gold, with caps at y 8–16.
  - The ◆ is 10×10 at x(score), and `m-solid` or `m-hollow`.
  - The open tail is a right-pointing triangle at x 392–400, y 8–16.
  - A row that is not scored gets an `m-hatch` rect over x 8–392, y 8–16, and no ◆.
  - **HTML:** label (mono 14) | rule | score (mono 16), interval (mono 14) | three confidence dots | window tag (mono 12).
  - Each row is a `<details>` that holds its components table.
- **Seal.**
  - `viewBox="0 0 192 192"`: an outer ring at r 94 (stroke 1.5) and an inner ring at r 80 (stroke 0.75).
  - Ring text runs on a circular path at r 87, in mono 12 caps with 0.12em tracking. It is hidden below 640 px.
  - The centre holds the score (`t-mono-64`: 64 units, weight 600) and the band label (mono 16 caps), so both stay at 12 px or more when the seal is 144 px.
  - Below the SVG, as HTML, come the interval (mono 14) and the coverage, e.g. `6/7 DIMENSIONS` (mono 12).
  - **struck:** the inner disc is filled `gold` and its text is `onAccent`; class `seal--struck`.
  - **provisional:** no fill, and outlined numerals (fill none, stroke `gold` 1).
  - **flagged:** rings and text in `vermilion`.
- **Swimlanes.**
  - The viewBox is 960 wide. The label column spans x 0–152: mono 12, cut to 22 characters. The plot spans x 160–952.
  - Lanes are 28 tall, below a 20-unit axis with hour ticks, or 2-hour ticks when the span is over 12 h.
  - Each lane has one path per class:
    - a track;
    - `m-solid` work, h 10;
    - `m-wait`;
    - `m-prompt`, 6×6 triangles at lane centre −9;
    - children: stroke 1.5 at +9 with end ticks, background children dashed.
  - It sits in a `.scroll-x` box with `min-width: 960px`.
- **Habit lanes.**
  - The viewBox is (160 + 52·14) × (20 + 18·rows + 24). Cells are 12×12 with a 2-unit gap.
  - Each row has one path per heat level, plus one `m-hatch` path for weeks that were not retained.
  - First-seen features are 7×7 ◆ marks in the top band, as one path.
  - A `DETAIL` bracket under the grid spans the detail weeks.
  - It sits in `.scroll-x[data-scroll="end"]`, so it opens at the current week.
- **Delegation outline.** An HTML `<ol class="tree">` in mono 14.
  - Branches are CSS borders.
  - Each node reads `Explore × 3 · 41 actions`, followed by an inline `m-solid` bar (h 6, at most 160 wide, proportional to actions).
  - The summary by type is one stacked bar, with a 2-unit gap between segments and HTML labels.
- **Funnel, bar list, then-and-now and coverage strip** are HTML grids or tables.
  - Their bars are SVG `m-solid` on `m-track`, h 6.
  - Verdicts and states use dots: better `m-pass`, worse `m-flag`, same `m-axis`, n/a `m-hatch`.
  - The coverage strip's marks by state:
    - **read:** a solid square;
    - **empty:** hollow;
    - **not found:** an axis dot;
    - **present, not decodable:** hatch;
    - **changed?:** a flag;
    - **could not read** (`error`): a flag (pre-flight F24).
    - **A cell** (tool × window) shows the worst status of its sources, in the order drift, present-undecodable, error, ok, empty, absent (pre-flight F24).
- **Exhibit frame.** A `<figure class="exhibit" id="ex-x">` with a header:
  - `Ex. C` in mono 12 caps, gold;
  - the title in `t-disp-20`;
  - the tag, e.g. `DETAIL · n=412`, in mono 12.

  Then come the body and a one-sentence `<figcaption>`. The states are `exhibit--thin` (a hollow note) and `exhibit--empty` (a hatched 48-unit placeholder with the note "not enough data yet: n=…, needs …").
- **Scaled SVG text.** Every SVG either has no text and scales freely, or sits in a `.scroll-x` box whose `min-width` equals its viewBox width. Either way, text stays at 12 px or more. The one exception is the inline share-card preview: it is an image (`role="img"` and a `<figcaption>`), scales to its column, and every card field is also listed beside it in readable text; the download gives the full-size card (pre-flight F21).

**Print.**
- `@page { margin: 14mm }`, with these margin boxes, in mono 7.5 pt and `faint`:
  - `@bottom-left { content: <cssString(footerLeft)> }`, where `footerLeft` is "Name · No. 7F3A-91C2";
  - `@bottom-right { content: "p " counter(page) "/" counter(pages) }`.
- `@media print`:
  - print tokens;
  - `* { print-color-adjust: exact; -webkit-print-color-adjust: exact }`;
  - `.chapter + .chapter { break-before: page }`;
  - `figure.exhibit { break-inside: avoid }`;
  - type at the print sizes;
  - `.rail`, `.chapter-bar`, `.kit-controls` and `[data-print="skip"]` hidden.
- `.print-footer` is a fixed fallback. It shows only under `html.no-margin-boxes`.
- **`beforeprint`:**
  - open every closed `<details>` outside `[data-print="skip"]` and remember which they were;
  - add `no-margin-boxes` unless the browser is Chromium 131 or later;
  - `@media print` already forces the paper and print tokens.
- **`afterprint`** restores both.
- The seal prints at 48 mm with no animation.

**Motion.**
- The struck seal plays `kit-strike` once, for 420 ms: scale 1.12 with −6° rotation and opacity 0, then scale 0.98 with 0.5° rotation and opacity 1 at 60%, then rest.
- A cited exhibit gets a 2 px `goldHi` outline, with a 160 ms outline-colour transition.
- Nothing else moves. Under `prefers-reduced-motion: reduce` there is no animation at all.

**Accessibility.**
- Landmarks: `header`, `nav[aria-label="Contents"]`, `main` and `footer`, plus a skip link.
- One `h1`; chapters are `h2` and exhibits `h3`.
- Every chart SVG has `role="img"` and `aria-labelledby` pointing at its title and caption, or an `aria-label`.
- Ledger rows carry their reading as text: "Leverage 71, interval 63 to 78, high confidence".
- `[data-cite]` links highlight on hover and focus, and pin on tap or Enter.
- The theme control is a `<button aria-pressed>`.
- The focus ring is 2 px `goldHi`, offset 2.

## Review Focus

1. **Thin or empty data:** one tool, a new install, an empty home, or lifetime data only. Expected:
   - every exhibit shows its empty state with `n` and `needs`;
   - the seal is provisional;
   - no "NaN", "undefined" or "null" appears;
   - the upgrades chapter says why it is empty;
   - the CLI exits 0 and says no history was found.

   Pinned by Tasks 11, 12 and 13.
2. **Hostile or odd names:**
   - HTML or script in a folder name or in `--name`;
   - quotes that would break out of the print footer's CSS string;
   - RTL, emoji or CJK characters;
   - 300-character names;
   - a cwd that is the home folder;
   - two projects with the same basename.

   Expected: names are escaped and cut, the home shows as `~`, duplicates get their labels, and the audit stays clean. Pinned by Tasks 9 and 12.
3. **Heavy data:** 300,000 events, more than 12 parallel sessions in a day, a session with 300 subagents, more than 8 tools. Expected:
   - at most 600 bins per lane;
   - at most 12 lanes, plus "+n more";
   - at most 8 delegation groups per level and 48 in the whole tree, plus "+n more" (pre-flight F12);
   - the element count unchanged by data size;
   - payload at most 300,000 bytes, and fewer than 5,000 elements.

   Pinned by Tasks 6, 7, 11 and 12.
4. **Output edge cases:** `--out` in a missing or read-only folder, a path with spaces or unicode, two runs on the same day, no browser, output piped rather than a TTY. Expected:
   - a clear error and exit code;
   - nothing half-written;
   - no escape codes in piped output.

   Pinned by Task 13.
5. **Locale and time zone:** `LANG=de_DE.UTF-8` or `TZ=Asia/Kolkata` against UTC. Expected:
   - identical number, date and month formatting;
   - the report date taken from `a.meta.now` in `a.meta.timeZone`, never from the process zone.

   Pinned by Tasks 4 and 12.

## File map

```
core/io/asset.ts                                         readAsset (observed)                               2
core/viz/fonts/{*.woff2, OFL-*.txt, manifest.ts}, core/viz/{assets.d.ts, fonts.ts}, scripts/fonts-fetch.ts   2
core/viz/{tokens,contrast,css}.ts                        themes, contrast, kit CSS                          3
core/viz/{html,icons,fmt,runtime,page,audit}.ts          page shell, CSP, formatting, audit                 4
core/viz/{types,figure,seal,ledger}.ts                   ledger, seal, exhibit frame                        5
core/exhibits/{types,loupe,delegation,verification,habit,thennow,index}.ts                                  6
core/viz/{labels,swimlanes,delegation,funnel,habit,thennow,bars,coverage}.ts                               7
core/viz/index.ts, package.json exports ./viz, core/index.ts                                                8
app/{copy,names}.ts, app/report/{upgrades,verdict}.ts                                                      9
core/privacy/bundle.ts, app/export/employer.ts, app/share/{fields,card}.ts                                 10
app/report/model.ts, test/kit/report.ts                                                                     11
app/report/{render,css,client}.ts, app/report/sections/*.ts                                                12
app/{cli,main,args,explain,run,paths,open}.ts                                                               13
test/app/canary.surfaces.test.ts                                                                            14
scripts/build.ts, test/app/compile.test.ts                                                                  15
scripts/{qa-reports,visual-qa}.ts                                                                           16
scripts/report-smoke.ts, test/app/integration.test.ts                                                       17
```

## Interfaces for Plan 4 (the viz kit A consumes)

A imports these from `ai-practice-report/viz` (`core/viz/index.ts`) or `ai-practice-report/core`, pinned by commit SHA.
- **Kit input types** are shaped so that A can build them from the `aiprof/2` payload alone. For example, payload `dimensions[]` maps onto `LedgerRow` with `window` as given.
- **Exhibits.** A–E need `computeExhibits`, which runs on the candidate's machine. A may render them only if Plan 4 adds `Exhibits` to its payload.
- **Copy.** The kit carries only domain nouns: tool, subagent-type, feature and window labels. Product copy, such as B's second person or A's third person, stays in each app.
- **Tests.** A's tests should run `auditHtml` on every dossier and console.

```ts
renderKit: { version, themes, typeScale, space, page, cspFor, auditHtml, figure, seal, ledger, ledgerLegend, confidenceDots,
  swimlanes, delegationOutline, verificationFunnel, heatmap, habitLanes, thenNowTable, barList, smallMultiples, coverageStrip,
  icon, esc, attr, jsonIsland, displayText, fmt, cssString, fontFaceCss, fontLicenses, uncoveredChars, contrast, heatLevel, labels }
computeExhibits(raw: ScanResult, a: Analysis, o?: { exclude?: Exclusions }): { exhibits: Exhibits; local: ExhibitsLocal }
```

---

### Task 1: Pre-flight — pin the Plan 2 contract on `main`

**Files:**
- Create: `test/contract/plan2.test.ts`
- Modify: `.gitignore`, adding `ai-practice-report-*.html`, `ai-practice-report-*.json`, `*.share-card.svg` and `qa-out/`

**Interfaces:**
- Consumes, exactly as Plan 2's Interfaces blocks state them:
  - **Analysis:** `analyze`, `AnalyzeOptions`, and every field of `Analysis`: `meta`, `coverage`, `signals`, `dimensions`, `overall`, `personas`, `exposure`, `stack`, `risk`, `config`, `projects`, `forensics`, `identity`, `exclusions`, `diagnostics`, and `private{dayParts, config[{kind, name, key, provenance, used}], models}`.
  - **Scoring:** `DimensionResult` (with `ratio`), `ComponentResult` (with `raw`), `Overall`, `Band`, `WEIGHTS`, `DimensionId`, `Confidence`, `loadReference("v0")`.
  - **Signals and panels:** `Signals` (with `evidence`, `childTypes`, `actionsPerTurn`), `Metric`, `MetricMeta`, `Exposure` (with `weekly`, `tools`, `rotation`, `arcs`, `firstSeen`), `Feature`, `Stack`, `RiskPosture`, `ConfigPanel`, `CoveragePanel`, `DayParts`, `ProjectSummary`.
  - **Forensics:** `Forensics`, `CheckResult`, `CheckId`, `CheckStatus`.
  - **Export and privacy:** `exportPayload`, `ExportResult`, `canonicalJson`, `mcpExportName`, `modelExportId`, `mcpLabels` (pre-flight F15).
  - **Session table:** `buildSessionTable`, `SessionTable`, `SessionRow`, `Exclusions`, `dayKey`, `isoWeek`, `childType`, `ChildType`, `isAction`, `briefScore` (pre-flight F14).
  - **Constants and scan:** `TASK_GAP_MS`, `BUCKET_MS`, `ScanOptions.repoSignals`, `ScanResult.repos` (`RepoSignals` with `repos[]` and `roots`), `REPO_SIGNALS_DESCRIBE`.
  - **Opens:** `noteOpen`, `__observeOpens`.
  - **Test kits:** `personaScan`, `scanResultOf`, `synthStore`, `makeRepo`.
- Produces: nothing new.

- [ ] **Step 1: Branch and read.**
  1. Confirm that `HEAD` is `feat/practice-report`, that it equals `main`, and that `main` contains Plan 2's merge.
  2. On `main`, read:
     - `core/index.ts`, `core/analyze.ts` and `core/analysis/{types,sessions,activity,tiers,exposure,panels}.ts`;
     - `core/signals/types.ts`, `core/scoring/{dimensions,overall,reference}.ts` and `core/forensics/index.ts`;
     - `core/privacy/{export,allowlists,jcs}.ts`, `core/git/{types,index}.ts`, `core/io/{observe,time}.ts` and `core/model/constants.ts`;
     - `test/fixtures/personas.ts` and `test/kit/{scanresult,synth}.ts`.
  3. Confirm that each consumed name exists with the type its Interfaces block states. Also confirm that `RepoSignals.roots` maps a `repoKey` to its raw root, as Plan 2 Task 2 now states (pre-flight F16), and that `core/scoring/reference/v0.json` and `core/forensics/releases.json` load through `import … with { type: "json" }`, so Task 15's binary carries them (pre-flight F17). If anything differs, stop and report BLOCKED with the difference.
  4. In the task report (never in the repo), record which `CANARY` keys `personaScan(…, { canaries: true })` plants in `raw.cwds`, in config names and in model ids. Tasks 11 and 14 use them.
- [ ] **Step 2: Write the contract test.** It pins the consumed names at compile time with typed assignments, e.g. `const d: DimensionResult = a.dimensions[0]!`. At run time, with `a = analyze(personaScan("intermediate"), { timeZone: "UTC" })`, it asserts:
  - `a.dimensions` has 7 entries, each with `ratio` and with `components[].raw`;
  - `JSON.parse(exportPayload(a, { schema: "aiprof/2" }).json)` deep-equals `.value`;
  - `buildSessionTable(raw, { now: a.meta.now, timeZone: "UTC" }).activity.byTool` is an object;
  - `childType("Explore") === "explore"`;
  - `loadReference("v0")` has 22 components;
  - `mcpExportName("github") === "github"`;
  - `modelExportId("ft:gpt-4o:x:y:z") === "fine-tuned"`;
  - `REPO_SIGNALS_DESCRIBE.reads.length > 0`.
- [ ] **Step 3: Run** `bun test test/contract && bunx tsc --noEmit` → PASS. This test pins existing code, so it passes at once; a failure means BLOCKED.
- [ ] **Step 4: Commit** `test(contract): pin the Plan 2 interfaces the app consumes`.

---

### Task 2: Fonts — fetch once, commit, embed at render time

**Files:**
- Create:
  - `core/io/asset.ts` and `core/viz/assets.d.ts`;
  - `core/viz/fonts/manifest.ts` and `core/viz/fonts.ts`;
  - the five `.woff2` files and three `OFL-*.txt` files in `core/viz/fonts/`;
  - `scripts/fonts-fetch.ts`;
  - `.gitattributes`, holding `core/viz/fonts/* -text`, so Windows checkouts keep the license bytes (pre-flight F11);
  - tests: `test/core/viz/fonts.test.ts` and `test/scripts/fonts-fetch.test.ts`.

**Interfaces:**
```ts
// core/io/asset.ts
export function readAsset(path: string): Uint8Array;   // readFileSync after noteOpen(path, "read"); also reads Bun's embedded /$bunfs/ files
// core/viz/fonts/manifest.ts
export type FontFamily = "mono" | "display" | "serif";
export interface FontFile { file: string; family: FontFamily; cssFamily: string; url: string; sha256: string; bytes: number; weight: string; stretch?: string; unicodeRange: string }
export const FONT_FILES: readonly FontFile[];
export interface LicenseFile { file: string; families: readonly FontFamily[]; url: string; sha256: string; bytes: number; copyright: string }
export const LICENSE_FILES: readonly LicenseFile[];
// core/viz/fonts.ts
export const FONT_STACK: Readonly<Record<FontFamily, string>>;   // '"JetBrains Mono Variable", monospace', '"Archivo Variable", sans-serif', '"Newsreader Variable", serif'
export function fontFaceCss(o?: { families?: readonly FontFamily[] }): string;   // one @font-face per file, in FONT_FILES order
export interface FontLicense { family: string; copyright: string; license: "SIL Open Font License 1.1"; text: string }
export function fontLicenses(): FontLicense[];
export function coveredBy(ch: string, family: FontFamily): boolean;
export function uncoveredChars(text: string): string[];   // distinct code points outside every embedded range, sorted
// scripts/fonts-fetch.ts
export async function fetchFonts(o: { dir: string; fetch?: typeof fetch }): Promise<{ written: string[] }>;
```

**Pinned files.**
- Each URL is `https://cdn.jsdelivr.net/npm/@fontsource-variable/<pkg>@5.3.0/files/<file>`, where `<pkg>` is `archivo`, `jetbrains-mono` or `newsreader`.
- The licenses are each package's `LICENSE`, at `https://cdn.jsdelivr.net/npm/@fontsource-variable/<pkg>@5.3.0/LICENSE`.

| file | family · CSS family | weight · stretch | range | bytes | sha256 |
|---|---|---|---|---|---|
| `archivo-latin-wdth-normal.woff2` | display · `Archivo Variable` | `100 900` · `62% 125%` | LATIN | 90104 | `e3a28eade21a900c7155a247757f4b2834c07bb7ef07ad7efa55cebaac1e8f5e` |
| `jetbrains-mono-latin-wght-normal.woff2` | mono · `JetBrains Mono Variable` | `100 800` | LATIN | 40404 | `18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e` |
| `jetbrains-mono-latin-ext-wght-normal.woff2` | mono · `JetBrains Mono Variable` | `100 800` | LATIN_EXT | 15196 | `79bfdab9ba467e26eea4122e6f2567e188dd8a09a8c730d501fc487c4ab99c6e` |
| `jetbrains-mono-greek-wght-normal.woff2` | mono · `JetBrains Mono Variable` | `100 800` | GREEK | 9004 | `ee863198077f3093ffa81c072581cc4bd608a04e60a8a9c0b846396ce4f14109` |
| `newsreader-latin-wght-normal.woff2` | serif · `Newsreader Variable` | `200 800` | LATIN | 58084 | `62981321d9a3cc7a61a73792729043703fd6112da86e8ec848bb57f088578757` |

| license file | package | bytes | sha256 | copyright (first line, up to `)`) |
|---|---|---|---|---|
| `OFL-Archivo.txt` | archivo | 4503 | `c3c8402eec0e31dc9a76851235b1c02a0bb821488b2db8e35bcc2ab60ca8fc2b` | Copyright 2020 The Archivo Project Authors (https://github.com/Omnibus-Type/Archivo) |
| `OFL-JetBrainsMono.txt` | jetbrains-mono | 4524 | `403581b69dac5cff4079205e01c6b467e56af449ecbd7247693ddb1baafa005b` | Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono) |
| `OFL-Newsreader.txt` | newsreader | 4520 | `26028ec4e13b650065fa525a09532176f8a668b76ff849ea01c564a7480f91e7` | Copyright 2020 The Newsreader Project Authors (http://github.com/productiontype/Newsreader) |

**Ranges** (Fontsource's own `unicode-range` values):
- **LATIN:** `U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD`
- **LATIN_EXT:** `U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF`
- **GREEK:** `U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF`

**Rules.**
- `fonts.ts` imports:
  - each `.woff2` with `import p from "./fonts/<file>" with { type: "file" }`;
  - each license with `with { type: "text" }`;
  - `/// <reference path="./assets.d.ts" />` at its top, so A's type check sees the `*.woff2` module declaration.
- It reads bytes only through `readAsset`, encodes base64 at render time and memoizes per process. No base64 text is ever committed.
- Each `@font-face` has:
  - `font-family`;
  - `src: url(data:font/woff2;base64,…) format("woff2")`;
  - `font-weight`;
  - `font-stretch`, for Archivo;
  - `font-style: normal`;
  - `font-display: block`;
  - `unicode-range`.
- The repo's security guard accepts these files: their magic is `wOF2`, and `grep -I` skips binaries.

- [ ] **Step 1: Write the failing tests.**
  - `fonts.test.ts`:
    - **Font files:** for every `FONT_FILES` entry, the committed file has `bytes` bytes, starts with `wOF2`, and the SHA-256 of `readAsset(path)` equals `sha256`.
    - **Licenses:** for every `LICENSE_FILES` entry:
      - the SHA-256 and length match;
      - the text contains `SIL OPEN FONT LICENSE Version 1.1` and its copyright line;
      - it does not contain `with Reserved Font Name`.
    - **No strays:** every `.woff2` under `core/viz/fonts/` is listed in the manifest.
    - **CSS:**
      - `fontFaceCss()` holds 5 `@font-face` rules, each with its file's base64 and range, and Archivo's with `font-stretch:62% 125%`;
      - `fontFaceCss({ families: ["mono"] })` holds exactly the 3 mono rules.
    - **Coverage:**
      - `uncoveredChars("Leverage 71 [63–78] · “ok” −0.42 ρ Φ é Ł …")` → `[]`;
      - `uncoveredChars("→ ≥ ▲ 漢")` → `["→", "≥", "▲", "漢"]`;
      - `coveredBy("ρ", "mono")` and `coveredBy("é", "serif")` are true;
      - `coveredBy("ρ", "serif")` and `coveredBy("Ł", "display")` are false.
    - **Licenses list:** `fontLicenses()` has 3 entries, with the copyright lines above.
  - `fonts-fetch.test.ts`: `fetchFonts` with an injected fetch that serves the committed bytes from disk writes all 8 files into a temp dir. When one file has a flipped byte, it rejects and writes nothing.
  - Plan 2's `static-io.test.ts` still passes, so `readFileSync` occurs only in `core/io/`.
- [ ] **Step 2: Run** `bun test test/core/viz/fonts.test.ts test/scripts/fonts-fetch.test.ts` → FAIL.
- [ ] **Step 3: Implement** `readAsset`, the manifest, `fonts.ts` and `fetchFonts`.
  - `fetchFonts` checks the SHA-256 and, for fonts, the `wOF2` magic before it writes anything.
  - Then run once, with the network: `bun scripts/fonts-fetch.ts` (sandbox off). This writes the 8 files into `core/viz/fonts/`.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(viz): OFL fonts pinned by hash and embedded at render time`. Commit the 8 font and license files and `.gitattributes` with the code (pre-flight F11).

---

### Task 3: Tokens, contrast and the kit stylesheet

**Files:**
- Create: `core/viz/{tokens,contrast,css}.ts`, `test/core/viz/{contrast,css}.test.ts`

**Interfaces:**
```ts
// tokens.ts
export type ThemeName = "ink" | "paper" | "print";
export type ColorToken = "bg" | "surface" | "raised" | "rule" | "axis" | "ink" | "muted" | "faint" | "ref" | "gold" | "goldHi"
  | "vermilion" | "verdigris" | "onAccent" | "heat0" | "heat1" | "heat2" | "heat3" | "heat4";
export const THEMES: Readonly<Record<ThemeName, Readonly<Record<ColorToken, string>>>>;   // the Design system table, exactly
export const TYPE_SCALE: readonly [12, 14, 16, 20, 28, 44, 64];
export const PRINT_SCALE_PT: readonly [7.5, 9, 10, 12, 16, 24, 32];
export const DISPLAY_SIZES: readonly [20, 28, 44];
export const SPACE: readonly [4, 8, 12, 16, 24, 32, 48, 64, 96];
export function heatLevel(activeDaysInWeek: number): 0 | 1 | 2 | 3 | 4;   // 0 → 0; 1–2 → 1; 3–4 → 2; 5–6 → 3; 7 → 4
// contrast.ts
export function luminance(hex: string): number;          // WCAG 2.x relative luminance
export function contrast(a: string, b: string): number;   // (L1 + 0.05) / (L2 + 0.05)
export interface ContrastRow { theme: ThemeName; fg: ColorToken; bg: ColorToken; kind: "text" | "mark" | "accent"; ratio: number; ok: boolean }
export function contrastReport(): ContrastRow[];
// css.ts
export function kitCss(o: { footerLeft: string }): string;
export function cssString(s: string): string;            // "…" with \ → \\, " → \", newline → \A , < → \3C , > → \3E  (so no raw </style>), other control characters dropped (pre-flight F6)
```

**Pairs that `contrastReport` checks:**
- **Text (at least 4.5):** {ink, muted, faint, ref, gold, goldHi, vermilion, verdigris} on {bg, surface, raised}.
- **Mark (at least 3):** {gold, goldHi, ref, axis, vermilion, verdigris, heat4} on {bg, surface, raised}.
- **Accent (at least 4.5):** onAccent on {gold, vermilion, verdigris}.

Each set is checked in all three themes.

- [ ] **Step 1: Write the failing tests.**
  - `contrast.test.ts`:
    - `contrast("#000000", "#FFFFFF")` ≈ 21 and `contrast("#777777", "#FFFFFF")` ≈ 4.48 (±0.01);
    - every `contrastReport()` row is `ok`;
    - the luminance of heat0…heat4 strictly rises in ink, and strictly falls in paper and print;
    - `heatLevel` maps 0…7 to `[0, 1, 1, 2, 2, 3, 3, 4]`.
  - `css.test.ts`, on `kitCss({ footerLeft: "Your practice · No. 0000-0000" })`:
    - **Print:** it contains `@page`, `margin:14mm`, `@bottom-left`, `@bottom-right`, `counter(page)`, `counter(pages)`, `print-color-adjust:exact`, `-webkit-print-color-adjust:exact`, `break-before:page`, `break-inside:avoid`, `.no-margin-boxes`.
    - **Behaviour:** it contains `prefers-color-scheme`, `prefers-reduced-motion`, `font-synthesis:none`, `@keyframes kit-strike`, `@media (max-width:639px)`, `.scroll-x{overflow-x:auto`.
    - **Colours:** every hex value in `THEMES` occurs in it.
    - **Classes:** `.t-disp-20`, `.t-disp-28` and `.t-disp-44` each carry `text-transform:uppercase` and `font-stretch:125%`, and no `.t-disp-12`, `.t-disp-14` or `.t-disp-16` exists. Every class in the type-roles table exists, and so does every mark class.
    - **Nothing external:** no `@import` and no `url(` other than `url(data:` and `url(#kit-hatch)`.
    - **Determinism:** two calls give identical strings.
  - `cssString('a"b\\c\nd')` === `'"a\\"b\\\\c\\A d"'` and `cssString("</style>")` === `'"\\3C /style\\3E "'` (TypeScript escaping; pre-flight F6).
- [ ] **Step 2: Run** `bun test test/core/viz/contrast.test.ts test/core/viz/css.test.ts` → FAIL.
- [ ] **Step 3: Implement** the tokens exactly as the Design system pins them. `kitCss` emits:
  - the themes on `:root[data-theme=…]`, with `auto` following `prefers-color-scheme`;
  - base styles, type roles, layout, components and mark classes;
  - the print and motion rules.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(viz): assay tokens for ink, paper and print, with contrast pinned by test`.

---

### Task 4: Page shell — escaping, icons, formatting, CSP, runtime, audit

**Files:**
- Create: `core/viz/{html,icons,fmt,runtime,page,audit}.ts`, `test/core/viz/{html,fmt,page,audit}.test.ts`

**Interfaces:**
```ts
// html.ts
export function esc(s: string): string;                        // & < > " ' → &amp; &lt; &gt; &quot; &#39;
export function attr(name: string, value: string): string;      // ` name="<esc(value)>"`
export function jsonIsland(id: string, value: unknown): string; // <script type="application/json" id>; < > & U+2028 U+2029 as \u escapes
export function displayText(text: string, size: 20 | 28 | 44): string;   // t-disp-<size> if every char is display-covered, else t-mono-20 (for 20 and 28) or t-mono-44
// icons.ts
export type IconName = "arrow" | "flag" | "check" | "diamond" | "diamond-hollow" | "triangle" | "dot" | "ring" | "square" | "theme" | "print";
export function icon(name: IconName, o?: { label?: string }): string;   // 12×12 inline SVG; aria-hidden unless labelled
// fmt.ts — locale-free and deterministic
export const fmt: {
  score(n: number): string; interval(iv: readonly [number, number]): string; share(x: number): string; count(n: number): string;
  decimal(x: number, digits: number): string; signed(z: number, digits?: number): string; tokens(n: number): string;
  duration(ms: number): string; day(ms: number, timeZone: string): string; month(ym: string): string;
  span(fromMs: number | undefined, toMs: number | undefined, timeZone: string): string; week(isoWeek: string): string };
// runtime.ts
export const KIT_RUNTIME: string;   // ES2020, no modules
// page.ts
export interface PageOptions { title: string; footerLeft: string; body: string | ((c: { csp: string }) => string);
  css?: string; script?: string; fonts?: "embed" | "none"; theme?: "auto" | "ink" | "paper" }
export function page(o: PageOptions): string;
export function cspFor(style: string, script: string): string;
// audit.ts
export interface Audit { bytes: number; elements: number; csp: string | null; cspOk: boolean; externalRefs: string[];
  styleAttrs: number; inlineHandlers: number; uncovered: string[] }
export function auditHtml(html: string): Audit;
```

**Rules.**
- **`page()` order:**
  1. `<!doctype html><html lang="en" data-theme="…">`;
  2. in `<head>`: `meta charset`, then the CSP meta, then `viewport`, `color-scheme: dark light` and `referrer: no-referrer`, then `<title>` and one `<style>`;
  3. in `<body>`: `<svg class="kit-defs">` with `#kit-hatch`, then the body, then the print footer fallback, then one `<script>`.
- **Contents.** The style is `fontFaceCss()` (left out under `fonts: "none"`), then `kitCss`, then `o.css`. The script is `KIT_RUNTIME`, then `o.script`.
- **CSP.** `cspFor` returns exactly `default-src 'none'; script-src 'sha256-<b64>'; style-src 'sha256-<b64>'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'`, over the exact style and script text.
- **`fmt`.**
  - **score:** an integer.
  - **interval:** `[lo–hi]`, with an en dash.
  - **share:**
    - `round(100x)%`;
    - `<1%` when 0 < x < 0.005;
    - `>99%` when 0.995 ≤ x < 1.
  - **count:** comma thousands.
  - **decimal:** `toFixed`, never `-0`.
  - **signed:** `+` or U+2212.
  - **tokens:**
    - below 1,000 → the integer;
    - below 1,000,000 → `k` with no decimals;
    - otherwise `M` with one decimal, trailing `.0` dropped.
  - **duration:**
    - under 60 s → `N s`;
    - under 60 min → `N min`;
    - under 48 h → `H h M min`, with `M min` dropped when 0;
    - otherwise `D d`.
  - **day:** `localDay(ms, tz)` → `18 Nov 2026`.
  - **month:** `2026-11` → `Nov 2026`.
  - **span:** `Mar–Nov 2026` within one year, `Nov 2025–Mar 2026` across years, `—` when either end is undefined.
  - **week:** `2026-W47` → `W47 2026`.
  - Month names come from a fixed English array.
- **`KIT_RUNTIME`:**
  - **theme toggle:** ink and paper, `aria-pressed`, the choice kept in `localStorage` inside try/catch;
  - **print:** `beforeprint` and `afterprint` as the Design system pins them;
  - **cites:** hover or focus on `[data-cite]` outlines the target, and tap or Enter pins it;
  - **scrolling:** every `.scroll-x[data-scroll="end"]` scrolls to its end on load.

  It uses no `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `import(`, `eval` or `innerHTML`.
- **`auditHtml`:**
  - **`elements`** counts start tags outside `<script>`, `<style>` and `<pre>`.
  - **`externalRefs`** lists every `src`, `href`, `action`, `formaction`, `poster`, `srcset`, `xlink:href` or `data` attribute, every CSS `url(…)` and every `@import`, whose target is not `#…` or `data:…`. It also lists every `<link>`, `<iframe>`, `<object>`, `<embed>` and `<base>`.
  - **`cspOk`** is true when the CSP meta is the second element of `<head>`, there is exactly one `<style>` and one executable `<script>`, and the CSP equals `cspFor` of their texts. A `type="application/json"` script is not executable.
  - **`inlineHandlers`** counts `on…=` attributes.
  - **`uncovered`** is `uncoveredChars` of the whole document.

- [ ] **Step 1: Write the failing tests.**
  - **html:**
    - `esc(`<a href="x">&'`)` → `&lt;a href=&quot;x&quot;&gt;&amp;&#39;`;
    - `jsonIsland("d", { s: "</script><!-- " })` contains no `</script` before its own end, and its text parses back to the value;
    - `displayText("Jordan Example", 44)` uses `t-disp-44`;
    - `displayText("Łukasz", 44)` uses `t-mono-44`.
  - **fmt cases:**
    - `share(0.004) === "<1%"`, `share(0.61) === "61%"`, `share(0.996) === ">99%"`;
    - `count(1234567) === "1,234,567"`, `interval([63, 78]) === "[63–78]"`, `signed(-0.42) === "−0.42"`;
    - `tokens(600_000) === "600k"`, `tokens(1_500_000) === "1.5M"`;
    - `duration(14 * 60_000) === "14 min"`, `duration(130 * 60_000) === "2 h 10 min"`;
    - `day(Date.UTC(2026, 10, 17, 23, 30), "Pacific/Auckland") === "18 Nov 2026"`;
    - `month("2026-11") === "Nov 2026"`, `week("2026-W47") === "W47 2026"`.
  - **fmt across locales** (Review Focus 5): a child `bun -e` that prints all those cases gives byte-identical output under `LANG=de_DE.UTF-8 LC_ALL=de_DE.UTF-8 TZ=Asia/Kolkata` and under `LANG=C TZ=UTC`.
  - **page,** with `fonts: "none"`:
    - `auditHtml(out).cspOk`;
    - the script hash equals the base64 SHA-256 of the `<script>` text;
    - a `body` function receives the same CSP string;
    - two calls give identical bytes;
    - `<html>` carries `data-theme="auto"` by default.
  - **audit:**
    - A crafted document with `<img src="https://x">`, `style="color:red"`, `onclick="x()"`, `url(//x)`, `@import "y"` and `<link href="z">` reports each of them.
    - On `page()` output (fonts embedded): `externalRefs` is `[]`, `styleAttrs` 0, `inlineHandlers` 0, `uncovered` `[]`.
  - **runtime:** `KIT_RUNTIME` contains none of the forbidden tokens.
- [ ] **Step 2: Run** `bun test test/core/viz` → FAIL.
- [ ] **Step 3: Implement** the six modules.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(viz): single-file page shell with hash-pinned CSP, locale-free formatting and an HTML audit`.

---

### Task 5: Primitives I — exhibit frame, seal, assay ledger

**Files:**
- Create: `core/viz/{types,figure,seal,ledger}.ts`, `test/core/viz/{figure,seal,ledger}.test.ts`, `test/core/viz/__snapshots__/` (generated)

**Interfaces:**
```ts
// types.ts
export type RowStatus = "scored" | "insufficient" | "not-measurable" | "not-measured";
export interface LedgerComponent { id: string; label: string; weight: number; status: "ok" | "not-measurable" | "not-measured";
  value: string; z: number | null; n: number; cites?: string[] }
export interface LedgerRow { id: string; label: string; status: RowStatus; score: number | null; interval: readonly [number, number] | null;
  openTail: boolean; confidence: "low" | "medium" | "high" | null; window: "detail" | "lifetime"; note?: string; components: LedgerComponent[] }
export interface LedgerGroup { label: string; rows: LedgerRow[] }
export interface SealInput { state: "struck" | "provisional" | "flagged"; label: string; score: number | null;
  interval: readonly [number, number] | null; coverage: string; ringText: string }
export interface FigureOptions { id: string; letter: string; title: string; tag: string; caption: string; body: string;
  state?: "ok" | "thin" | "empty"; note?: string }
// figure.ts / seal.ts / ledger.ts
export function figure(o: FigureOptions): string;
export function seal(s: SealInput, o?: { size?: number }): string;
export function sealSvg(s: SealInput, o?: { size?: number; idPrefix?: string }): string;   // the seal's <svg> alone, no HTML; seal() wraps it and the share card nests it (pre-flight F15)
export function confidenceDots(c: LedgerRow["confidence"]): string;
export function ledger(groups: readonly LedgerGroup[], o?: { idPrefix?: string }): string;
export function ledgerRuleSvg(row: LedgerRow, o?: { x?: number; y?: number; width?: number }): string;   // one row's rule as a nested <svg viewBox="0 0 400 24">, pure SVG; ledger() and the share card both use it (pre-flight F15)
export function ledgerLegend(): string;   // ◆ score, [ ] interval, triangle open tail, ┆ reference v0 median, dots confidence — all as icons
```

**Rules.** The Design system's grammar for ledger rows, the seal and the exhibit frame, plus:
- each row's summary holds the HTML reading;
- every component row cites its exhibits as `<a class="cite" href="#ex-x" data-cite="ex-x">`;
- a row's `note` is shown in place of the score when the row is not scored.

- [ ] **Step 1: Write the failing tests** on hand-built inputs.
  - **Ledger:**
    - **Scored row, high confidence, 71 [63–78]:**
      - one `m-solid` diamond centred at x = 8 + 3.84·71 = 280.64;
      - an interval from 249.92 to 307.52;
      - 5 ticks and one `m-ref` at x 200;
      - summary text `71`, `[63–78]`;
      - three filled confidence dots;
      - the `aria-label` "Leverage 71, interval 63 to 78, high confidence".
    - **Low confidence:** an `m-hollow` diamond and one filled dot.
    - **`openTail`:** a triangle element beyond x 392.
    - **Insufficient, with note `insufficient (n=12, needs 60) — not enough data yet`:** an `m-hatch` rect, no diamond, and the note text.
    - **Not measured:** the note text; no diamond.
    - **Components:** one table row per component, z shown with `fmt.signed`, and its cite links.
    - **Escaping:** a label `<b>x</b>` appears escaped.
    - **Snapshot:** a 3-group, 7-row input → `toMatchSnapshot()`.
  - **Seal:**
    - struck → `seal--struck` and a filled disc;
    - provisional → no fill, numerals with class `seal-outline`;
    - flagged → vermilion classes;
    - `score: null` → `—`;
    - the interval and the coverage are HTML after the `</svg>`, not text inside it;
    - the ring text is escaped.
  - **Figure:**
    - `<figure class="exhibit" id="ex-c" aria-labelledby="ex-c-t">`, with a header holding `Ex. C`, the title through `displayText`, and the tag;
    - exactly one `<figcaption>`;
    - `state: "empty"` → class `exhibit--empty`, a hatched placeholder and the note.
  - **SVG-only variants** (pre-flight F15): `ledgerRuleSvg(row)` and `sealSvg(s)` start with `<svg` and hold no HTML element, and `ledger()` and `seal()` contain their output unchanged.
  - **All:** `auditHtml(page({ title: "t", footerLeft: "f", body: <all of the above>, fonts: "none" }))` has 0 `styleAttrs`, no `externalRefs` and no `uncovered`.
- [ ] **Step 2: Run** `bun test test/core/viz` → FAIL.
- [ ] **Step 3: Implement** the four modules.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS. The snapshot is written on the first run; commit it.
- [ ] **Step 5: Commit** `feat(viz): assay ledger, seal and exhibit frame`.

---

### Task 6: Exhibit data in core — `computeExhibits`

**Files:**
- Create: `core/exhibits/{types,loupe,delegation,verification,habit,thennow,index}.ts`, `test/core/exhibits/{loupe,delegation,habit,thennow,exhibits}.test.ts`
- Modify: `core/index.ts`, which exports `computeExhibits` and the exhibit types

**Interfaces:**
```ts
export type ExhibitId = "a" | "b" | "c" | "d" | "e" | "f";
export interface Span { from: number; to: number }   // bin indexes, inclusive
export type Spans = number[];   // flat [from, to, from, to, …] bin indexes, inclusive: keeps the worst-case payload in budget (pre-flight F12)
export interface LoupeLane { tool: ToolId; origin: Origin; prompts: number[]; work: Spans; waiting: Spans;
  children: Array<Span & { type: ChildType; background: boolean }>; moreChildren: number }
export interface DayLoupe { kind: "typical" | "peak"; spanMs: number; binMs: number; bins: number; lanes: LoupeLane[]; moreLanes: number;
  stats: { peakConcurrency: number; medianUnattendedMs: number | null; busyShare2: number | null };
  n: { sessions: number; actions: number; prompts: number } }
export interface DelegationGroup { type: ChildType | "workflow"; count: number; actions: number; background: number; children: DelegationGroup[]; more: number }
export interface DelegationExhibit { root: { tool: ToolId; actions: number; groups: DelegationGroup[]; more: number } | null;
  byType: Partial<Record<ChildType, number>>; sessionsWithChildren: number; n: number }
export interface VerificationExhibit { editTurns: number; checked: number | null; failing: number; closed: number | null;
  medianFixCycles: number | null; guardrails: number | null; landed: number | null; reworked: number | null; prsPerWeek: number | null;
  repoSignals: RepoSignals["status"] }
export interface HabitExhibit { weeks: string[]; all: number[]; tools: Array<{ tool: ToolId; days: Array<number | null> }>; moreTools: number;
  features: Array<{ feature: Feature; week: string }>; detailFrom?: string; arcs: Exposure["arcs"] }
export interface ThenNowRow { id: "active-days" | "tools" | "briefs" | "corrections" | "practices"; then: number | null; now: number | null;
  nThen: number; nNow: number; better: "higher" | "lower"; verdict: "better" | "worse" | "same" | "n/a" }
export interface ThenNow { status: "ok" | "insufficient"; spanDays: number; needs: 180; then?: { from: string; to: string };
  now?: { from: string; to: string }; rows: ThenNowRow[] }
export interface Exhibits { a: DayLoupe[]; b: DelegationExhibit; c: VerificationExhibit; d: HabitExhibit; e: ThenNow }
export interface ExhibitsLocal { activeRepoKeys: string[] }   // in memory only; never exported
export const LOUPE_MAX_BINS = 600; export const LOUPE_MAX_LANES = 12; export const LOUPE_MAX_CHILDREN = 24;
export const DELEGATION_MAX_GROUPS = 8; export const DELEGATION_MAX_TOTAL = 48; /* whole tree (pre-flight F12) */ export const HABIT_MAX_TOOLS = 8; export const THEN_NOW_NEEDS_DAYS = 180;
export function computeExhibits(raw: ScanResult, a: Analysis, o?: { exclude?: Exclusions }): { exhibits: Exhibits; local: ExhibitsLocal };
```

**Algorithms.** These are the rules; the signatures do not determine them.
- **Table.**
  - The session table is `t = buildSessionTable(raw, { now: a.meta.now, timeZone: a.meta.timeZone, exclude: o.exclude })`.
  - **Actions** follow Plan 2's walk rule 2: tool events whose category is not `meta` and whose `outcome` is not `denied` or `cancelled`. Import `isAction` from `core/analysis/walk.ts` and never restate the rule (pre-flight F14).
  - A row's events are its own events plus those of all its descendants (`children`, recursively).
- **Ex.A, the day under the loupe.**
  - **Candidate days:** `t.activity.detailDays`.
  - **A day's actions:** those of `detailTop` rows whose `ts` falls on that day (`dayKey`).
  - **typical:** sort the candidate days by (action count, day) ascending and take the one at index `floor((k − 1) / 2)`, where `k` is their number.
  - **peak:** the day with the most `detailTop` rows that have an action in one `BUCKET_MS` bucket. Ties go to more actions, then to the later day. If the peak day equals the typical day, only the typical loupe is kept.
  - **Lanes:** the day's `detailTop` rows that have an action or a human prompt, ordered by their first event. Beyond `LOUPE_MAX_LANES`, the rest count as `moreLanes`.
  - **Bins:**
    - `span` runs from the day's first event to its last;
    - `binMs = max(60_000, ceil(span / 600 / 60_000) · 60_000)`;
    - `bins = max(1, ceil(span / binMs))`, which is at most 600.
  - **Per lane:**
    - `prompts`: the distinct bins of the row's human prompts (`t.isHuman`);
    - `work`: maximal runs of bins that hold an action of the row or a descendant;
    - `waiting`: from the end of a work run to the row's next prompt, when that gap is under `TASK_GAP_MS`;
    - `children`: the descendant rows active that day, as `childType(agentType)` with `background`, up to `LOUPE_MAX_CHILDREN`; the rest count as `moreChildren`.
  - **Stats:**
    - `peakConcurrency`: the most lanes with work in one bin;
    - `medianUnattendedMs`: the median length of the work runs that hold no prompt, times `binMs`;
    - `busyShare2`: the share of working bins in which at least 2 lanes work.

    The last two are null with no work.
  - **Nothing absolute:** no timestamp or day appears in a `DayLoupe`.
- **Ex.B, the delegation outline.**
  - **Root:** the `detailTop` row with the most descendants. Ties go to more descendant actions, then to the later start. With no row that has children, `root` is null.
  - **Groups:** siblings with a `workflowId` form one group per workflow (`type: "workflow"`, `count` 1, its agents as `children` grouped by type); the other siblings are grouped by `childType(agentType)`, so a level has at most 6 type groups (pre-flight F5). Each group has `count`, `actions` and `background`.
  - Groups nest to depth 3 and are sorted by actions, descending. At most `DELEGATION_MAX_GROUPS` are kept per level, and at most `DELEGATION_MAX_TOTAL` in the whole tree, kept breadth first; the rest go to their parent's `more` (pre-flight F12).
  - **`byType`:** `a.signals.childTypes`.
  - **`sessionsWithChildren`:** `detailTop` rows with at least one child. **`n`:** `detailTop` rows.
- **Ex.C, the verification loop.** It is read from `a.signals`:
  - `editTurns`: `evidence.editTurns`;
  - `checked`: `vae.value`;
  - `failing`: `closure.n`;
  - `closed`: `closure.value`;
  - `medianFixCycles`;
  - `guardrails`, `landed` (`landedShare`), `reworked` (`reworkShare`) and `prsPerWeek`, each the metric's `.value`;
  - `repoSignals`.
- **Ex.D, habit and rotation.**
  - `weeks` and `all` come from `a.exposure.weekly`: its weeks and their `activeDays`.
  - **Per tool:** for each tool in `t.activity.byTool`, every week holds the number of distinct days of `detailDays ∪ lifetimeDays` in it.
    - A week that ends before the earliest `from` of any of that tool's `a.coverage` rows is `null`, meaning not retained.
    - Tools are ordered by total active days, descending. At most `HABIT_MAX_TOOLS` are kept; the rest count as `moreTools`.
  - **`features`:** `isoWeek(dayKey(a.exposure.firstSeen[f], tz))` for each feature with a first-seen time.
  - **`detailFrom`:** the week of the earliest detail-window coverage `from`.
  - **`arcs`:** `a.exposure.arcs`.
- **Ex.E, then and now.**
  - **Span:** first to last of `t.activity.lifetimeDays`, inclusive. Under `THEN_NOW_NEEDS_DAYS`, the status is `insufficient` and there are no rows.
  - **Windows:** `then` is the first 90 days of the span; `now` is the 90 days ending at `dayKey(a.meta.now)`. Both are labelled `YYYY-MM`.
  - **Prompts:** lifetime-window prompts that are `t.isHuman`.

  | row | value in a window | better | at least n | same when |
  |---|---|---|---|---|
  | `active-days` | active lifetime days ÷ (90/7) | higher | — | \|Δ\| < 0.5 |
  | `tools` | distinct tools with an active day (`byTool`) | higher | — | equal |
  | `briefs` | share of `isTaskStart` prompts whose `briefScore(features)` (Plan 2's walk rule 11, imported, pre-flight F14) is at least 0.4 | higher | 20 | \|Δ\| < 0.05 |
  | `corrections` | share of prompts with intent `correction` | lower | 50 | \|Δ\| < 0.05 |
  | `practices` | features with a first-seen time at or before the window's end | higher | — | equal |

  A row under its minimum `n` in either window is `n/a`.
- **Local:** `activeRepoKeys` are the distinct `repoKey`s of `detailTop` rows.

- [ ] **Step 1: Write the failing tests,** on hand-built `scanResultOf` stores and on personas.
  - **`loupe.test.ts`:**
    - **Day choice:** three days with 2, 1 and 4 overlapping sessions → `typical` is the lower-median day by actions, and `peak` is the 4-session day.
    - **Bins:** a 23-hour day has `bins` of at most 600 and a `binMs` that is a whole minute.
    - **Spans:** consecutive action bins form one work span; waiting ends at the next prompt; an Explore child gives `type: "explore"`.
    - **Caps:** 15 sessions in a day → 12 lanes and `moreLanes: 3`. A lane with 30 children → 24 children and `moreChildren: 6`.
    - **Relative only:** `JSON.stringify(loupes)` contains no 13-digit number.
  - **`delegation.test.ts`:**
    - **Groups:** a session with 3 Explore children and one workflow with 4 agents → groups `[workflow ×1 (4 agents), explore ×3]`, ordered by actions.
    - **Caps** (Review Focus 3): 300 children across 20 workflows → 8 groups and `more: 12`; 300 children of 20 agent types → at most 6 groups (pre-flight F5).
    - **Whole tree** (pre-flight F12): a tree with 8 groups at each of 3 levels keeps 48 groups, breadth first, and counts the rest in `more`.
    - **None:** a home without delegation → `root: null`.
  - **`habit.test.ts`:**
    - 52 weeks;
    - a tool whose coverage `from` lies in the ISO week 9 weeks before now's week → its first 42 weeks are `null` (pre-flight F22);
    - a week with 7 active days → 7;
    - 10 tools → 8 tools and `moreTools: 2`;
    - each feature maps to its week.
  - **`thennow.test.ts`:**
    - a 100-day span → `insufficient`, `spanDays: 100`;
    - a 400-day store → 5 rows;
    - each "same when" threshold, on both sides;
    - `corrections` falling from 0.2 to 0.1 → `better`;
    - fewer than 20 task starts → `briefs` is `n/a`.
  - **`exhibits.test.ts`:**
    - `computeExhibits(personaScan("expert"), analyze(…))` run twice is deep-equal, and round-trips through JSON with finite numbers only;
    - `expectNoCanaries(exhibits)` on `personaScan("expert", { canaries: true })`;
    - `local.activeRepoKeys` are 16-hex strings;
    - an empty `ScanResult` → `a: []`, `b.root: null`, `e.status: "insufficient"`, `d.all` all 0, and no NaN anywhere;
    - on `synthStore(300_000)` it finishes in at most 2 s (Review Focus 3).
- [ ] **Step 2: Run** `bun test test/core/exhibits` → FAIL.
- [ ] **Step 3: Implement** the modules.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(exhibits): pre-binned exhibit data — day under the loupe, delegation, verification, habit, then and now`.

---

### Task 7: Primitives II — exhibit renderers

**Files:**
- Create: `core/viz/{labels,swimlanes,delegation,funnel,habit,thennow,bars,coverage}.ts`, `test/core/viz/{swimlanes,habit,primitives}.test.ts`

**Interfaces:**
```ts
// labels.ts — domain nouns shared by both apps
export const TOOL_LABEL: Readonly<Record<ToolId, string>>;          // "Claude Code", "Codex", "Copilot", "Cursor", "Antigravity", …
export const CHILD_LABEL: Readonly<Record<ChildType | "workflow", string>>;   // "Explore", "Plan", "Review", "Implement", "Custom", "Other", "Workflow"
export const FEATURE_LABEL: Readonly<Record<Feature, string>>;     // "subagents", "workflows", "background agents", "plan mode", …
export const WINDOW_LABEL: Readonly<Record<Window, string>>;       // DETAIL, LIFE
// primitives
export function swimlanes(d: DayLoupe, o: { id: string }): string;
export function delegationOutline(d: DelegationExhibit): string;
export interface FunnelLabels { edits: string; checked: string; unchecked: string; failing: string; closed: string; still: string;
  cycles: string; guardrails: string; landed: string; reworked: string; prs: string; notMeasured: string }
export function verificationFunnel(d: VerificationExhibit, o: { labels: FunnelLabels }): string;
export function heatmap(cells: ReadonlyArray<0 | 1 | 2 | 3 | 4 | null>, o: { columns: number }): string;
export function habitLanes(d: HabitExhibit): string;
export function thenNowTable(d: ThenNow, o: { rowLabel: (id: ThenNowRow["id"]) => string; value: (row: ThenNowRow, v: number) => string }): string;
export interface BarItem { label: string; value: number; display: string }
export function barList(items: readonly BarItem[], o?: { max?: number }): string;
export function smallMultiples(panels: ReadonlyArray<{ title: string; body: string }>): string;
export interface CoverageCell { window: Window; status: CoverageEv["status"] | "none"; beta: boolean; span: string }
export interface CoverageRow { tool: ToolId; cells: CoverageCell[] }
export function coverageStrip(rows: readonly CoverageRow[]): string;
```

**Rules.**
- Each primitive follows the Design system grammar and the path-per-class rule.
- **Funnel flags:** the "unchecked" row (1 − `checked`) gets `m-flag` and a flag icon when it is at least 0.25. The "closed" row gets `m-pass` when it is at least 0.8.
- **Funnel without repo signals:** when `repoSignals` is `off` or `git-missing`, the delivery rows are `m-hatch` with `labels.notMeasured`.

- [ ] **Step 1: Write the failing tests.**
  - **`swimlanes.test.ts`:**
    - **Element bound** (Review Focus 3):
      - a worst-case loupe of 12 lanes over a 24-hour span, with 600 bins, alternating work bins, 120 prompts and 24 children per lane, has at most 150 elements (`auditHtml(...).elements`);
      - the same 12 lanes and span with one work run and one prompt per lane has exactly as many elements, so the count depends only on lanes and ticks.
    - **Path data:** work spans appear as one `m-solid` path per lane; the axis ticks use `T+Nh` labels.
    - **Box:** the wrapper is `.scroll-x` with a `min-width` class for 960.
    - **Escaping:** a lane's tool label is escaped.
  - **`habit.test.ts`:**
    - 52 columns;
    - `null` weeks draw in the `m-hatch` path;
    - levels follow `heatLevel`;
    - each row has one path per level used;
    - the `DETAIL` bracket appears when `detailFrom` is set;
    - features draw as one diamond path, plus a text legend that names each feature and week;
    - `heatmap([0, 1, null], { columns: 3 })` → 3 classed paths.
  - **`primitives.test.ts`:**
    - **Funnel:** `checked: 0.8` → no flag; `checked: 0.75` → a flag, the exact boundary (pre-flight F4); `repoSignals: "off"` → the delivery rows say `notMeasured`.
    - **Delegation outline:** text `Explore × 3 · 41 actions`, nested `<ol>`, and `more` shown as `+12 more`. A tree at the caps (48 groups over 3 levels) has at most 500 elements, and 10× the children gives the same count (pre-flight F12).
    - **Then and now:**
      - `better` → `m-pass`, `worse` → `m-flag`, `same` → `m-axis`, `n/a` → `m-hatch`;
      - `insufficient` → a message naming the span and the 180 days needed.
    - **Coverage strip:**
      - `drift` → flag and "format changed?";
      - `absent` → "not found";
      - `present-undecodable` → hatch;
      - `error` → flag and "could not read" (pre-flight F24);
      - beta → a `beta` tag.
    - **Bar list:** widths are proportional to `value / max`.
    - **All:** `auditHtml` on a page of every primitive: no style attributes, no external refs, no uncovered characters, `cspOk`.
- [ ] **Step 2: Run** `bun test test/core/viz` → FAIL.
- [ ] **Step 3: Implement** the modules.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(viz): exhibit primitives — swimlanes, delegation outline, funnel, habit lanes, then and now, bars, coverage`.

---

### Task 8: `renderKit`, the `./viz` export, and an A-consumer contract

**Files:**
- Create: `core/viz/index.ts`, `test/viz/consumer.test.ts`
- Modify: `package.json`, whose `exports` becomes `{ "./core": "./core/index.ts", "./viz": "./core/viz/index.ts" }`; `core/index.ts`, which exports `renderKit` and `export type * from "./viz/types"`

**Interfaces:**
- **Produces:** `renderKit`, with exactly the keys that the Interfaces for Plan 4 section lists.
- **`labels`** is `{ tool: TOOL_LABEL, child: CHILD_LABEL, feature: FEATURE_LABEL, window: WINDOW_LABEL }`.
- **`version`** is `package.json`'s version. `viz/index.ts` imports the JSON directly, so that `core/index.ts` does not import itself.
- **Named exports:** every member, and every kit type.

- [ ] **Step 1: Write the failing test** `consumer.test.ts`. It imports only from `ai-practice-report/viz` and `ai-practice-report/core`; Bun and `tsc` both resolve the package's own name.
  - **Same object:** both paths give the same `renderKit`, and `Object.keys(renderKit).sort()` equals the pinned list.
  - **Render as A would:**
    1. Take `payload = exportPayload(analyze(personaScan("expert")), { schema: "aiprof/2" }).value`.
    2. Map `payload.dimensions` onto `LedgerRow`s, and the overall onto a `SealInput`.
    3. Render `renderKit.page({ body: seal + ledger + figure(habitLanes(computeExhibits(raw, a).exhibits.d)) })`.

    Expected: the audit's `cspOk`, no external refs, no uncovered characters, fewer than 5,000 elements, and identical bytes on a second run.
  - **Types:** `import type { LedgerRow, DayLoupe, Exhibits } from "ai-practice-report/viz"` and `"ai-practice-report/core"` compile.
- [ ] **Step 2: Run** `bun test test/viz` → FAIL.
- [ ] **Step 3: Implement** the index and the exports.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(viz): renderKit public surface for both apps`.

---

### Task 9: App logic — copy, names, upgrades, verdict, seal state

**Files:**
- Create: `app/copy.ts`, `app/names.ts`, `app/report/{upgrades,verdict}.ts`, `test/app/{copy,names,upgrades,verdict}.test.ts`

**Interfaces:**
```ts
// app/copy.ts
export const PRIVACY_STATEMENT: readonly string[];   // the six sentences below, exactly
export const DIMENSION_LABEL: Readonly<Record<DimensionId, string>>;   // Leverage, Orchestration, Steering, Verification, Delivery, Context, Judgment
export const LEDGER_GROUPS: ReadonlyArray<{ label: string; dims: readonly DimensionId[] }>;
  // WORKING WITH AGENTS: leverage, orchestration, steering · QUALITY: verification, delivery · SETUP & JUDGMENT: context, judgment
export type ValueUnit = "share" | "rate" | "count" | "rho" | "tokens" | "log2" | "of3" | "of5";
export interface ComponentCopy { label: string; unit: ValueUnit; cites: ExhibitId; title: string; evidence: string; why: string; steps: readonly string[] }
export const COMPONENT: Readonly<Record<string, ComponentCopy>>;      // the 22 rows below
export const VERDICT_PHRASE: Readonly<Record<DimensionId, string>>;
export const BAND_LABEL: Readonly<Record<Band, string>>;              // Exceptional, Strong, Developing, Limited, Insufficient evidence
export const HEALTH_TEXT: Readonly<Record<Forensics["band"], string>>;
export const CHECK_LABEL: Readonly<Record<CheckId, string>>;
export const REASON_TEXT: Readonly<Record<string, string>>;   // one sentence per CheckResult.reason code that core/forensics emits (pre-flight F24)
// app/names.ts
export interface NameBook { projects: Record<string, string> /* label → name */; config: Record<string, string> /* key → name */ }
export function cleanName(s: string): string;   // control chars → "?", whitespace collapsed, at most 40 chars ending "…"
export function buildNames(raw: ScanResult, a: Analysis, o: { anonymize: boolean; home: string; platform: Platform }): NameBook;
// one per repo in raw.repos.repos (Plan 2's RepoFacts); not named RepoFacts, so the two types never meet in one import
export interface RepoSummary { label: string; name: string; projectLabels: string[]; sessions: number; active: boolean;
  has: { hook: boolean; ci: boolean; testInInstructions: boolean; maintained: boolean } }
export function repoSummaries(raw: ScanResult, a: Analysis, local: ExhibitsLocal, o: { anonymize: boolean; home: string; platform: Platform }): RepoSummary[];
// app/report/upgrades.ts
export interface Upgrade { component: string; dimension: DimensionId; title: string; evidence: string; cites: ExhibitId; why: string; steps: string[]; repos: string[] }
export function componentValue(id: string, raw: number | null, a?: Analysis): string;
export function pickUpgrades(a: Analysis, repos: readonly RepoSummary[]): Upgrade[];
// app/report/verdict.ts
export function verdict(a: Analysis): string;
export function sealState(a: Analysis): { state: "struck" | "provisional" | "flagged"; label: string };
```

**PRIVACY_STATEMENT** (exact; adapted from §6.7 for B):
1. "ai-practice reads your local agent history files, which contain your prompts, replies and code, in memory to count things."
2. "It keeps none of the text, never opens credential files, and makes no network requests."
3. "Mixed files such as ~/.claude.json are parsed in memory and only allowlisted fields are kept."
4. "In the git repositories your sessions ran in, it reads commit metadata and a short list of config files (see --explain), never source files; --no-repo-signals turns this off."
5. "Your report stays on this machine and shows the real names of your projects and of your own skills, commands and MCP servers; --anonymize replaces them with labels."
6. "Nothing is shared: a share card or an employer export is written only when you ask for one, and the report's Share section shows every field of the card and every byte of the export." (pre-flight F19)

**COMPONENT.**
- `{v}` is `componentValue(id, c.raw)`, by unit:
  - `share` → `fmt.share`;
  - `rate` → one decimal (`ste.turnsPerWork`: two);
  - `count` → an integer (`ctx.artifacts`: one decimal);
  - `rho` → two decimals;
  - `tokens` → `fmt.tokens`;
  - `log2` → two decimals;
  - `of3` → `(3v)` to one decimal, plus ` of 3`;
  - `of5` → `(5v)` to one decimal, plus ` of 5 marks`.
- `{inv}` is `fmt.share(1 − raw)`.
- `{n}` is the component's `n`.
- `{apt}` is `fmt.decimal(a.signals.actionsPerTurn.value, 1)`.

| id · unit · cites | title | evidence | why | step |
|---|---|---|---|---|
| lev.sticky · log2 · a | Let each prompt carry more work | about {apt} actions per typed turn (n={n} turns) | Long runs you do not have to undo are where agents save the most time. | Front-load the brief: the goal, the constraints, the files involved and how to check the result. |
| lev.run · count · a | Plan for longer unattended runs | your longest successful runs reach {v} actions (90th percentile) | Long runs pay off when they need no rescue. | Give the agent a definition of done it can test, then let it run; step in at the first wrong turn. |
| orc.parallel · share · a | Run a second agent while the first works | {v} of your active ten-minute windows had two sessions working | Parallel sessions turn waiting time into output. | Start a second session in another worktree for an independent task. |
| orc.fanout · rate · b | Delegate the searching | {v} finished subagents per episode | Subagents keep the main context clean and run in parallel. | Ask for an explore subagent for codebase searches and a review subagent before you accept a change. |
| orc.headless · rate · a | Script the runs you repeat | {v} scripted runs per active week | A headless run turns a routine chore into one command. | Pick one weekly chore and run it from a script with `claude -p` or `codex exec`. |
| orc.background · share · b | Send long tasks to the background | {v} of child runs ran in the background | Background agents let you keep steering while long work runs. | Run long subagent tasks in the background and keep working with the main agent. |
| ver.vae · share · c | Close the loop after edits | {inv} of edit work had no passing check after the last edit (n={n} edit turns) | Agents report success confidently; a check after the last edit is what makes "done" true. | Add a hook that runs your tests after edits, or name the test command in CLAUDE.md or AGENTS.md. |
| ver.closure · share · c | Finish on green | {inv} of failing checks were still failing when the episode ended | A red check left behind is work you redo later. | Ask the agent to fix, re-run and report the final result before it stops. |
| ver.guardrails · of3 · c | Put a guardrail in each active repo | your active repos have {v} guardrails on average | Hooks, CI and instructions that name your checks make verification automatic. | In each repo listed, add a check-running hook, a CI or pre-commit check, or the test command in the instruction file. |
| ste.correction · share · e | Brief so you rarely need to correct | {v} of your task briefs were followed by a correction | Most corrections come from a constraint the brief left out. | Put the constraint you most often correct for into the first message or the instruction file. |
| ste.interrupts · share · a | Interrupt early, with a new direction | {v} of your interrupts were early, substantive redirects | An early redirect saves the run; a late one throws it away. | Stop a run that starts wrong within its first few actions, and say what to do instead. |
| ste.turnsPerWork · rate · a | Fewer nudges per unit of work | {v} typed turns per doubling of agent work | Each follow-up costs your time. | Batch small follow-ups into one message, and let the agent run the checks. |
| ctx.instructions · share · f | Keep an instruction file in each active repo | {v} of your active repos keep a maintained instruction file | Instructions are context your agent gets on every task. | Add or update CLAUDE.md or AGENTS.md in the repos listed: build, test and lint commands, conventions, what not to touch. |
| ctx.artifacts · count · f | Turn repeated prompts into skills | {v} provenance-weighted skills, commands, agents, plugins and MCP servers in use | Your own skills capture what you would otherwise retype. | Write one skill or command for the instruction you repeat most, and use it this week. |
| ctx.hygiene · share · a | Start fresh at task boundaries | {v} of your compactions and episode starts were deliberate | A clean context keeps the last task's details from steering the next. | Clear, or start a new session, when you switch tasks; compact deliberately before long runs. |
| ctx.briefs · of5 · e | Give the first message structure | your task briefs meet {v} on average | Context, file references, steps, constraints and enough detail make the first run land. | Use a short template: goal, files, constraints, how to check. |
| jud.switches · rate · f | Match the model to the task | {v} deliberate model or effort switches per active week | The right tier saves cost on small tasks and quality on hard ones. | Use a small model or low effort for lookups and renames; switch up for design and debugging. |
| jud.rho · rho · f | Use the big model for the big tasks | model tier and task size correlate at rho {v} | When tier tracks task size, you pay for capability where it matters. | Raise the model or effort before a large task, and drop it again for the follow-ups. |
| jud.cost · tokens · f | Spend fewer tokens per landed change | {v} fresh tokens per landed commit or PR | Tokens that never land are rework or exploration you can trim. | Clear between tasks, delegate searches, and commit when a check passes. |
| del.landed · share · c | Land the work | {v} of edit episodes reached a commit or PR within a day | Work that lands is work you can build on. | End each task with a commit once the checks pass. |
| del.rework · share · c | Check before you commit | {v} of commits were reverted or fixed up within 72 h | Rework within days usually means a check that did not run. | Run the full test suite and review the diff before you commit agent work. |
| del.prs · rate · c | Open PRs for agent work | {v} PRs per active week | A PR gives agent work a review step and a record. | Ask the agent to open a PR at the end of each finished task. |

The component labels for the ledger tables, in id order:
- Sticky work per turn
- Longest successful runs
- Parallel sessions
- Subagents per episode
- Scripted runs per week
- Background share
- Checked after the last edit
- Failing checks closed
- Guardrails per repo
- Briefs needing correction
- Early, substantive interrupts
- Turns per unit of work
- Maintained instruction files
- Artifacts in use
- Deliberate resets
- Brief structure
- Deliberate switches per week
- Tier matches task size
- Tokens per landed change
- Landed within a day
- Reworked within 72 h
- PRs per week

**Verdict.**
- **Phrases:**
  - leverage: "you get long runs of useful agent work from each prompt"
  - orchestration: "you run several agents at once"
  - verification: "you check agent edits with tests and builds"
  - steering: "you steer early and rarely need to correct"
  - context: "you keep your agents briefed with maintained instructions and your own tools"
  - judgment: "you match the model to the size of the task"
  - delivery: "your agent work lands as commits and PRs"
- **Choice:** take the dimensions scored at medium or high confidence with a score of at least 60, ordered by z′ descending and then by id, and keep at most 2.
- **Habit clause.** Let tenure be `exposure.tenureWeeks` and active weeks `exposure.activeWeeks.lifetime`.
  - With tenure of at least 8 weeks and `active / tenure` of at least 0.6: "you have kept that up most weeks for {m} months", where m = max(2, round(tenure / 4.345)).
  - Otherwise, with tenure of at least 8 weeks: "over {active} active weeks".
  - Otherwise there is no habit clause.
- **Joining:**
  - one clause → "C1.";
  - two → "C1 and C2.";
  - three → "C1, C2, and C3.";
  - the first letter is capitalized.
- **Fallbacks:**
  - with no scored dimension: "Not enough evidence yet for a reading: the exhibits below show what was measured.";
  - with scored dimensions but none qualifying: "Your practice is still taking shape: the upgrades below are where the evidence points."

**Other copy.**
- **Seal labels:**
  - struck → `BAND_LABEL[overall.band]`, upper-cased;
  - provisional → `PROVISIONAL`;
  - flagged → `CHECK DATA`.
- **HEALTH_TEXT:**
  - consistent: "Consistent: every check that could run passed."
  - consistent-with-notes: "Consistent, with notes: nothing failed; the notes below are worth a look."
  - inconsistent: "Inconsistent: at least one check failed. Restored or copied history explains most failures."
  - unverifiable: "Unverifiable: none of the tools here keep server-issued ids this report can check. That is neutral, not a problem."
- **CHECK_LABEL:**
  - C1 Message ids follow time
  - C2 Id order matches time order
  - C3 History matches transcripts
  - C4 One account
  - C5 File times
  - C6 Every Codex rollout is indexed
  - C7 Rollout ids match file names
  - C8 Rate-limit ledger moves forward
  - C9 Models and versions existed then
  - C10 Where prompts came from
  - soft:rhythm Prompt rhythm
  - soft:repeated-long Repeated long prompts
  - soft:recent-burst Recent burst of activity
  - soft:unclosed-tools Tool calls without results
  - soft:new-config Recently added setup

**Names and repos** follow builder's call 7.
- `repoSummaries` returns one `RepoSummary` per entry of `raw.repos.repos`.
- A repo's `label` is the label of its project with the most sessions. Its `name` comes from `raw.repos.roots.get(repoKey)`, by the same rules as a project's name; with no root, the name is the label. Under `--anonymize`, the name is the label.
- `projectLabels` are the labels of its `projectKeys` found in `a.projects`, and `sessions` is the sum of their `sessions`.
- `has`:
  - `hook`: the repo's hooks have checks and are not disabled;
  - `ci`: `ci` or `precommit` has checks;
  - `testInInstructions`: `namesChecks` includes `test`;
  - `maintained`: there are instruction files and `touched` is at least 1.
- `active` means the repo is in `local.activeRepoKeys`.
- **Repos in upgrades:**
  - `ver.guardrails` lists the active repos without `ci` or without `testInInstructions`;
  - `ctx.instructions` lists the active repos without `maintained`;
  - each lists at most 5, by sessions, descending.

- [ ] **Step 1: Write the failing tests.**
  - **`copy.test.ts`:**
    - the keys of `COMPONENT` equal the component ids of `loadReference("v0")` (22);
    - every `CheckId` has a label;
    - every `reason` that `analyze` emits for the three personas and the empty `ScanResult` has a `REASON_TEXT` entry (pre-flight F24);
    - `uncoveredChars` over every copy string is `[]`;
    - no copy string contains `%` followed by "match".
  - **`names.test.ts`** (Review Focus 2):
    - cwd `/Users/x/clients/AcmeSecretProject` → `AcmeSecretProject`;
    - a cwd equal to the home → `~`;
    - two `web` basenames → `web · P-…` for each;
    - a 300-character name → 40 characters ending in `…`;
    - control characters → `?`;
    - `<img src=x onerror=alert(1)>` is kept raw in the `NameBook`, since escaping is the renderer's job (Task 12);
    - an RTL or emoji name is kept;
    - no value contains the home path or a path separator;
    - `--anonymize` → labels; MCP `github` stays, `CANARY.mcp` → `custom #1`, a skill → `skill #1`; every MCP label equals the one `mcpLabels(a.private.config)` gives, the export's numbering (pre-flight F15).
  - **`repoSummaries`,** over stub Plan 2 `RepoFacts`:
    - a repo with check-running hooks, CI and maintained instructions that name `test` has all of `has` true;
    - a repo without CI or pre-commit checks has `ci: false`;
    - `active` follows `local.activeRepoKeys`;
    - a repo missing from `roots` is named by its label.
  - **`upgrades.test.ts`:**
    - the intermediate persona → 3 upgrades in distinct dimensions, ordered by priority, each `cites` in a–f;
    - a hand-built analysis whose weakest component is `ver.guardrails`, with two active repos lacking CI → that upgrade lists both repos' names, busiest first;
    - no chosen component has `zAdj ≥ 0.5`;
    - a fixture where every component has `z ≥ 0.6` and every dimension has `ratio: 10`, so every `zAdj` is at least 0.545 → `[]` (pre-flight F7);
    - each upgrade's evidence has no `{` left, and every value its template fills (`{v}`, `{inv}`, `{n}`, `{apt}`) appears in it (pre-flight F7);
    - `componentValue` gives "39%" for share 0.39, "600k" for tokens 600,000, "0.15" for rho 0.153, and "2.0 of 5 marks" for of5 0.4.
  - **`verdict.test.ts`:**
    - the expert persona → a sentence starting with a capital and ending with ".", which holds the phrases of its top 2 qualifying dimensions;
    - the novice persona → one of the two fallback sentences, with no phrase;
    - an empty `ScanResult` → the not-enough-evidence sentence;
    - **`sealState`:**
      - forensics `inconsistent` → `flagged`, `CHECK DATA`;
      - overall insufficient → `provisional`;
      - a scored overall with forensics `unverifiable` → `struck`, with the band label.
- [ ] **Step 2: Run** `bun test test/app` → FAIL.
- [ ] **Step 3: Implement** the four modules.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(app): names, upgrade recipes, verdict and seal state`.

---

### Task 10: Shareable surfaces — share card and the unsigned employer export

**Files:**
- Create: `core/privacy/bundle.ts`, `app/export/employer.ts`, `app/share/{fields,card}.ts`, `test/core/privacy/bundle.test.ts`, `test/app/share.test.ts`
- Modify: `core/index.ts`, which exports `selfReportedBundle`, `isSelfReported` and `SelfReportedBundle`

**Interfaces:**
```ts
// core/privacy/bundle.ts — shared, so that A's verify recognizes B's exports
export interface SelfReportedBundle { format: "aiprof/2"; meta: { producer: "ai-practice-report"; version: string; core: string;
  createdAt: string /* YYYY-MM-DD */; selfReported: true }; payload: unknown; signature: null }
export function selfReportedBundle(exported: ExportResult, meta: { version: string; core: string; createdAt: string }): { value: SelfReportedBundle; json: string; bytes: number };
export function isSelfReported(v: unknown): v is SelfReportedBundle;
// app/export/employer.ts
export function employerExport(a: Analysis, exported: ExportResult): { json: string; bytes: number };
  // selfReportedBundle(exported, { version: VERSION, core: a.meta.core, createdAt: localDay(a.meta.now, a.meta.timeZone) })
// app/share/fields.ts
export const CARD_FIELDS: readonly ["name", "roles", "ledger", "band", "date"];
export type CardField = (typeof CARD_FIELDS)[number];
export function parseCardFields(s: string | undefined, hasName: boolean): CardField[] | { error: string };
// app/share/card.ts
export interface ShareCard { name?: string; roles: string[];
  ledger: Array<{ id: DimensionId; label: string; status: DimensionResult["status"]; score: number | null; interval: [number, number] | null; openTail: boolean; confidence: Confidence | null }>;
  band: { state: "struck" | "provisional" | "flagged"; label: string; score: number | null; interval: [number, number] | null; coverage: string };
  date: string /* "Nov 2026" */ }
export function shareCardModel(a: Analysis, o: { name?: string }): ShareCard;
export const CARD_CSS: string;   // fixed ink colours; used in the standalone SVG and in the report page
export function shareCardSvg(card: ShareCard, fields: readonly CardField[], o: { fonts: "embed" | "none"; inline?: boolean }): string;
```

**Rules.**
- **Bundle:** `json` is `canonicalJson(value)`, and `payload` is `exported.value`.
- **`parseCardFields`:**
  - undefined → `roles`, `ledger`, `date`, plus `name` when `hasName`;
  - the result is ordered as in `CARD_FIELDS`, with duplicates removed;
  - an unknown field, or `name` without `hasName`, is an error.
- **Card layout** (1200×630, ink palette):
  - `AI PRACTICE REPORT`: display 28, gold;
  - the name: display 44, or mono via `displayText`;
  - `READS AS` with the roles: mono 20;
  - the ledger on the right: 7 rows with label, rule, ◆ and interval, and score, and no counts; each rule is `ledgerRuleSvg` (pre-flight F15);
  - the band: a mini seal, `sealSvg` (pre-flight F15);
  - the date: mono 14;
  - footer, mono 12 `faint`: "ai-practice-report · scores vs reference v0, not a population · github.com/build-with-bala/ai-practice-report" (text, no link).
- **Groups:** each field is a `<g data-field>`, and unchosen groups are left out.
- **Inline mode** (`inline: true`) has no `<style>` and no fonts; the page's CSS styles its classes.
- **Standalone mode** embeds `CARD_CSS` plus `fontFaceCss({ families: ["display", "mono"] })`.

- [ ] **Step 1: Write the failing tests.**
  - **`bundle.test.ts`:**
    - `value.payload` deep-equals `exported.value`, and `json === canonicalJson(value)`;
    - `bytes === Buffer.byteLength(json)`;
    - `isSelfReported` is true for it, and false for a bare payload and for the bundle with a non-null `signature`.
  - **`share.test.ts`:**
    - **Export:** `employerExport` on the canaries fixture → `findCanaries(json)` is `[]` (Review Focus: names never in exports); `projects` carry labels and no `name`. This holds because Plan 2 Task 9 gives canary model ids no vendor prefix (pre-flight F25).
    - **Card, standalone:** `shareCardSvg(card, ["roles", "ledger", "date"], { fonts: "embed" })`:
      - starts with `<svg xmlns="http://www.w3.org/2000/svg"` and has width 1200 and height 630;
      - has exactly one `<style>`, holding display and mono faces and no serif face;
      - has no `data-field="name"` group;
      - every `href` and `url(` points at `data:` or `#`;
      - `findCanaries(svg)` is `[]` on the canaries fixture.
    - **Card, inline:** no `<style>` and no `@font-face`.
    - **Card model keys:** `Object.keys(card)` ⊆ {name, roles, ledger, band, date}, and each ledger entry has exactly the pinned keys, so there are no counts.
    - **`parseCardFields` cases:** undefined, `"roles,band"`, duplicates, `"name"` without a name (error), `"x"` (error).
    - **Determinism:** two renders are identical.
- [ ] **Step 2: Run** `bun test test/core/privacy/bundle.test.ts test/app/share.test.ts` → FAIL.
- [ ] **Step 3: Implement** the modules.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(app): share card and the unsigned employer export`.

---

### Task 11: Report model

**Files:**
- Create: `app/report/model.ts`, `test/kit/report.ts`, `test/app/model.test.ts`, `test/app/__snapshots__/` (generated)

**Interfaces:**
```ts
export interface ReportOptions { name?: string; anonymize: boolean; cardFields: CardField[];
  outputs: { stem: string; report: string; json?: string; card?: string; export?: string } /* file names only, never paths (pre-flight F20); stem from OutputPaths (pre-flight F13) */ }
export interface ReportInput { raw: ScanResult; analysis: Analysis; exhibits: Exhibits; local: ExhibitsLocal; exported: ExportResult;
  options: ReportOptions; env: Pick<Env, "home" | "platform"> }
export interface ReportModel {
  meta: { reportNo: string; date: string; dateIso: string; version: string; core: string; reference: "v0"; anonymized: boolean; name?: string;
    timeZone: string; bootstrap: number; seed: number; repoSignals: RepoSignals["status"]; footerLeft: string };
  seal: SealInput; roles: string[]; verdict: string; evidence: { detail: string; lifetime: string }; coverage: CoverageRow[];
  ledger: LedgerGroup[]; thenNowLine: string | null; upgrades: Upgrade[];
  exhibits: { a: DayLoupe[]; b: DelegationExhibit; c: VerificationExhibit; d: HabitExhibit; dayParts: DayParts | null; e: ThenNow; f: RangeModel };
  health: HealthModel; share: ShareModel; method: MethodModel }
export interface RangeModel { languages: BarItem[]; toolchains: BarItem[]; techCategories: BarItem[];
  tools: Array<{ tool: ToolId; window: Window; sessions: number; prompts: number; actions: number; span: string }>;
  projects: Array<{ name: string; label: string; sessions: number; activeWeeks: number; tools: ToolId[]; inRepo: boolean; guardrails: RepoSummary["has"] | null }>;
  moreProjects: number; setup: Array<{ kind: string; authored: number; installed: number; other: number; used: number; names: string[] }>;
  models: BarItem[]; risk: Array<{ kind: "permission" | "approval" | "sandbox"; items: BarItem[] }>; hooksDisabled: boolean; memoryFiles: number }
export interface HealthModel { band: Forensics["band"]; text: string; serverBacked: string | null; anchorable: ToolId[]; notAnchorable: ToolId[];
  checks: Array<{ id: CheckId; label: string; status: CheckStatus; reason: string; askAbout?: string; tools: ToolId[] }>;
  coverage: Array<{ tool: ToolId; window: Window; sources: Array<{ source: string; status: CoverageEv["status"]; beta: boolean }>; span: string; sessions: number; prompts: number; formatChanged: boolean }>;
  warnings: string[]; repoSignals: string; exclusions: { tools: number; projects: number; sessions: number } }
export interface ShareModel { card: ShareCard; fields: CardField[]; available: CardField[]; stem: string /* options.outputs.stem (pre-flight F13) */;
  export: { json: string; bytes: number; written?: string; sections: Array<{ key: string; count?: number }> } }
export interface MethodModel { sources: Array<{ tool: ToolId; source: string; status: string; reads: string[]; neverReads: string[] }>;
  windows: { detail: string; lifetime: string }; reference: Array<{ id: string; dimension: DimensionId; transform: string; p50: string; p90: string; rationale: string }>;
  formulas: Array<{ dimension: DimensionId; formula: string; minimum: string }>; privacy: readonly string[]; neverOpened: string[];
  build: { version: string; core: string; reference: string; bootstrap: number; seed: number; timeZone: string }; fonts: FontLicense[] }
export const PAYLOAD_MAX_BYTES = 300_000;
export function reportNo(json: string): string;            // upper-case first 8 hex of SHA-256, as "XXXX-XXXX"
export function payloadBytes(m: ReportModel): number;       // canonical JSON of m with share.export.json set to ""
export function buildReportModel(i: ReportInput): ReportModel;
// test/kit/report.ts
export type FixtureKind = "novice" | "intermediate" | "expert" | "empty" | "lifetime-only" | "repo-off";
export function reportFixture(kind: FixtureKind, o?: { anonymize?: boolean; canaries?: boolean; name?: string; cardFields?: CardField[] }):
  { input: ReportInput; model: ReportModel };
```

**Rules.**
- **Report number and date:** `reportNo` is taken over `employerExport(a, exported).json`. `date` is `fmt.day(a.meta.now, a.meta.timeZone)`. `footerLeft` is `(name ?? "AI Practice Report") + " · No. " + reportNo`.
- **Ledger rows** follow `LEDGER_GROUPS` and `DIMENSION_LABEL`.
  - Not-scored notes:
    - insufficient → `insufficient (n=<n>, needs <needs>) — not enough data yet`;
    - not-measurable → `not measurable with the tools found`;
    - not-measured → `not measured — repo signals are off` when `a.meta.repoSignals` is `off`, and `not measured — git was not found` when it is `git-missing`.
  - Component `value` is `componentValue`, and `cites` is `[COMPONENT[id].cites]`.
- **Evidence lines:**
  - detail: `<sessions> sessions · <typedTurns> typed turns · <Σ childTypes> subagent runs · <span>`;
  - lifetime: `<months> months · <ever> tools (<active90d> active) · <active weeks> active weeks`.
- **`thenNowLine`** is `"<b> better · <s> same · <w> worse"`, or null when then-and-now is insufficient.
- **Range:**
  - **`projects`:** the top 12 of `a.projects` by sessions, named through `buildNames`. A project's `guardrails` is the `has` of the `RepoSummary` whose `projectLabels` include it, else null. The rest count as `moreProjects`.
  - **`setup`:** from `a.config.byKind`, with each kind's top 6 used names from `a.private.config`.
  - **`models`:** from `a.private.models`, summed under `modelExportId` keys, top 6.
  - **`risk`:** from `a.risk`.
- **`dayParts`** is null when its total is 0.
- **Coverage strip:** one `CoverageCell` per tool × window, whose status is the worst among its sources, in the order drift, present-undecodable, error, ok, empty, absent (pre-flight F24).
- **Health.** `serverBacked` reads "<share> of your typed turns come from tools whose server-issued ids checked out (shown, never scored)". Each check's `reason` is `REASON_TEXT[check.reason]` (pre-flight F24).
- **Share:**
  - `card` is `shareCardModel`;
  - `stem` is `options.outputs.stem`, the file stem shared by the report and its sidecars (pre-flight F13);
  - `available` drops `name` when there is no name;
  - `export.json` is `employerExport(…).json`;
  - `sections` are the top-level payload keys, each with its array length when it has one.
- **Method:**
  - `sources` come from `registry` and its `describe` texts, each with its coverage status;
  - `reference` comes from `loadReference("v0")`, with p50 and p90 shown to 4 decimals; Plan 2 words its rationales without ≈ or ρ (pre-flight F1);
  - `formulas` are the spec's §6.5 dimension table as implemented, headed "spec §6.5, as implemented": every component enters as z, per Plan 2's builder's call 1 (so `0.2 z(guardrails)`, `0.35 z(active repos with maintained instruction files)`, `0.15 z(hygiene)`), and words replace → ≤ ≈ (for example "edit episodes to commit or PR within 24 h", "rework within 72 h") (pre-flight F1);
  - `neverOpened` is `auth.json`, `*.key`, Copilot `apps.json` and `hosts.json`, credential and account tables and stores, and OS keychains;
  - `fonts` is `fontLicenses()`.

- [ ] **Step 1: Write the failing tests.**
  - **Determinism:**
    - `reportFixture("expert").model` built twice is deep-equal;
    - it round-trips through JSON with finite numbers only;
    - building it under `process.env.TZ = "Pacific/Auckland"` and under `"UTC"` gives deep-equal models.
  - **Golden:** the intermediate model, with each `method.fonts[].text` replaced by its length and `share.export.json` replaced by its length and SHA-256 → `toMatchSnapshot()` (pre-flight F11).
  - **Payload** (Review Focus 3): `payloadBytes` is at most `PAYLOAD_MAX_BYTES` for the expert fixture, for a model built from `synthStore(300_000)`, and for the expert model with both loupes replaced by Task 7's worst case: 12 lanes, 600 bins, alternating work bins, 120 prompts and 24 children per lane (pre-flight F12).
  - **Names:**
    - `reportFixture("expert", { canaries: true, anonymize: true })` → `findCanaries(model)` is `[]`;
    - without `anonymize`, `findCanaries(model)` ⊆ the keys that Task 1 recorded for cwds and config names, and never includes `path`, `email`, `host`, `secret`, `token`, `prompt` or `code`;
    - no string in the model contains the fixture's home path, and `share.export.written` is a bare file name (pre-flight F20).
  - **States** (Review Focus 1):
    - **empty:**
      - every row is not scored and carries its note;
      - the seal is `provisional`;
      - `upgrades` is `[]`;
      - `exhibits.a` is `[]`;
      - `e.status` is `insufficient`;
      - no string other than `share.export.json` and `method.fonts[].text` contains "NaN", "undefined" or "null"; JSON nulls and the OFL's "null and void" belong there (pre-flight F2).
    - **lifetime-only:** the lifetime evidence line is set, and the detail rows are insufficient.
    - **repo-off:** Delivery's note is the not-measured note, and `ver.guardrails` has status `not-measured`.
  - **Preview contract:** `model.share.export.json === employerExport(a, exported).json`.
  - **Glyphs** (pre-flight F1): `uncoveredChars` over every `method` string and every `health.checks[]` `reason` and `askAbout` is `[]`, and no `method.formulas[].formula` contains `·guardrails`, `·(` or `·hygiene`.
  - **Coverage cells** (pre-flight F24): a tool × window whose sources are `ok` and `drift` gives a `drift` cell; `error` and `empty` give `error`.
  - **Stem** (pre-flight F13): `share.stem` equals `options.outputs.stem`.
- [ ] **Step 2: Run** `bun test test/app/model.test.ts` → FAIL.
- [ ] **Step 3: Implement** `buildReportModel` and the fixture kit.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS. Commit the generated snapshot.
- [ ] **Step 5: Commit** `feat(app): report model — pre-binned, deterministic, within the payload budget`.

---

### Task 12: Report render — sections, client, budgets

**Files:**
- Create: `app/report/{render,css,client}.ts`, `app/report/sections/{masthead,you,upgrades,exhibits,health,share,method}.ts`, `test/app/render.test.ts`, snapshots

**Interfaces:**
```ts
export const REPORT_CSS: string;      // B's section layout; appended after the kit CSS together with CARD_CSS
export const REPORT_CLIENT: string;   // share-card field toggles, SVG and PNG downloads; ES2020, no network APIs
export function renderReport(m: ReportModel, o?: { fonts?: "embed" | "none" }): string;   // page({ title, footerLeft, body, css, script })
```

**Rules.**
- **Chapters,** in order: `<section class="chapter" id=…>` for `you`, `upgrades`, `exhibits`, `health`, `share` and `method`. Coach notes and month-over-month are Plan 5's.
- **Masthead:**
  - `AI PRACTICE REPORT` (`t-disp-20`);
  - `No. … · date · v…` (mono 12);
  - a theme button and a print button, each with an icon and a text label.
- **Rail:** `nav[aria-label="Contents"]`.
- **h1:** the name through `displayText`, or "Your practice".
- **YOU:**
  - the h1, then `READS AS` with the roles (or "not enough data yet"), then the verdict (`t-serif-20`);
  - the seal (192 px; 144 px below 640 px);
  - the two evidence lines, then `coverageStrip`, then the ledger with its legend, then `thenNowLine` with a cite to Ex.E.
- **Upgrades:** numbered `01`–`03` in mono. Each has:
  - its title (`t-serif-20`, weight 560);
  - its evidence, with a cite link;
  - its "why";
  - its steps as an `<ol>`;
  - its repos, as a mono list.

  With none, it says: "Nothing stands out: every measured component is at or above the reference median, or not yet measured."
- **Exhibits,** in order, each through `figure`:
  - **A:** typical, then peak, behind a labelled toggle that is a `<details>`;
  - **B, C;**
  - **D:** habit lanes, plus day parts as a 4-segment bar labelled Night 0–6, Morning 6–12, Afternoon 12–18 and Evening 18–24, plus session arcs as two bar lists;
  - **E;**
  - **F:** "Range & setup": stack small multiples, the tool table, projects, setup, models and risk.
- **Captions,** one sentence each, filled from the model through `fmt`. An exhibit with no data uses the empty state and its note instead.
  - **A:** "On a typical active day {sessions} sessions ran; at the busiest moment {peakConcurrency} worked at once, and the median unattended run lasted {medianUnattended}."
  - **B:** "{sessionsWithChildren} of {n} sessions delegated; the busiest sent work to {groups} kinds of subagent."
  - **C:** "{checked} of edit work was checked after the last edit, and {closed} of failing checks passed again in the same episode."
  - **D:** "You were active in {activeWeeks} of the last 52 weeks, across {tools} tools."
  - **E:** "Compared with your first 90 days: {better} better, {same} the same, {worse} worse."
  - **F:** "Most agent edits were in {topLanguage}; {tools} tools and {projects} projects appear in this history."
- **Data health:** the band text, the server-backed line, the checks table, the coverage table, "format changed?" warnings, the repo-signals status and the exclusions.
- **Share:**
  - the inline card preview: a `<figure>` whose SVG has `role="img"` and whose `<figcaption>` names it, scaled to the column and exempt from the 12 px minimum (pre-flight F21); beside it every chosen card field in readable text, `<input type="checkbox" data-card-field>` toggles, and "Download SVG" and "Download PNG" buttons for the full-size card;
  - a `jsonIsland("aipr-share", { fields, available, stem: share.stem, cardCss })` (pre-flight F13);
  - the export summary, with its written file name (never a path, pre-flight F20) or the flag that writes it;
  - `<details data-print="skip">` holding a `<pre>` with exactly `share.export.json`, and its byte count.
- **Method:**
  - sources, windows, the reference table, the formulas as implemented (Task 11; in `<code>`, mono; pre-flight F1);
  - evidence minimums, confidence, shrinkage, bootstrap and overall, as the spec words them, with words instead of math symbols;
  - the privacy statement and the never-opened list;
  - the build line;
  - the CSP from `page`'s `body` callback;
  - "Typefaces", naming each family with its copyright line, and their license texts in `<details data-print="skip">`.
- **Colophon:** "ai-practice-report v… · core … · reference v0 · offline · github.com/build-with-bala/ai-practice-report", as text.
- **`REPORT_CLIENT`:**
  - a toggle sets or clears `hidden` on `<g data-field>`;
  - **SVG download:** clone the card, drop the hidden groups, insert `<style>` = `cardCss` plus the page's `@font-face` rules for the display and mono families (read from `document.styleSheets`), serialize, and download it as a `data:image/svg+xml` URL named `<stem>.share-card.svg`;
  - **PNG download:** draw the same SVG into a 2400×1260 canvas after `img.decode()`, and download `canvas.toDataURL("image/png")`.

- [ ] **Step 1: Write the failing tests.**
  - **Audit:** for each fixture kind, with and without `anonymize`, plus the `synthStore(300_000)` model, `auditHtml(renderReport(m))` (fonts embedded) must satisfy all of:
    - `cspOk`;
    - `externalRefs` `[]`;
    - `styleAttrs` 0 and `inlineHandlers` 0;
    - `elements < 5000`;
    - `uncovered` `[]`;
    - `bytes ≤ 1_500_000`.
  - **Structure:**
    - the chapter ids appear in order;
    - exactly one `<h1>`;
    - the landmarks `header`, `nav[aria-label="Contents"]`, `main` and `footer` are present;
    - every `<figure>` has one `<figcaption>`;
    - every `data-cite` and `href="#…"` target exists;
    - every `<svg role="img">` has `aria-label` or `aria-labelledby`;
    - the card preview's SVG has `role="img"` inside a `<figure>` with a `<figcaption>`, and each chosen field's text also appears outside it in the Share section (pre-flight F21);
    - the raw-JSON and license `<details>` carry `data-print="skip"`.
  - **Privacy statement:** the Method section contains each `PRIVACY_STATEMENT` sentence, escaped.
  - **Preview contract:** the `<pre>` text, unescaped, equals `m.share.export.json` byte for byte, and the shown byte count equals `m.share.export.bytes`.
  - **Escaping** (Review Focus 2): a fixture whose cwd basename is `<img src=x onerror=alert(1)>`, with name `"; } body{display:none} "`, and a second with name `</style><script>x()</script>` (pre-flight F6):
    - no `<img src=x` occurs;
    - the `@bottom-left` content equals `cssString(footerLeft)`, and the `<style>` holds no raw `</style` or `<script` (pre-flight F6);
    - the audit stays clean;
    - a CJK project name occurs, and `uncovered` holds only its characters.
  - **Time zone** (Review Focus 5): the same model rendered under `process.env.TZ = "Pacific/Auckland"` and under `"UTC"` gives identical bytes.
  - **Text scan** (Review Focus 1): with tags stripped, and with the contents of `<pre>`, `<script>` and `<style>` and the OFL license texts left out, no fixture's text contains `NaN`, `undefined`, `null` or `[object` (pre-flight F2).
  - **Canaries:**
    - `--anonymize` on the canaries fixture → `findCanaries(html)` is `[]`;
    - the default → `findCanaries(html)` ⊆ the keys Task 1 recorded for cwds and config names, and the HTML does not contain the fixture's home path.
  - **Determinism and snapshot:**
    - two renders give identical bytes;
    - the `<body>` of the intermediate fixture, with `fonts: "none"` and the `<pre>`'s export JSON replaced by its length and SHA-256, → `toMatchSnapshot()` (pre-flight F11).
  - **Client:** `REPORT_CLIENT` contains no `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `import(`, `eval` or `innerHTML`.
- [ ] **Step 2: Run** `bun test test/app/render.test.ts` → FAIL.
- [ ] **Step 3: Implement** the sections, the CSS and the client.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS. Commit the generated snapshot.
- [ ] **Step 5: Commit** `feat(app): the private report — you, upgrades, exhibits, data health, share, method`.

---

### Task 13: CLI — arguments, help, explain, run, outputs, logs

**Files:**
- Create: `app/{cli,main,args,explain,run,paths,open}.ts`, `test/app/{args,explain,cli}.test.ts`
- Modify: `app/copy.ts` (`helpText`), `package.json` (scripts `"report": "bun app/cli.ts"`)

**Interfaces:**
```ts
// app/args.ts
export interface CliOptions { explain: boolean; json: boolean; shareCard?: CardField[]; exportForEmployer: boolean; tools?: ToolId[];
  since?: number; open: boolean; out?: string; name?: string; anonymize: boolean; repoSignals: boolean }
export type Parsed = { kind: "run"; options: CliOptions } | { kind: "help" } | { kind: "version" } | { kind: "error"; message: string };
export function parseArgs(argv: readonly string[], o: { tools: readonly ToolId[]; now: number }): Parsed;
// app/copy.ts
export function helpText(tools: readonly ToolId[]): string;
// app/explain.ts
export const PLACEHOLDER_WILDCARDS: readonly string[];   // "<session>", "<conversation>", "<N>", "<name>", "<id>", "<workspace>", "<marketplace>", "<plugin>", "<composer>", "<ide>"
export function placeholderRoots(env: Env): Record<string, string>;   // "<claude>", "<codex>", "<VS Code user>", "<Cursor user>", "<Antigravity user>", "<Antigravity IDE user>", "<home>", "<config>" → tildified
export function explain(env: Env, o: { repoSignals: boolean; outDir: string }): string;
// app/paths.ts
export interface OutputPaths { dir: string; stem: string /* file stem shared by the report and its sidecars (pre-flight F13) */; report: string; json?: string; card?: string; export?: string; isDefaultDir: boolean }
export function outputPaths(env: Env, o: CliOptions, day: string): OutputPaths;
export function writePrivate(path: string, data: string | Uint8Array): void;   // mode 0o600
// app/open.ts
export function openInBrowser(path: string, platform: Platform): void;   // darwin open; linux xdg-open; win32 explorer.exe — argv only, detached; it throws on failure, and run() prints "note: could not open a browser (<code>)" to stderr and still exits 0 (pre-flight F23)
// app/run.ts
export interface RunDeps { env: Env; stdout(s: string): void; stderr(s: string): void; isTTY: boolean; open(path: string): void; now(): number;
  onModel?(m: ReportModel): void }   // called once with the built model; the report smoke reads its payload from it (pre-flight F9)
export async function run(o: CliOptions, d: RunDeps): Promise<number>;
// app/main.ts
export async function main(argv: readonly string[], d: RunDeps): Promise<number>;
```

**Flags.**
- Values are given as `--flag value` or `--flag=value`.
- **Flags:**
  - `--out PATH`, `--no-open`, `--name TEXT`, `--anonymize`;
  - `--tools LIST`, `--since YYYY-MM-DD`, `--no-repo-signals`;
  - `--json`, `--share-card[=FIELDS]`, `--export-for-employer`;
  - `--explain`, `--version`, `--help` and `-h`.
- **Errors** (exit 2, printing `error: <message>` and `Run ai-practice --help for options.`):
  - an unknown flag;
  - a flag missing its value;
  - `--tools` naming an id that is not in the registry (the message lists the valid ids);
  - `--since` that is not a real date, or that lies in the future (it is parsed as local midnight);
  - `--name` longer than 80 characters, or holding control characters;
  - `--keep-history`, `--coach` and `--purge`, which say "not available in this version".
- **Help:**
  - one line per flag;
  - the default output path;
  - the valid tool ids, taken from `registry`;
  - a blank line, then `PRIVACY_STATEMENT`;
  - no line longer than 100 columns: sentences wrap at word boundaries (pre-flight F3).

**Run.**
1. `scan({ env, tools, since, repoSignals })`.
2. `analyze(raw, { exclude: since ? { from: since } : undefined })`.
3. `computeExhibits(raw, a, { exclude })`.
4. `exportPayload(a, { schema: "aiprof/2" })`.
5. `buildReportModel` (then `d.onModel?.(model)`, pre-flight F9), then `renderReport`.
6. Write the report and the sidecars asked for, all with `writePrivate`:
   - `--json` writes `exported.json`;
   - `--export-for-employer` writes `model.share.export.json`;
   - `--share-card` writes `shareCardSvg(model.share.card, fields, { fonts: "embed" })`.
7. Open the report, unless `--no-open`.

**Output paths.**
- The default folder is `~/.ai-practice/reports/`, created 0700.
- `--out` must name a file in an existing folder; otherwise: `error: the folder for --out does not exist: <tildified>`, exit 1.
- Write failures print `error: could not write <tildified path> (<err.code>)` and exit 1. A filesystem error's `message` is never printed.

**Logs.**
- **On a TTY:** stderr shows `Scanning… <done>/<total>` in place, then clears it.
- **Not on a TTY:** no `\r` and no escape codes.
- **stdout lines,** with tildified paths:
  - `Report      <path>`;
  - `JSON`, `Share card` and `Export` lines when asked;
  - `Read <k> of <m> sources in <s> s`;
  - one `format changed? <tool> (<source>)` line per drift warning;
  - with an empty home, `No agent history found. Run ai-practice --explain to see where it looks.`
- **Exit codes:** 0 on success, also for an empty home.

**Explain.** Header: `ai-practice <version> — what a run would read (nothing has been read)`. Then:
- **Where:** each placeholder with its tildified root.
- **Per plugin:**
  - its id, tier and beta flag;
  - `found <n>`, from `locate()`, as a count only, never paths;
  - its `describe.reads` and `describe.neverReads`.
- **Repo signals:** on or off, plus `REPO_SIGNALS_DESCRIBE.reads` and `.runs`, and the line "only in the repositories your sessions ran in, found from the sessions themselves".
- **Never opened.**
- **Writes:** the output folder.
- **The privacy statement.**

- [ ] **Step 1: Write the failing tests.**
  - **`args.test.ts`, one case each:**
    - `[]` → defaults (open, repo signals on);
    - `--no-open`;
    - `--tools codex,claude-code`;
    - `--tools nope` → an error naming the valid ids;
    - `--since 2026-02-30` → error;
    - a future `--since` → error;
    - `--since 2026-06-01` → local midnight;
    - `--share-card` → defaults;
    - `--share-card=roles,band`;
    - an 81-character `--name` → error;
    - `--coach` → "not available in this version";
    - `--out` without a value → error;
    - `-h`, and `--version`.
  - **Help:** `helpText(tools)` contains every registry tool id; once runs of whitespace are collapsed to one space, it contains every `PRIVACY_STATEMENT` sentence; every line is at most 100 columns (pre-flight F3).
  - **`explain.test.ts`,** on a `fakeHome` with all Plan 1 builders:
    - with `__observeOpens` recording, `explain()` records 0 opens;
    - it contains `~/` roots, every registry plugin id and `REPO_SIGNALS_DESCRIBE.reads`;
    - it does not contain `h.root`;
    - with `repoSignals: false` it says `Repo signals: off`;
    - every `<…>` token in any registry `describe` text is in `placeholderRoots` or `PLACEHOLDER_WILDCARDS`.
  - **`cli.test.ts`,** end to end through `main` with injected deps, on a `fakeHome` with all Plan 1 builders and two `makeRepo` repos:
    - **Full run:** `--no-open --json --share-card --export-for-employer` →
      - exit 0;
      - 4 files named `ai-practice-report-<day>{.html,.json,.share-card.svg,.aiprof}` in `~/.ai-practice/reports/`;
      - on POSIX, files 0600 and the folder 0700;
      - stdout lists the 4 tildified paths;
      - no `\r` or `\x1b` in stdout or stderr;
      - `open` is never called;
      - the report passes `auditHtml`;
      - the `.aiprof` parses, `isSelfReported` holds, and its bytes equal the report's `<pre>`.
    - **Open:** without `--no-open`, `open` is called once, with the report path.
    - **Repo signals off:** `--no-repo-signals` → the report holds `not measured — repo signals are off`.
    - **Output edge cases** (Review Focus 4):
      - `--out ~/missing/r.html` → exit 1, the missing-folder error, and nothing written;
      - POSIX, a 0555 folder → exit 1, with `(EACCES)`;
      - a path with a space and `ü` works;
      - a second run on the same day overwrites the file (exit 0);
      - an opener that throws still gives exit 0, and stderr holds `note: could not open a browser (<code>)` (pre-flight F23).
    - **Explain:** `--explain` → exit 0, and nothing is written.
    - **Empty home** (Review Focus 1): exit 0, the report is written, and the no-history line is printed.
    - **No temp files:** no `aipr-*` is left in `env.tmp`.
- [ ] **Step 2: Run** `bun test test/app/args.test.ts test/app/explain.test.ts test/app/cli.test.ts` → FAIL.
- [ ] **Step 3: Implement** the CLI modules. `app/cli.ts` is `#!/usr/bin/env bun`, plus `process.exitCode = await main(process.argv.slice(2), deps)`. Its `deps` come from the real process:
  - `env: detectEnv()`;
  - `stdout` and `stderr`: `process.stdout.write` and `process.stderr.write`;
  - `isTTY: process.stderr.isTTY === true`;
  - `open: (p) => openInBrowser(p, env.platform)`;
  - `now: Date.now`.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(app): ai-practice CLI — explain, report, JSON, share card, employer export`.

---

### Task 14: Canary harness — one rule per surface

**Files:**
- Create: `test/app/canary.surfaces.test.ts`

**Interfaces:**
- **Consumes:**
  - `main` and `RunDeps` (Task 13);
  - `fakeHome`, the Plan 1 builders, `makeRepo` and `CANARY`/`findCanaries`.
- **Setup:**
  - a `fakeHome` with every Plan 1 builder;
  - two repos whose paths, file names and commit messages embed `CANARY.project`, `CANARY.prompt` and `CANARY.email`;
  - one extra Claude Code transcript whose cwd is inside repo 1, as in Plan 2's integration test.
- **Three runs, each capturing stdout and stderr:**
  - (1) `--no-open --json --share-card --export-for-employer`;
  - (2) the same plus `--anonymize`;
  - (3) `--explain`.

- [ ] **Step 1: Write the rules.**

  | # | Surface | Rule |
  |---|---|---|
  | R1 | report, default | `findCanaries(html)` ⊆ {project, mcp, slug}; it never contains `path`, `email`, `host`, `secret`, `token`, `prompt` or `code`; no `h.root` and no home path |
  | R2 | report, `--anonymize` | `findCanaries(html)` is `[]`; no `h.root` |
  | R3 | share card (runs 1 and 2) | `findCanaries(svg)` is `[]` |
  | R4 | employer export and `--json` (runs 1 and 2) | `findCanaries(bytes)` is `[]`; both parse as JSON |
  | R5 | logs (runs 1–3) | `findCanaries(stdout + stderr)` is `[]`; no `h.root`; run 3 shows `~` |

  Every rule is checked against canaries planted by the setup, so a missing surface would fail the test rather than pass it vacuously.
- [ ] **Step 2: Run** `bun test test/app/canary.surfaces.test.ts`. It passes if Tasks 9–13 hold. A failure is a privacy bug: fix it in the owning module, never in the rule.
- [ ] **Step 3: Commit** `test(app): canary rules for the report, anonymized report, share card, export and logs`.

---

### Task 15: Compiled binary smoke (host target)

**Files:**
- Create: `scripts/build.ts`, `test/app/compile.test.ts`
- Modify: `package.json` (script `"build": "bun scripts/build.ts"`)

**Interfaces:**
```ts
// scripts/build.ts — host target only; Plan 6 adds the five release targets
export async function buildHost(o: { outDir: string }): Promise<string>;   // Bun.spawn([process.execPath, "build", "--compile", "app/cli.ts", "--outfile", <outDir>/ai-practice(.exe)])
```

- [ ] **Step 1: Write the failing test** `compile.test.ts`, with a 180 s timeout. It builds into a temp folder and runs the binary with `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `XDG_*`, `TMPDIR`, `TEMP` and `TMP` pointed into a `fakeHome` with every Plan 1 builder.
  - `--version` prints `VERSION`.
  - `--help` contains every privacy sentence once runs of whitespace are collapsed (pre-flight F3).
  - `--explain` exits 0 and shows `~`.
  - `--no-open --out <h.root>/out/r.html --share-card --export-for-employer` exits 0.
    - **Report:** it contains, for every `FONT_FILES` entry, the base64 of `readAsset(<committed file>)`, so fonts are embedded in the binary. `auditHtml` is clean.
    - **Card:** the SVG holds the display and mono faces.
  - The temp folder is removed afterwards.
- [ ] **Step 2: Run** `bun test test/app/compile.test.ts` → FAIL.
- [ ] **Step 3: Implement** `buildHost`.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS locally. CI runs the same test on ubuntu, macOS and Windows; the Windows binary is `ai-practice.exe`.
- [ ] **Step 5: Commit** `test(build): the compiled binary embeds its fonts and runs end to end`.

---

### Task 16: Visual QA on synthetic fixtures

**Files:**
- Create: `scripts/qa-reports.ts`, `scripts/visual-qa.ts`, `test/scripts/qa-reports.test.ts`

**Interfaces:**
```ts
// scripts/qa-reports.ts
export async function writeQaReports(dir: string): Promise<Array<{ id: string; file: string }>>;
  // expert, expert-anonymized, intermediate, novice, empty, lifetime-only, repo-off — built by reportFixture, never from real data —
  // plus odd-names: the expert fixture with its cwds renamed to a 120-character name, an RTL name, an emoji name and a CJK name
// scripts/visual-qa.ts — CLI: bun scripts/visual-qa.ts --playwright <path of an installed playwright package> --in <dir> --out <dir>
export interface QaResult { report: string; theme: "dark" | "light"; width: 1440 | 390; png: string; checks: Record<string, boolean | number> }
```

**Checks,** for each report, theme and width (Chromium, with `colorScheme` emulated):
- no console errors;
- 0 `securitypolicyviolation` events;
- every request aborted and counted, and the count is 0 for anything but `data:` and `about:`;
- `document.fonts.check()` is true for each of the three families;
- at 390 px, `documentElement.scrollWidth ≤ innerWidth`;
- `querySelectorAll('*').length < 5000`;
- the theme button flips `data-theme`.

Per report, also:
- a light-theme `page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true })` with more than 1 page;
- "Download PNG" gives a file that starts with the PNG magic;
- "Download SVG" gives a file that starts with `<svg`.

Every output goes under `--out`, outside the repo, together with a `summary.json`.

- [ ] **Step 1: Write the failing test** `qa-reports.test.ts`. It runs in CI and needs no browser: `writeQaReports(tmp)` writes 8 files, each with a clean `auditHtml`: `cspOk`, no external refs, 0 style attributes, 0 inline handlers, fewer than 5,000 elements, at most 1,500,000 bytes, and `uncovered` ⊆ the characters of the names the odd-names report injects, so `[]` for the other seven (pre-flight F10).
- [ ] **Step 2: Run** it → FAIL. **Step 3: Implement** both scripts. `visual-qa.ts` loads Playwright from `--playwright` through a dynamic `import(pathToFileURL(<dir>/index.mjs))` and never from the repo.
- [ ] **Step 4: Run the QA.**
  - Write the reports into a folder outside the repo.
  - Run Playwright from an install outside the repo. Either:
    - use the Playwright MCP tools, if the session has them, and take the same shots by hand; or
    - use an existing playwright package from an npx cache or a global install. Install the Chromium build it needs with `npx playwright install chromium`, with the network.
  - Every check must PASS.
- [ ] **Step 5: Controller review (gate).** The controller opens every PNG and PDF and checks them against the Design system:
  - **Hierarchy:** the seal and the ledger are on the first screen.
  - **Type roles:** mono for measurements, Archivo caps for structure, Newsreader for interpretation, and no fallback glyphs except in the names the odd-names report injects (pre-flight F10).
  - **Contrast** in both themes.
  - **Layout:** no overlap or clipping.
  - **Mobile order:** name and seal on one row, then the verdict and the ledger.
  - **Print:** a break per chapter, the footer, open details, light fills only, and no raw JSON.

  Issues go back to the owning task's files as fix-ups, and the QA re-runs. The task is accepted only once the controller approves.
- [ ] **Step 6: Commit** the scripts and the test, never the images: `test(qa): visual QA of synthetic reports in both themes, two widths and print`.

---

### Task 17: Integration, local P3 acceptance, PR

**Files:**
- Create: `test/app/integration.test.ts`, `scripts/report-smoke.ts`, `test/scripts/report-smoke.test.ts`

**Interfaces:**
- **`scripts/report-smoke.ts`** runs `run()` on the real environment with `--no-open --share-card --export-for-employer`, and takes the model from `RunDeps.onModel` for the payload check (pre-flight F9).
  - It writes into a fresh `$TMPDIR/ai-practice-smoke-*` folder outside the repo, a name outside the `aipr-*` glob, and removes that folder in `finally` (pre-flight F9).
  - It prints only `key=PASS|FAIL` lines, plus `elapsed=<s>` and `peak-rss-mb=<n>`. The keys are `exit`, `csp`, `no-external-refs`, `elements-under-5000`, `payload-under-300kb`, `export-under-300kb`, `fonts-embedded`, `glyphs-covered`, `upgrades-cite-exhibits`, `temp-clean`, `under-60s` and `rss-under-1gib` (pre-flight F9).
    - `temp-clean`: no `$TMPDIR/aipr-scan-*` folder exists after the run that did not exist before it (pre-flight F9).
    - `under-60s`: scan through render takes at most 60 s; `rss-under-1gib`: peak RSS is at most 1 GiB (spec §10, pre-flight F9).
  - It exits 1 when any key is FAIL (pre-flight F9).
  - It never prints names, paths, scores or ids.

- [ ] **Step 1: Write the failing tests.**
  - **`integration.test.ts`,** the P3 acceptance on fixtures, with a `fakeHome` and all builders through `main`:
    - the CSS holds both the ink and paper palettes, and the print rules;
    - the audit budgets hold;
    - `renderReport(reportFixture("intermediate").model)` shows 3 upgrades, each with a `data-cite` that resolves to an exhibit `id`; this check uses the fixture because the fakeHome scores no dimension (pre-flight F8);
    - the report holds no `<link>`, and `auditHtml(html).externalRefs` is `[]`; license text may name `http://` URLs (pre-flight F2).
  - **`report-smoke.test.ts`,** with `HOME` and the rest pointed into a `fakeHome`:
    - it exits 0, so every key is PASS on the fakeHome (pre-flight F9), and every output line matches `/^[a-z0-9-]+=(PASS|FAIL|\d+(\.\d+)?)$/`;
    - `expectNoCanaries(stdout + stderr)` passes;
    - no line contains `h.root`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Local acceptance (P3).**
  - Run `bun scripts/report-smoke.ts` against the real HOME, outside the sandbox if it blocks reads. Expect exit 0 and every line `PASS`.
  - Confirm `temp-clean=PASS`: no `$TMPDIR/aipr-scan-*` folder appeared during the run. List them before and after, since other processes' `aipr-home-*` folders do not count (pre-flight F9).
  - Keep only the pass/fail lines for the PR. No value, name or report from the owner's machine goes into the repo, the PR or a report.
- [ ] **Step 6: Commit, push, open the PR.** Do not merge: the final whole-branch review comes first.
```bash
git add -A && git commit -m "feat(app): integration and P3 acceptance

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
# EtherHiding config scan → nothing printed
git push -u origin feat/practice-report
gh pr create --base main --title "AI Practice Report app and the shared viz kit" --body "<summary + P3 acceptance pass/fail lines + visual QA approved by the controller; no figures from the owner's machine>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch   # green on ubuntu/macos/windows + security guard
```
