# Plan 6 — Polish and ship: release workflows, the release key, honest docs, visual QA, and the joint launch of B v1.0.0 and A v2.0.0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish B (`ai-practice-report`) v1.0.0 and A (`ai-candidate-profiler`) v2.0.0 together. Each release ships:
- five single-file executables, built in GitHub Actions;
- `SHA256SUMS` and a build-provenance attestation;
- for A, the release signing key, embedded at build time.

Each publish waits for the owner's approval. Both repos' docs say exactly what the code does.

**Architecture:**
- **Settings first.** Task 1 configures both repos through `gh api`:
  - a protected `release` environment, where the owner approves every run;
  - a `v*` tag ruleset;
  - server-enforced SHA pinning;
  - immutable releases.
- **One release kit, in B.** `scripts/release/` in B holds:
  - the five-target table;
  - the only compile path, which is hardened;
  - checksums and ad-hoc macOS signing;
  - the tag rules;
  - the draft-first publish;
  - the workflow lint and the docs-block tooling.

  A uses the kit from its pinned copy of B, through the same kind of bridge it uses for B's test kits.
- **One workflow, two paths.** On every `v*` tag, `release.yml` first runs the security guard and the full test matrix. Then exactly one of two paths runs:
  - **Rehearsal** (tags `v0.0.0-rehearsal.<n>`): read-only. It builds all five targets and smoke-tests each one on its own OS. Nothing is published.
  - **Release:** runs in the protected environment. It builds, verifies, attests and publishes.
- **Docs from code.** Every pinned statement in the READMEs and method docs is a block rendered from a code constant. CI fails when a block is stale, or when hand-written prose overclaims.
- **Order:**
  1. B's branch merges first. Its merge commit is B's release commit.
  2. A pins that commit and ships its own branch.
  3. Both tags go out together. The owner's approval click on each release run is the only human step.

**Tech Stack:**
- Bun 1.3.11: `Bun.build` with `compile`, `Bun.YAML`, `Bun.spawn`.
- TypeScript 5 (`strict`), `bun test`.
- `node:crypto` (Ed25519, SHA-256).
- GitHub Actions and the `gh` CLI.
- macOS `codesign`, for ad-hoc signatures.
- Playwright from an install outside the repos, for visual QA only.
- No new dependency in either repo.

**Spec:** `docs/superpowers/specs/2026-11-17-ai-leverage-suite-v2-design.md` in `<A>`.
- This plan implements the §11 P5 acceptance.
- It also implements the release parts of §3 ("GitHub account hygiene"), §8.2 (the release key), §9 and §10 (CI, versioning, visual QA).
- §2, §3, §6.7, §12, §13 and §16 bind every task.

**Placeholders.** The controller fills these in at dispatch. The plan never names them.

| placeholder | meaning |
|---|---|
| `<A>` | the local checkout of `build-with-bala/ai-candidate-profiler` |
| `<B>` | the local checkout of `build-with-bala/ai-practice-report` |
| `<research>` | the private research notes. Read-only: never commit them, and never quote them. |
| `<scratch>` | a folder the controller picks, outside both repos and outside any synced folder. It holds API payloads, QA images and downloads, and is never committed. |

`~` means the home folder of whoever runs the step.

**Builds on:** Plans 1–5b, all merged into their repos' `main`. Task 1 checks this.
- **B:** Plans 1, 2, 3 and 5a. They provide:
  - `scripts/build.ts` (`buildHost`);
  - `app/copy.ts`: `PRIVACY_STATEMENT` (8 sentences), `CHECK_LABEL` and `helpText`;
  - `registry`, `WEIGHTS`, `SOURCE_ROOTS` and `PLACEHOLDER_WILDCARDS`;
  - `reportFixture` and `scripts/{qa-reports,visual-qa,smoke-local,report-smoke}.ts`;
  - `renderKit.auditHtml`.
- **A:** Plans 4 and 5b. They provide:
  - `scripts/build.ts` (`buildHost` with `signingKey`);
  - `src/copy.ts`: `PRIVACY_STATEMENT` (6 sentences, sentence 2 as amended by Plan 5b), `TRUST_STATEMENT`, `TSA_NOTICE`, `PAIRING_NOTICE`, `BRIEF_INSTRUCTIONS` and `CALIBRATE_CAVEATS`;
  - `src/trust/{keys,bytes,release,signer}.ts`: `newEdKey`, `fingerprint`, `displayFingerprint`, `b64u`, `unb64u`, `Rand`, `ReleaseKeysFile`, `loadTrust` and `resolveSigner`;
  - `src/trust/release-keys.json`, which is `{"v":1,"keys":[]}`;
  - `OPTIONAL_FIELDS`, `src/roles/shipped.ts` and `src/trust/tsa.json`;
  - `test/kit/core.ts`, and the tests `test/repo/no-private-keys.test.ts`, `test/docs.test.ts` and `test/compile.test.ts`;
  - `scripts/{qa-dossiers,visual-qa,profiler-smoke}.ts`.

**Repo and branches:**
- The controller creates `feat/ship-v1` in `<B>` from `origin/main` before Task 2.
- It creates `feat/ship-v2` in `<A>` from `origin/main` before Task 7.
- No other session works in either checkout while this plan runs.

**Out of scope:**
- The spec's P6 stretch items, including notarization and Authenticode (spec §2 non-goal).
- New product behaviour, with two exceptions that make existing claims true:
  - A's privacy sentence 7 (Task 10);
  - A's repo-scoped stores in `find` and `session end` (`repoStores`, Task 7; P5 pre-flight J7). A's WSL scan on Windows already comes from Plan 5b Task 10 (P5 pre-flight J8).

## Global Constraints

Plans 1–5b's Global Constraints carry over, each in the repo it was written for: Plans 1, 2, 3 and 5a in B; Plans 4 and 5b in A. This plan adds the lines marked ✚.

**✚ Public repos**
- This plan, and everything it adds, holds no value from the owner's machine or accounts. That covers commits, PR text and release notes.
- Not allowed: absolute local paths, user names, account ids, emails, host names, and figures.
- The reviewer's GitHub id is read at run time with `gh api user --jq .id`. It is compared, and never printed or written down.

**✚ Sandbox.** These steps need `dangerouslyDisableSandbox: true`:
- `git fetch`, `git pull` and `git push`;
- every `gh` call;
- `bun install` in A;
- the cross-target downloads in release builds;
- the Playwright browser install.

**✚ EtherHiding scan**
- Run it in the repo root before every `git push` and every `git pull`. It is verbatim from the workspace `CLAUDE.md`.
- It must print nothing. If it prints anything, stop and alert the user.
```bash
for c in $(git ls-files | grep -Ei '(^|/)(package\.json|[^/]*\.config\.(js|ts|mjs|cjs)|\.eslintrc.*)$'); do tail -c 2000 "$c" | grep -qiE 'ether|0x[a-f0-9]{40}|eval\(atob|fromCharCode' && echo "SUSPECT: $c"; done
```
- The scan matches `ether` anywhere. So no word in a `package.json` may contain that substring: avoid "together" and "whether".

**✚ Branches, PRs and merges**
- Claude opens and merges each PR itself, with `gh pr merge --squash --delete-branch`, after the controller's whole-branch review.
- Never push to `main`, and never run `git push --all`.
- In A, use `origin/main`, never the local `main`, which is a stale pre-rewrite copy.
- Tags are the only refs pushed outside the two feature branches.

**✚ Commit and PR trailers**
- Commits end with the authoring model's trailer, for example `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

**✚ One compile path**
- Every executable that either repo builds comes from the kit's `compileBinary`. That covers tests, host builds, rehearsals and releases.
- `compileBinary` calls `Bun.build` in-process, with `compile: { target, outfile, autoloadDotenv: false, autoloadBunfig: false }`.
- Never run `bun build --compile` on a command line, and never put a `define` value in argv.

**✚ Targets and assets.** `<bin>` is `ai-practice` in B and `ai-profiler` in A. The asset names keep v1's scheme.

| id | Bun target | asset | smoke runner |
|---|---|---|---|
| darwin-arm64 | `bun-darwin-arm64` | `<bin>-macos-arm64` | `macos-latest` |
| darwin-x64 | `bun-darwin-x64-baseline` | `<bin>-macos-x64` | `macos-15-intel` |
| linux-x64 | `bun-linux-x64-baseline` | `<bin>-linux-x64` | `ubuntu-latest` |
| linux-arm64 | `bun-linux-arm64` | `<bin>-linux-arm64` | `ubuntu-24.04-arm` |
| windows-x64 | `bun-windows-x64-baseline` | `<bin>-windows-x64.exe` | `windows-latest` |

**✚ Action pins.** Checked on 2026-11-18. Every entry is a commit ref.

| action | version | commit |
|---|---|---|
| `actions/checkout` | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `oven-sh/setup-bun` | v2.2.0 | `0c5077e51419868618aeaa5fe8019c62421857d6` |
| `actions/attest-build-provenance` | v4.2.2 | `4d101475d8b20a2381f78447822ac1eab6504dd8` |
| `actions/upload-artifact` | v7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |
| `actions/download-artifact` | v8.0.2 | `9000827ccba6bdab643e8b6fd33ac0654aef8333` |

**✚ Workflows.** Rules W1–W10 (Task 3) hold in both repos. In short:
- Third-party actions are pinned by SHA, with a version comment.
- No `pull_request_target` and no `workflow_run`.
- Top-level `permissions` is `{}` or `contents: read`.
- Only the `release` job gets write scopes, and it gets exactly `contents: write`, `id-token: write` and `attestations: write`.
- No secret appears outside that job. In A, the only secret is `AIPROF_RELEASE_SIGNING_KEY`, and only in one step's `env`.
- No `${{ }}` inside a `run:` body.
- Every checkout sets `persist-credentials: false`.
- The security guard stays, with `workflow_call` added, and it gates every release run.

**✚ Release environment**
- Each repo has an environment named `release`. Its settings:
  - the owner is its only required reviewer;
  - `prevent_self_review` is false, because the owner is both the reviewer and the account that pushes the tags;
  - there is no wait timer;
  - deployments come only from tags matching `v*`.
- Claude never approves a deployment: it never calls `POST /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments`.
- Claude never loosens these settings.

**✚ Tags**
- Real releases use annotated tags: `v1.0.0` in B, on A's `corePin.sha`, and `v2.0.0` in A, on A's merge commit.
- Rehearsals use lightweight tags `v0.0.0-rehearsal.<n>`, numbered from 1. Each is deleted after its run.
- Nothing else is tagged.

**✚ The one human step** is the owner's approval of each real release run, two clicks in total. Rehearsals and every other step run without the owner.

**✚ Release key (A)**
- The key id is `rel-2026a`, for the v2 line.
- It is generated once, with `scripts/release-key.ts` (`node:crypto`).
- The private half exists in exactly two places:
  - the `release` environment secret `AIPROF_RELEASE_SIGNING_KEY`, set with `gh secret set --env release` and the value on stdin;
  - the owner's offline backup `~/.ai-profiler-release/rel-2026a.release-key.json`. It is a 0600 file in a 0700 folder, outside every repo and synced folder, and never inside `~/.ai-profiler/`.
- The private half is never printed, logged, committed, pasted, put in argv or written anywhere else.
- CI sees the key only in the build step's `env`. The build removes it before starting any child process.
- The public half lives in `src/trust/release-keys.json`.

**✚ Docs**
- Every statement that code pins is a generated block (Tasks 4 and 10).
- Hand-written prose matches no `OVERCLAIMS` pattern.
- Trust is described as "tamper-evidence", never proof.
- No hire or no-hire framing, no ranking, and no figures.

**✚ Versions**
- B is `1.0.0` and A is `2.0.0`.
- Format test vectors keep their literal `meta` values. Only tests of the running version change.

**✚ Visual QA** uses synthetic fixtures only. Images and PDFs live under `<scratch>`, never in a repo.

## Spec values (verbatim — tasks cite these and never restate them differently)

- **§3 Runtime/build:** "`bun build --compile` for `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `windows-x64`. No native addons."
- **§3 GitHub account hygiene:** "Releases build in GitHub Actions, but defensively: release jobs run only in a protected `release` environment that requires the owner's approval per run, `v*` tags are protected by a ruleset, workflows pin third-party actions by SHA, and every artifact gets a build-provenance attestation."
- **§3 Honest trust limits:** "the candidate owns the machine; anything embedded in a client binary can be extracted. Signing gives tamper-*evidence*; forensics raise the cost of fabrication; only the live walkthrough/pairing ties evidence to a person. The product must say exactly this."
- **§8.2:** "**Release key:** one Ed25519 keypair per major release line, private key held only in the protected GitHub Actions `release` environment (owner approval per run), injected at compile time (`--define`) so it is never in the repo; public keys + key IDs + revocation list ship in `src/trust/release-keys.json`. Local/dev builds use a dev key and verify as "dev build". Honest framing everywhere: proves "produced by an official vN binary or by someone who extracted its key"."
- **§6.7 corrected privacy statement** (both READMEs, `--help`, Method section): "reads local history files, which contain your prompts, replies and code, in memory to count things; keeps none of the text; never opens credential files; shares nothing until you approve the preview; offline by default."
- **§10 CI:** "release on a protected `v*` tag → job in the `release` environment (owner approval) → 5 targets → `SHA256SUMS` → `actions/attest-build-provenance` → GitHub release; only A's release job sees the release signing key. Third-party actions pinned by SHA. An inline `security-guard.yml` (fake-font + loader-marker gate) as used in the owner's other repos."
- **§10 Versioning:** "B `v1.0.0` (core API + app), A `v2.0.0` pinned to B's core by commit SHA."
- **§10 Visual QA:** "Playwright screenshots of both reports in dark/light, 1440 px and 390 px, and print-to-PDF; reviewed before declaring done."
- **§11:** "**One release (owner):** nothing is published until P0–P5 are complete, P4 included; B v1.0.0 and A v2.0.0 launch together." **P5:** "both READMEs + privacy statements + methodology accurate; visual QA screenshots reviewed; CI release dry-run on a test tag; B pushed to the new public repo; A PR merged; releases published."
- **§13.7:** "Release signing key embedded in binaries via CI secret, described honestly as tamper-evidence; provenance via GitHub attestations; notarization later."
- **§2 anti-goals:** "A hire/no-hire recommendation, or ranking candidates by one number" and "Privacy or trust claims that overstate what the code does."
- **§16:** "Candidates distrust running a binary | open-source core, `--explain`, attestations, SHA256SUMS, canonical URL, consent preview".

## Builder's calls (binding here; spec §14 leaves them open)

1. **The rehearsal path.** A test tag `v0.0.0-rehearsal.<n>` runs the same workflow file, under these limits:
   - the guard and the test matrix run first, as for a release;
   - the rehearsal job has no environment and only `contents: read`;
   - A's rehearsal binaries embed a throwaway key, made in memory for that run;
   - all five assets are smoke-tested on their own operating systems;
   - nothing is attested and nothing is published, so the run needs no approval and leaves no draft to delete.

   Attestation and publishing run only inside the approved job, where they are the last steps and fail closed.
2. **One release job, on macOS.**
   - It cross-compiles all five targets.
   - It ad-hoc signs both macOS assets, then checks them with `codesign --verify --strict`. This matters because a darwin binary cross-compiled with Bun keeps the runtime's original signature, which no longer matches the binary (reproduced on Bun 1.3.11).
   - Before publishing, it smoke-tests its own macOS arm64 asset.
3. **Asset names** keep v1's scheme (`ai-profiler-macos-arm64`, …), so v1's `releases/latest/download/…` links keep working. B uses the same scheme. v1's `run-macos.command` is dropped.
4. **x64 targets** use Bun's `-baseline` builds. On Bun 1.3.11 these are separate binaries, and they run on x64 CPUs without AVX2.
5. **Hardened compile.** By default, a compiled Bun binary loads `.env` from its working folder. It also loads `bunfig.toml` from there, and that file's `preload` runs code (reproduced on Bun 1.3.11). Picture a recruiter who runs `verify` in a folder of downloaded files: that folder could hand them a hostile `AIPROF_RELEASE_PUBKEYS`, or run a script. So both autoloads are off in every build.
6. **Publishing.**
   - **Steps:** the publish creates a draft, uploads the assets, compares each uploaded asset's `digest` with `SHA256SUMS`, and only then publishes.
   - **Re-runs:** a re-run deletes a leftover draft. It refuses when the tag is already published.
   - **After publishing:** immutable releases (Task 1) freeze the tag and the assets. A broken published release is fixed by a patch release.
7. **Attestation** uses `subject-checksums: dist/SHA256SUMS`, so the attested set is exactly the checksummed set.
   - `actions/attest-build-provenance` v4 wraps `actions/attest`, and pins it by SHA internally.
   - File subjects need only `id-token` and `attestations`. Creating the release also needs `contents: write`.
8. **Docs blocks.**
   - Each statement that code pins sits between `<!-- gen:NAME -->` and `<!-- /gen:NAME -->`, rendered by `scripts/docs.ts`.
   - A test fails when a committed block differs from its rendering.
   - The rest of each doc is hand-written prose, checked by `findOverclaims`.
9. **Shared kit.** A imports `scripts/release/{kit,lint,docs}.ts` from its installed, pinned B, through `scripts/kit/release.ts`. Those three files import only `node:` modules and Bun globals.
10. **More repo settings.** Task 1 also configures these in both repos:
    - `sha_pinning_required`;
    - immutable releases;
    - private vulnerability reporting;
    - a read-only default token.

    `build-with-bala` is a user account. The ruleset therefore exempts the repository-admin role (`RepositoryRole` 5), and Task 1 checks that `current_user_can_bypass` reads back as `always`.
11. **A's privacy sentence 7.** Plan 5b's `verify --brief` sends a structural digest of a candidate's file to the recruiter's own AI provider, but A's privacy statement never said so. Task 10 adds the sentence.
12. **Pin, then tags.** B merges first, and its merge commit becomes `corePin.sha` in A. B's `v1.0.0` tag goes on exactly that commit.

## Review Focus

1. **The embedded key and the shipped key disagree.** Causes: the secret is missing or malformed, a rotation was half-done, or the entry is revoked. Expected: the release job stops before compiling, and prints only key ids and display fingerprints. No binary that signs unverifiable bundles is ever published. Pinned by Task 8 (`checkReleaseKey`) and Task 9 (`build` refuses before compiling).
2. **A hostile working folder.** The folder holds `.env` and a `bunfig.toml` with a `preload`, where a recruiter runs `verify` or a developer runs `ai-practice`. Expected: the binary ignores both files on all five platforms. Pinned by Task 2 (the kit and B's compile test), Task 9 (A's compile test) and the rehearsal smokes (Tasks 6 and 12).
3. **macOS binaries that would not run.** Causes: a signature inherited from the Bun runtime and no longer valid, and quarantine on browser downloads. Expected: ad-hoc signed and strictly verified, smoke-tested on both macOS runners, with the README's quarantine note. Pinned by Task 2 (`adhocSign`) and Task 3 (`verify-dist` refuses an unsigned macOS asset).
4. **A publish that fails part-way or is re-run.** Cases: an upload error, a digest mismatch, a leftover draft, an already-published tag. Expected: never a public release with missing or altered assets. A re-run replaces a draft and refuses a published release. Pinned by Task 2 (`publish` with an injected `gh`).
5. **The wrong tag or commit.** Cases: a tag that is not `v` plus `package.json`'s version, a `-dev` version, a tag on a commit outside `main`, an unknown `v0.0.0-` form. Expected: the job refuses before building, and a rehearsal tag never reaches the environment. Pinned by Task 2 (`releaseContext`, `onMain`) and Task 3 (the CLI and rule W6).

## File map

```
<scratch>/settings/*.json — never committed                                                            1
B scripts/release/kit.ts · scripts/build.ts · test/release/kit.test.ts · test/app/compile.test.ts       2
B scripts/release.ts · scripts/release/{lint,notes,smoke}.ts · .github/workflows/{release,ci,security-guard}.yml
  · test/release/{cli,notes,smoke}.test.ts · test/repo/workflows.test.ts · package.json · test/smoke.test.ts   3
B scripts/release/docs.ts · scripts/docs.ts · README.md · docs/{method,releasing,design}.md · SECURITY.md
  · test/docs/{blocks,claims}.test.ts                                                                    4
B fix-ups from visual QA                                                                                 5
B PR · rehearsal · merge                                                                                 6
A package.json · bun.lock · src/cli/{scan-options,run,find,session,explain}.ts · test/kit/core.ts
  · test/cli/{scan-options,explain}.test.ts                                                              7
A scripts/release/key.ts · scripts/release-key.ts · src/trust/release-keys.json · .gitignore
  · test/release/key.test.ts · test/repo/no-release-seed.test.ts · test/trust/release.test.ts            8
A scripts/kit/release.ts · scripts/build.ts · scripts/release.ts · scripts/release/{notes,smoke}.ts
  · .github/workflows/{release,ci,security-guard}.yml · test/release/{cli,notes,smoke}.test.ts
  · test/repo/workflows.test.ts · test/compile.test.ts · package.json                                    9
A scripts/docs.ts · README.md · docs/{method,releasing}.md · SECURITY.md · src/copy.ts · the spec
  · test/docs/{blocks,claims}.test.ts · test/docs.test.ts                                                10
A fix-ups from visual QA                                                                                 11
A PR · rehearsal · merge                                                                                 12
both: tags · the owner's approval · the release runs                                                     13
both: verify the published releases · clean up                                                          14
```

---

### Task 1: Pre-flight and repository settings, both repos

**Files:** none in either repo. The payloads go to `<scratch>/settings/`.

**Interfaces:**
- **Produces,** in both repos:
  - the environment `release`, with its tag policy `v*`;
  - the ruleset `release tags`;
  - `sha_pinning_required`;
  - a read-only default token;
  - immutable releases;
  - private vulnerability reporting.
- Task 8 adds A's secret to that environment.

- [ ] **Step 1: Pre-flight** (read-only). Any failure → stop and report BLOCKED, naming the failing line.
  - **PRs.** For both repos, `gh pr list --repo build-with-bala/<repo> --state open` shows no PR from Plans 1–5b, and `--state merged` lists them: B's Plans 1, 2, 3 and 5a, and A's Plans 4 and 5b.
  - **Checkouts.** Run `git -C <B> fetch origin` and `git -C <A> fetch origin`. Then `git -C <B> status --porcelain` and `git -C <A> status --porcelain` both print nothing.
  - **Files on each `origin/main`:**
    - `scripts/build.ts`, `.github/workflows/ci.yml` and `.github/workflows/security-guard.yml` exist;
    - A's `src/trust/release-keys.json` is `{"v":1,"keys":[]}`;
    - the `package.json` versions are `1.0.0-dev` (B) and `2.0.0-dev` (A).
  - **Existing pins.** Every `uses:` line in both repos' workflows on `origin/main` ends in `@<40 hex> # v…`, so enforcing SHA pinning breaks nothing.
  - **Action tags.** For each action pin, `gh api repos/<action>/git/ref/tags/<version> --jq .object.sha` equals the pinned commit. If it differs, keep the pinned commit and report the difference.
  - **Ownership.** `gh api repos/build-with-bala/<repo> --jq .permissions.admin` → `true` for both, and `gh api users/build-with-bala --jq .type` → `User`.
- [ ] **Step 2: Write the payloads.**
  - **`environment.json`** is written at run time, so the id is never typed or stored. Run `OWNER_ID=$(gh api user --jq .id)`, then:
```bash
cat > <scratch>/settings/environment.json <<EOF
{"wait_timer":0,"prevent_self_review":false,"reviewers":[{"type":"User","id":$OWNER_ID}],
 "deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
EOF
```
  - **`<scratch>/settings/ruleset.json`:**
```json
{"name":"release tags","target":"tag","enforcement":"active",
 "bypass_actors":[{"actor_id":5,"actor_type":"RepositoryRole","bypass_mode":"always"}],
 "conditions":{"ref_name":{"include":["refs/tags/v*"],"exclude":[]}},
 "rules":[{"type":"creation"},{"type":"update","parameters":{"update_allows_fetch_and_merge":false}},
          {"type":"deletion"},{"type":"non_fast_forward"}]}
```
  - **`<scratch>/settings/actions.json`:** `{"enabled":true,"allowed_actions":"all","sha_pinning_required":true}`.
- [ ] **Step 3: Apply**, for `R` in `build-with-bala/ai-practice-report` and `build-with-bala/ai-candidate-profiler`:
```bash
gh api -X PUT "repos/$R/environments/release" --input <scratch>/settings/environment.json
gh api -X POST "repos/$R/environments/release/deployment-branch-policies" -f name='v*' -f type=tag   # a 303 on re-run is fine
id=$(gh api "repos/$R/rulesets" --jq '.[] | select(.name=="release tags") | .id')
if [ -n "$id" ]; then gh api -X PUT "repos/$R/rulesets/$id" --input <scratch>/settings/ruleset.json
else gh api -X POST "repos/$R/rulesets" --input <scratch>/settings/ruleset.json; fi
gh api -X PUT "repos/$R/actions/permissions" --input <scratch>/settings/actions.json
gh api -X PUT "repos/$R/actions/permissions/workflow" -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
gh api -X PUT "repos/$R/immutable-releases"
gh api -X PUT "repos/$R/private-vulnerability-reporting"
```
- [ ] **Step 4: Read back.** Each command must give the output shown. Ids are compared inside `--jq` and never printed.
  - **Reviewer:** `gh api repos/$R/environments/release --jq "[.protection_rules[] | select(.type==\"required_reviewers\") | .reviewers[].reviewer.id] == [$OWNER_ID]"` → `true`.
  - **Self-review:** `… --jq '[.protection_rules[] | select(.type=="required_reviewers") | .prevent_self_review][0]'` → `false`.
  - **Branch policy:** `… --jq .deployment_branch_policy` → `{"custom_branch_policies":true,"protected_branches":false}`.
  - **Tag policy:** `gh api repos/$R/environments/release/deployment-branch-policies --jq '[.branch_policies[] | {name, type}]'` → `[{"name":"v*","type":"tag"}]`.
  - **Ruleset:** `gh api repos/$R/rulesets/$id --jq '{target, enforcement, include: .conditions.ref_name.include, rules: [.rules[].type], bypass: .current_user_can_bypass}'` → `{"bypass":"always","enforcement":"active","include":["refs/tags/v*"],"rules":["creation","update","deletion","non_fast_forward"],"target":"tag"}`.
  - **Other settings:**
    - `actions/permissions --jq .sha_pinning_required` → `true`;
    - `actions/permissions/workflow --jq .default_workflow_permissions` → `"read"`;
    - `immutable-releases --jq .enabled` → `true`;
    - `private-vulnerability-reporting --jq .enabled` → `true`.
  - **Secrets:** `gh secret list --env release --repo $R` → empty.
- [ ] **Step 5: Finish.** Delete `<scratch>/settings/environment.json`. Keep the pass lines, without ids, for the PR descriptions.

---

### Task 2: B — the release kit: targets, the hardened compile, checksums, signing, tag rules, publish

**Files:**
- Create: `scripts/release/kit.ts`, `test/release/kit.test.ts`
- Modify:
  - `scripts/build.ts`: `buildHost` becomes `compileBinary({ entry: "app/cli.ts", outfile })`;
  - `test/app/compile.test.ts`: adds the hostile-folder case.

**Interfaces** (`scripts/release/kit.ts`, shared with A. It imports only `node:` modules and Bun globals):
```ts
export type TargetId = "darwin-arm64" | "darwin-x64" | "linux-x64" | "linux-arm64" | "windows-x64";
export interface Target { id: TargetId; bun: string; suffix: string; runner: string; os: "darwin" | "linux" | "win32"; arch: "arm64" | "x64" }
export const TARGETS: readonly Target[];                       // the Global Constraints table, in its order
export function assetName(bin: string, t: Target): string;    // `${bin}-${t.suffix}`
export function hostTarget(platform: string, arch: string): Target | undefined;
export interface CompileInput { entry: string; outfile: string; target?: string; define?: Readonly<Record<string, string>> }
export async function compileBinary(i: CompileInput): Promise<string>;
export function sha256File(path: string): string;             // lower-case hex
export function checksumsText(dir: string, names: readonly string[]): string;
export function verifyChecksums(dir: string, text: string): string[];          // names missing or different
export type Runner = (argv: readonly string[], o?: { env?: Record<string, string>; cwd?: string; stdin?: string }) =>
  { code: number; stdout: string; stderr: string };
export function childEnv(base: Readonly<Record<string, string | undefined>>, drop: readonly string[]): Record<string, string>;
export function adhocSign(path: string, run?: Runner): void;
export type ReleaseKind = "release" | "rehearsal";
export interface ReleaseCtx { tag: string; kind: ReleaseKind; version: string; repo: string; bin: string; title: string }
export function releaseContext(o: { tag: string; version: string; repo: string; bin: string; title: string }): ReleaseCtx;
export function onMain(commit: string, o?: { ref?: string; cwd?: string; run?: Runner }): boolean;
export function verifyDist(dir: string, ctx: ReleaseCtx, o: { platform: string; extra?: readonly string[]; run?: Runner }): string[];
export function verifyCommands(ctx: Pick<ReleaseCtx, "repo" | "tag">, asset: string):
  { sums: { macos: string; linux: string; windows: string }; attest: string };
export type Gh = (args: readonly string[]) => Promise<{ code: number; stdout: string; stderr: string }>;
export async function publish(ctx: ReleaseCtx, o: { dir: string; assets: readonly string[]; notesFile: string; gh: Gh }): Promise<void>;
```

**Rules:**
- **`compileBinary`:**
  - It calls `Bun.build({ entrypoints: [entry], compile: { target, outfile, autoloadDotenv: false, autoloadBunfig: false }, define })`, with no minify and no sourcemap.
  - It never logs.
  - When the build fails, it throws `Error("compile-failed: " + messages)`, where every `define` value in the messages is replaced by `<define>`.
- **`checksumsText`:** one line per file, `<64 lower hex>` + two spaces + `<name>` + `\n`, sorted by name. This is the `sha256sum` / `shasum -a 256` text format that `subject-checksums` reads.
- **`releaseContext`:**
  - `^v(\d+\.\d+\.\d+)$` with the capture equal to `version` → `release`. A `version` with a `-` suffix is `Error("dev-version")`.
  - `^v0\.0\.0-rehearsal\.[1-9]\d*$` → `rehearsal`, for any version.
  - Any other `v`-tag of the release form → `Error("tag-version")`.
  - Anything else → `Error("tag-form")`.
- **`onMain`:** true when `git merge-base --is-ancestor <commit> <ref>` exits 0. The default `ref` is `origin/main`.
- **`adhocSign`:**
  - Off darwin it throws `Error("codesign-needs-macos")`.
  - On darwin it runs `codesign --force --sign - <path>`, then `codesign --verify --strict <path>`. Each must exit 0, else it throws `Error("codesign-failed")`.
- **`verifyDist`** returns problems. The list is `[]` when all of these hold:
  - `dir` holds exactly the five assets, `SHA256SUMS`, `RELEASE_NOTES.md` and `extra`;
  - `SHA256SUMS` has exactly five lines and `verifyChecksums` is `[]`;
  - on darwin, both macOS assets pass `codesign --verify --strict`.
- **`verifyCommands`:**
  - `sums`: `shasum -a 256 --ignore-missing -c SHA256SUMS`, `sha256sum --ignore-missing -c SHA256SUMS`, and the PowerShell line `(Get-FileHash .\<asset> -Algorithm SHA256).Hash.ToLower()`;
  - `attest`: `gh attestation verify <asset> --repo <repo> --signer-workflow <repo>/.github/workflows/release.yml --source-ref refs/tags/<tag> --deny-self-hosted-runners`.
- **`publish`:**
  1. List the repo's releases with `gh api repos/<repo>/releases --paginate`, and keep those with `tag_name === ctx.tag`. If any is published → `Error("already-published")`, and nothing is created. Delete each draft with `gh api -X DELETE repos/<repo>/releases/<id>`.
  2. Run `gh release create <tag> <assets…> --repo <repo> --verify-tag --draft --title <title> --notes-file <notes>`.
  3. Find the new draft's id, then read `gh api repos/<repo>/releases/<id>/assets`. The asset names must equal the asset set exactly, each `size` must equal its file's size, and each `digest` must be `sha256:` plus its `SHA256SUMS` hex. Otherwise → `Error("upload-mismatch")`, and the draft stays for inspection.
  4. Publish with `gh api -X PATCH repos/<repo>/releases/<id> -F draft=false -f make_latest=true`.
  5. `gh api repos/<repo>/releases/tags/<tag>` must show `draft: false` and `immutable: true`. Otherwise → `Error("not-immutable")`.
- **`childEnv`** copies `base` without the `drop` keys and without undefined values.

- [ ] **Step 1: Write the failing tests** in `test/release/kit.test.ts`.
  - **`TARGETS`** equals the table, row for row. `assetName("ai-practice", t)` gives the five names. `hostTarget("darwin", "arm64").id` is `darwin-arm64`.
  - **`compileBinary`** (Review Focus 2). Timeout 120 s, host target only, no network. The test compiles a three-line entry that prints `typeof D === "string" ? D : "absent"` and `process.env.KIT_CANARY ?? "unset"`, with `define: { D: JSON.stringify("k1:abc") }`.
    - Run in a clean folder, it prints `k1:abc unset`.
    - Run in a folder holding `.env` (`KIT_CANARY=dotenv`) and a `bunfig.toml` with `preload = ["./pre.ts"]`, where `pre.ts` writes a `PRELOADED` file, it prints `k1:abc unset`, and `PRELOADED` does not exist.
    - An entry with a syntax error, given `define: { D: JSON.stringify("SEKRIT-VALUE") }`, throws `compile-failed`, and the message does not contain `SEKRIT-VALUE`.
  - **Checksums.**
    - For a file holding `hello`, the line is `2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824  a.bin`.
    - Lines are sorted by name.
    - `verifyChecksums` names a changed file and a missing one.
  - **`releaseContext`** (Review Focus 5):
    - `v1.0.0` with `1.0.0` → `release`;
    - `v0.0.0-rehearsal.3` with `1.0.0` → `rehearsal`;
    - `v1.0.1` with `1.0.0` → `tag-version`;
    - `v1.0.0-dev` and `1.0.0` without the `v` → `tag-form`;
    - `v0.0.0-rehearsal.0` and `v0.0.0-rc.1` → `tag-form`;
    - `v1.0.0` with `1.0.0-dev` → `dev-version`.
  - **`onMain`,** in a temp git repo with `main` and a side branch, using `ref: "main"`: the main commit → true; the side commit → false.
  - **`adhocSign`** (Review Focus 3, darwin only, skipped elsewhere):
    - a host-compiled binary, after `codesign --remove-signature`, fails `codesign --verify`, then passes it after `adhocSign`;
    - an injected `run` that fails verification → `codesign-failed`;
    - off darwin, the call throws `codesign-needs-macos`.
  - **`verifyDist`,** with five fake assets: clean → `[]`. Each of these is named in the result: an extra file, a missing `SHA256SUMS` line, a changed byte, and (darwin only) an unsigned macOS asset.
  - **`publish`** (Review Focus 4). An injected `gh` records every call and answers from a script.
    - **No release yet:** the calls are list, create (with `--verify-tag --draft`), assets, PATCH and the final check, in that order.
    - **A draft exists:** it is deleted before the create, through the releases API by id, never with `--cleanup-tag`.
    - **Already published:** `already-published`, and no create.
    - **A digest that differs:** `upload-mismatch`, and no PATCH.
    - **A final check with `immutable: false`:** `not-immutable`.
  - **`childEnv`:** `{ PATH: "x", AIPROF_RELEASE_SIGNING_KEY: "k" }` with `drop: ["AIPROF_RELEASE_SIGNING_KEY"]` → `{ PATH: "x" }`.
  - **`test/app/compile.test.ts`** gains the hostile-folder case on the built `ai-practice`. Its folder holds a `.env` setting `CLAUDE_CONFIG_DIR=<tmp>/dotenv-canary`, plus the preload `bunfig.toml`. Then `--explain` output has no `dotenv-canary`, and there is no `PRELOADED`.
- [ ] **Step 2: Run** `bun test test/release/kit.test.ts test/app/compile.test.ts` → FAIL.
- [ ] **Step 3: Implement** `scripts/release/kit.ts`, and point `buildHost` at `compileBinary`.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `build(release): one hardened compile path, five targets, checksums, ad-hoc signing, tag rules, draft-first publish`.

---

### Task 3: B — the release CLI, notes and smoke; the workflows and their lint; v1.0.0

**Files:**
- Create:
  - `scripts/release.ts` and `scripts/release/{lint,notes,smoke}.ts`;
  - `.github/workflows/release.yml`;
  - `test/release/{cli,notes,smoke}.test.ts` and `test/repo/workflows.test.ts`.
- Modify:
  - `.github/workflows/ci.yml` and `.github/workflows/security-guard.yml`;
  - `package.json`: `version: "1.0.0"`, plus the scripts `release` and `docs`;
  - `test/smoke.test.ts`, and every snapshot that prints the version.

**Interfaces:**
```ts
// scripts/release/lint.ts — shared with A; node: modules and Bun.YAML only
export const PINS: Readonly<Record<string, { sha: string; version: string }>>;   // the Global Constraints pin table
export interface LintOptions { secrets: readonly string[]; bin: string }
export function lintWorkflows(dir: string, o: LintOptions): string[];           // "<file>: W<n> <what>" for each violation
// scripts/release/notes.ts
export function releaseNotes(ctx: ReleaseCtx): string;
// scripts/release/smoke.ts
export type SmokeChecks = Record<"version" | "help-privacy" | "explain" | "report" | "hostile-folder", boolean>;
export async function smokeBinary(bin: string, o: { version: string; tmp: string }): Promise<SmokeChecks>;
// scripts/release.ts
export interface ReleaseDeps { platform: string; arch: string; env: Record<string, string | undefined>; stdout(s: string): void; stderr(s: string): void;
  compile: typeof compileBinary; sign: typeof adhocSign; onMain: typeof onMain; gh: Gh; smoke: typeof smokeBinary }
export async function main(argv: readonly string[], d: ReleaseDeps): Promise<number>;   // 0 ok · 1 failure · 2 usage
```

**Commands.**
- **Flags.** Every command takes `--tag T`. `--dir` and `--out` default to `dist`.
- **Context.** `ctx` is `releaseContext({ tag, version: package.json version, repo: "build-with-bala/ai-practice-report", bin: "ai-practice", title: "AI Practice Report v" + version })`.

`build`:
1. Off darwin, it exits 1 with `error: release builds run on macOS (codesign)`.
2. For `release`, the tag's commit must pass `onMain`. Otherwise it exits 1 with `error: <tag> is not on origin/main`.
3. It recreates `dist/`, then compiles the five targets from `app/cli.ts`.
4. It signs both macOS assets.
5. It writes `SHA256SUMS` and `RELEASE_NOTES.md`.
6. It prints one line per asset: the name and the first 12 hex of its SHA-256.

`verify-dist`:
1. It runs `verifyDist`. Any problem is printed, and it exits 1.
2. It then smokes the `hostTarget` asset.

`smoke --asset A`:
1. On POSIX it first runs `chmod 0755`, because downloaded artifacts lose the mode.
2. It runs `smokeBinary` in a fresh temp folder.
3. It prints `key=PASS|FAIL` lines, and exits 1 on any FAIL.

`publish`:
- A rehearsal exits 1 with `error: rehearsals never publish`, before any `gh` call.
- Otherwise it runs the kit's `publish`.

**`smokeBinary`** runs the binary with these variables pointed into `<tmp>/home`: `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `XDG_*`, `TMPDIR`, `TEMP` and `TMP`. It also passes `PATH` and `SystemRoot`, and nothing else. Its checks:
- **`version`:** `--version` prints `version`.
- **`help-privacy`:** `--help`, with runs of whitespace collapsed, holds every `PRIVACY_STATEMENT` sentence.
- **`explain`:** `--explain` exits 0.
- **`report`:** `--no-open --out <tmp>/out/r.html` on the empty home exits 0. `auditHtml` of the file gives `cspOk`, no external refs and fewer than 5,000 elements.
- **`hostile-folder`:** run from a folder holding the `.env` and `bunfig.toml` of Task 2, `--explain` output has no `dotenv-canary`, and there is no `PRELOADED`.

**`releaseNotes(ctx)`** holds:
- the title;
- one line per asset with its platform;
- `verifyCommands` for each asset;
- the macOS quarantine note: run `xattr -d com.apple.quarantine <asset>` only after the checksum passes;
- the Windows SmartScreen note;
- the `PRIVACY_STATEMENT` sentences as a numbered list;
- a link to `docs/method.md` at the tag.

**Workflow rules** (`lintWorkflows`; YAML from `Bun.YAML.parse`, and version comments read from the raw lines):

| rule | requirement |
|---|---|
| W1 | Every non-local `uses:` is `<action>@<sha> # v<x.y.z>`, where the action is a key of `PINS` with exactly that sha and version. |
| W2 | No `pull_request_target` and no `workflow_run`. `release.yml` triggers only on `push` with `tags: ["v*"]`. `ci.yml` triggers on `push` with `branches: ["**"]`, on `pull_request` and on `workflow_call`. `security-guard.yml` keeps push and PR to `main` and `workflow_dispatch`, and adds `workflow_call`. |
| W3 | Every workflow's top-level `permissions` is `{}` or `{contents: read}`. Every `release.yml` job declares `permissions`. Only the job `release` has a write scope, and its permissions are exactly `contents: write`, `id-token: write` and `attestations: write`. |
| W4 | `secrets.` occurs only in `release.yml`'s `release` job, only as the value of a step `env` entry named in `o.secrets`. Each listed secret occurs exactly once. `github.token` occurs only as the publish step's `GH_TOKEN`. |
| W5 | No `run:` body contains `${{`. |
| W6 | `release`: `environment: release`, `runs-on: macos-latest`, `needs: [guard, test]`, `if` exactly `${{ !startsWith(github.ref, 'refs/tags/v0.0.0-') }}`. Its steps run in the order build, verify-dist, attest (`subject-checksums: dist/SHA256SUMS`), publish. `rehearsal`: no `environment`, `contents: read`, `runs-on: macos-latest`, `if` exactly `startsWith(github.ref, 'refs/tags/v0.0.0-rehearsal.')`. `rehearsal-smoke`: `needs: rehearsal`, `contents: read`, and a matrix `include` equal to `TARGETS` as `{ runner, asset: assetName(o.bin, t) }`. |
| W7 | Every `actions/checkout` step has `persist-credentials: false`. |
| W8 | `release.yml`'s job `guard` uses `./.github/workflows/security-guard.yml`. Job `test` uses `./.github/workflows/ci.yml` and needs `guard`. |
| W9 | Every `oven-sh/setup-bun` step has `bun-version: 1.3.11`. |
| W10 | `release.yml` sets `defaults.run.shell: bash`. No job or step sets `continue-on-error`. |

**`.github/workflows/release.yml`** (B; A's differs only in the asset names and in one `env` line, Task 9):
```yaml
name: Release
on:
  push:
    tags: ["v*"]
permissions: {}
concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false
defaults:
  run:
    shell: bash
jobs:
  guard:
    permissions:
      contents: read
    uses: ./.github/workflows/security-guard.yml
  test:
    needs: guard
    permissions:
      contents: read
    uses: ./.github/workflows/ci.yml
  rehearsal:
    needs: [guard, test]
    if: startsWith(github.ref, 'refs/tags/v0.0.0-rehearsal.')
    runs-on: macos-latest
    timeout-minutes: 30
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
        with:
          bun-version: 1.3.11
      - run: bun install --frozen-lockfile
      - run: bun scripts/release.ts build --tag "$TAG"
        env:
          TAG: ${{ github.ref_name }}
      - run: bun scripts/release.ts verify-dist --tag "$TAG"
        env:
          TAG: ${{ github.ref_name }}
      - uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
        with:
          name: rehearsal-dist
          path: dist/
          retention-days: 1
          if-no-files-found: error
  rehearsal-smoke:
    needs: rehearsal
    strategy:
      fail-fast: false
      matrix:
        include:
          - { runner: macos-latest, asset: ai-practice-macos-arm64 }
          - { runner: macos-15-intel, asset: ai-practice-macos-x64 }
          - { runner: ubuntu-latest, asset: ai-practice-linux-x64 }
          - { runner: ubuntu-24.04-arm, asset: ai-practice-linux-arm64 }
          - { runner: windows-latest, asset: ai-practice-windows-x64.exe }
    runs-on: ${{ matrix.runner }}
    timeout-minutes: 20
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
        with:
          bun-version: 1.3.11
      - run: bun install --frozen-lockfile
      - uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2
        with:
          name: rehearsal-dist
          path: dist
      - run: bun scripts/release.ts smoke --tag "$TAG" --asset "$ASSET"
        env:
          TAG: ${{ github.ref_name }}
          ASSET: ${{ matrix.asset }}
  release:
    needs: [guard, test]
    if: ${{ !startsWith(github.ref, 'refs/tags/v0.0.0-') }}
    runs-on: macos-latest
    timeout-minutes: 45
    environment: release
    permissions:
      contents: write
      id-token: write
      attestations: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
          fetch-depth: 0
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
        with:
          bun-version: 1.3.11
      - run: bun install --frozen-lockfile
      - run: bun scripts/release.ts build --tag "$TAG"
        env:
          TAG: ${{ github.ref_name }}
      - run: bun scripts/release.ts verify-dist --tag "$TAG"
        env:
          TAG: ${{ github.ref_name }}
      - uses: actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4.2.2
        with:
          subject-checksums: dist/SHA256SUMS
      - run: bun scripts/release.ts publish --tag "$TAG"
        env:
          TAG: ${{ github.ref_name }}
          GH_TOKEN: ${{ github.token }}
```
**`ci.yml` and `security-guard.yml` edits:**
- **`ci.yml`:** `on` becomes `push: { branches: ["**"] }`, `pull_request` and `workflow_call`, so a tag push runs CI only through `release.yml`. Its checkout gains `persist-credentials: false`.
- **`security-guard.yml`:** `on` gains `workflow_call`, and its checkout gains `persist-credentials: false`. Its gate script stays byte for byte.

- [ ] **Step 1: Write the failing tests.**
  - **`workflows.test.ts`:**
    - `lintWorkflows(".github/workflows", { secrets: [], bin: "ai-practice" })` is `[]`;
    - for each rule W1–W10, a YAML fixture written inline breaks just that rule, and the result names it;
    - examples: `actions/checkout@v7`, a `pull_request_target` trigger, `contents: write` on `test`, a `secrets.X` in `ci.yml`, a `${{ github.ref_name }}` inside `run:`, a missing `environment`, a checkout without `persist-credentials`, a missing guard call, `bun-version: latest`, and `continue-on-error: true`.
  - **`cli.test.ts`,** with injected deps:
    - `build --tag v1.0.1` → exit 1 (`tag-version`), and `compile` is never called;
    - platform `linux` → exit 1, and `compile` is never called;
    - `build --tag v1.0.0` with `onMain` returning false → exit 1 (Review Focus 5);
    - `build --tag v0.0.0-rehearsal.1`, with a fake `compile` that writes its `outfile` and a fake `sign`, gives exit 0, and:
      - `dist` holds the five assets, `SHA256SUMS` and `RELEASE_NOTES.md`;
      - `compile` was called five times, with `app/cli.ts` and the five Bun targets;
      - `sign` was called for the two macOS assets only;
    - `verify-dist` on darwin with an unsigned macOS asset → exit 1, naming it (Review Focus 3);
    - `publish --tag v0.0.0-rehearsal.1` → exit 1, and `gh` is never called.
  - **`notes.test.ts`:** `releaseNotes` for `v1.0.0` holds every `PRIVACY_STATEMENT` sentence, every asset name, and every asset's `attest` command with `--source-ref refs/tags/v1.0.0`.
  - **`smoke.test.ts`** (timeout 180 s): `smokeBinary(await buildHost({ outDir: tmp }), { version: VERSION, tmp })` gives every check true. CI runs this on ubuntu, macOS and Windows.
  - **`test/smoke.test.ts`:** `VERSION` is `"1.0.0"`, and `releaseContext({ tag: "v" + VERSION, … }).kind` is `release`.
- [ ] **Step 2: Run** `bun test test/release test/repo test/smoke.test.ts` → FAIL.
- [ ] **Step 3: Implement** the CLI, the notes, the smoke, the lint and the three workflows. Then bump the version.
- [ ] **Step 4: Run** `bun test --update-snapshots`. Every changed snapshot line differs only in `1.0.0-dev` → `1.0.0`; check this with `git diff -U0 -- '*.snap'`. Then run `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `ci(release): tag-driven release with a read-only rehearsal path; workflow lint; v1.0.0`.

---

### Task 4: B — README, method, releasing and security docs, rendered from code where code pins them

**Files:**
- Create:
  - `scripts/release/docs.ts` (shared with A) and `scripts/docs.ts`;
  - `docs/method.md`, `docs/releasing.md` and `SECURITY.md`;
  - `test/docs/{blocks,claims}.test.ts`.
- Modify:
  - `README.md`, rewritten;
  - `docs/design.md`: its status line becomes `**Status:** approved 2026-11-17; implemented by Plans 1–6 (B v1.0.0, A v2.0.0)`, and one line under the title says it is the design the build started from, while `docs/method.md` describes what the code does.

**Interfaces:**
```ts
// scripts/release/docs.ts — shared with A
export function applyBlocks(md: string, blocks: Readonly<Record<string, string>>): string;   // body between <!-- gen:NAME --> and <!-- /gen:NAME -->; throws on a missing or doubled marker
export function stripBlocks(md: string): string;                                           // every generated body removed
export const OVERCLAIMS: readonly RegExp[];
export function findOverclaims(text: string): string[];                                    // "<line>: <match>"
export function downloadBlock(repo: string, bin: string): string;
export function verifyBlock(ctx: Pick<ReleaseCtx, "repo" | "tag" | "bin">): string;
// scripts/docs.ts — B
export function renderBlocks(): Record<string, Record<string, string>>;   // file → block name → body
export function staleBlocks(root: string): string[];                      // "README.md#privacy", …
// CLI: bun scripts/docs.ts --check (default; exit 1 listing stale blocks) | --write
```

**`OVERCLAIMS`** (case-insensitive):
- `tamper[- ]?proof`
- `\bguarantee[sd]?\b`
- `\bprov(e|es|en|ing)\b`
- `\bproof\b`
- `%\s*match`
- `\brecommend\w*`
- `\brank(s|ed|ing|ings)?\b`
- `\bhire\b`
- `\bunhackable\b`
- `cannot be faked`

**Blocks** (B):

| file | block | rendered from |
|---|---|---|
| README.md | `download` | `downloadBlock("build-with-bala/ai-practice-report", "ai-practice")` |
| README.md | `verify` | `verifyBlock` for `v` + `VERSION` |
| README.md | `flags` | `helpText(<registry tool ids>)`, the lines before the privacy paragraph, fenced |
| README.md | `privacy` | `PRIVACY_STATEMENT` as `1. …` lines |
| README.md | `tools` | `registry`, one row per tool: the kit's tool label, tier, `beta` or `verified`, its plugin ids |
| docs/method.md | `formulas`, `reference`, `never-opened` | `reportFixture("intermediate").model.method`: `formulas`, `reference` and `neverOpened` |
| docs/method.md | `weights` | core's `WEIGHTS` |
| docs/method.md | `checks` | `CHECK_LABEL`: id and label |
| docs/method.md | `privacy` | `PRIVACY_STATEMENT` |

**`downloadBlock`** writes one fenced block per OS: macOS bash, Linux bash, and Windows PowerShell.
- Each fetches the asset and `SHA256SUMS` from `https://github.com/<repo>/releases/latest/download/`.
- Each checks the asset's checksum before running it.
- On macOS and Linux, it picks the arch from `uname -m`: `x86_64` → `x64`, and `aarch64` or `arm64` → `arm64`.

**`verifyBlock`** writes the five `attest` commands of `verifyCommands`.

**Prose** (hand-written, checked by `findOverclaims`):
- **README.md.** Sections in this order:
  1. A one-line pitch.
  2. **Install:** `download`, then `verify`, then the macOS quarantine and Windows SmartScreen notes.
  3. **Run:** the default command and where the report lands, then `flags`.
  4. **What the report shows:** one line per chapter of spec §7.2.
  5. **Privacy:** `privacy`, then a pointer to `--explain`.
  6. **Supported tools:** `tools`, with what beta means.
  7. **How scores work:** six lines and a link to `docs/method.md`.
  8. **Data health:** the integrity checks raise the cost of faking history and are never a verdict.
  9. **Using the engine:** the spec §6.9 three-line example, with `./core`, `./viz` and `./agents`.
  10. **Build from source:** `bun install`, `bun test`, `bun run build`. It notes that running from source honours a folder's `.env` and `bunfig.toml`, while the released binaries ignore both.
  11. **Security and releases:** links to `SECURITY.md` and `docs/releasing.md`.
  12. **License:** MIT; the fonts are under OFL 1.1.
- **docs/method.md:**
  - sources and the two time layers;
  - the two read classes and the repo signals;
  - events carry no text;
  - the signals;
  - scoring: transforms, reference v0, shrinkage, confidence, bootstrap intervals, the overall and its bands, insufficient evidence, the open tail;
  - the unscored panels;
  - data health: the bands, and that the server-backed share is shown and never weighted;
  - the privacy layer;
  - coach and history, both opt-in;
  - honest limits;
  - semver for the export schema.

  The blocks sit where each topic needs them.
- **docs/releasing.md:**
  - the Task 1 settings, by name, with the read-back commands;
  - the jobs and their permissions;
  - the rehearsal tag pattern;
  - the one approval;
  - verifying a release;
  - fixing a published release forward with a patch release.
- **SECURITY.md:**
  - supported versions: 1.x;
  - report privately with GitHub's "Report a vulnerability";
  - verify downloads (a link to the README's verify section);
  - what is out of scope.

- [ ] **Step 1: Write the failing tests.**
  - **`blocks.test.ts`:**
    - `staleBlocks(<B>)` is `[]`;
    - `applyBlocks` throws on a missing marker and on a doubled marker;
    - rendering twice gives equal bodies;
    - the `privacy` body equals `PRIVACY_STATEMENT.map((s, i) => `${i + 1}. ${s}`).join("\n")`;
    - the `download` body names all five assets, `SHA256SUMS`, and both check commands;
    - the `verify` body holds `refs/tags/v1.0.0` five times.
  - **`claims.test.ts`:**
    - `findOverclaims(stripBlocks(text))` is `[]` for `README.md`, `SECURITY.md`, `docs/method.md`, `docs/releasing.md` and `releaseNotes(ctx)`;
    - a self-test flags one sample of each pattern, such as "tamper-proof", "guarantees", "proves", "100% match", "we recommend", "ranked first" and "hire";
    - a pinned sentence placed inside a generated block is not flagged.
- [ ] **Step 2: Run** `bun test test/docs` → FAIL.
- [ ] **Step 3: Write** the tooling. Then write the prose, and run `bun scripts/docs.ts --write`.
- [ ] **Step 4: Run** `bun test && bunx tsc --noEmit && bun scripts/docs.ts --check` → PASS.
- [ ] **Step 5: Commit** `docs: README, method, releasing and security docs; pinned statements rendered from code`.

---

### Task 5: B — final visual QA of every report surface (controller gate)

**Files:** only fix-ups, in the files that own each issue.

- [ ] **Step 1: Write the QA set.** Use Plan 3 Task 16's `writeQaReports` to write every kind into `<scratch>/qa/B/in`: expert, expert-anonymized, intermediate, novice, empty, lifetime-only, repo-off and odd-names. Add Plan 5a's history and coach fixtures.
- [ ] **Step 2: Run the QA.** Run `bun scripts/visual-qa.ts --playwright <installed playwright package> --in <scratch>/qa/B/in --out <scratch>/qa/B/out`. It covers dark and light, 1440 px and 390 px, A4 print, and the share card's SVG and PNG downloads. Playwright comes from outside the repo: either the Playwright MCP tools, taking the same shots, or an npx-cached package with `npx playwright install chromium`. Every check in `summary.json` must PASS.
- [ ] **Step 3: Controller review** of every PNG and PDF. It applies Plan 3 Task 16's checklist (hierarchy, type roles, contrast, layout, mobile order, print) and Plan 5a's checks of the coach chapter and the month-over-month table. It adds these:
  - the colophon reads `ai-practice-report v1.0.0`;
  - no `-dev` and no "work in progress" text appears anywhere;
  - the Method section shows all eight privacy sentences;
  - the anonymized report shows no folder or config name.
- [ ] **Step 4: Fix and repeat.** Each issue becomes a `fix(report): …` commit in its owning file, and Steps 1–3 run again. The task is accepted only when the controller approves. Images never enter the repo.

---

### Task 6: B — PR, rehearsal on the PR head, whole-branch review, merge

**Files:** none new.

**Interfaces:** **Produces** `B_RELEASE_SHA`, the merge commit on `main`. Task 7 pins it, and Task 13 tags it.

- [ ] **Step 1: Final checks on `feat/ship-v1`.**
  - `bun test && bunx tsc --noEmit && bun scripts/docs.ts --check` → PASS.
  - Local acceptance against the real HOME: `bun scripts/smoke-local.ts` and `bun scripts/report-smoke.ts`. Turn the sandbox off if it blocks reads. Both exit 0 with every line PASS. Keep only the pass/fail lines.
- [ ] **Step 2: Push and open the PR.**
```bash
# EtherHiding config scan → nothing printed
git push -u origin feat/ship-v1
gh pr create --base main --title "Ship v1.0.0: hardened builds, release workflow with a rehearsal path, docs" --body "<summary · Task 1 settings pass lines · pass/fail lines · visual QA approved by the controller · no figures from anyone's machine>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch   # green: CI on three operating systems, plus the security guard
```
- [ ] **Step 3: Rehearse.**
```bash
git tag v0.0.0-rehearsal.1 HEAD && git push origin refs/tags/v0.0.0-rehearsal.1
gh run list --workflow release.yml --limit 1 --json databaseId,url    # the rehearsal run
gh run watch <id> --exit-status
gh run view <id> --json jobs --jq '[.jobs[] | {name, conclusion}]'
gh api repos/build-with-bala/ai-practice-report/actions/runs/<id>/pending_deployments   # → []
```
  Expected: the guard and test jobs succeed; `rehearsal` succeeds; all five `rehearsal-smoke` jobs succeed; `release` is `skipped`. If the run fails, fix it on the branch, push, and rehearse again with the next `<n>`.
- [ ] **Step 4: Inspect the rehearsal output.**
  - Run `gh run download <id> -n rehearsal-dist -D <scratch>/rehearsal/B`.
  - `shasum -a 256 -c SHA256SUMS` → five OK.
  - The asset for the controller's own platform prints `1.0.0` for `--version`.
- [ ] **Step 5: Clean up the rehearsal.**
  - Delete the tag: `git push origin :refs/tags/v0.0.0-rehearsal.<n> && git tag -d v0.0.0-rehearsal.<n>`.
  - Delete the artifact: `gh api repos/build-with-bala/ai-practice-report/actions/runs/<id>/artifacts --jq '.artifacts[].id'`, then `gh api -X DELETE …/actions/artifacts/<artifact id>`.
  - Remove `<scratch>/rehearsal/B`.
  - Add to the PR body: the rehearsal run URL and the tree hash from `git rev-parse HEAD^{tree}`.
- [ ] **Step 6: Whole-branch review.** The controller reviews the whole branch. Any code change after the review means rehearsing again.
- [ ] **Step 7: Merge.**
```bash
gh pr merge --squash --delete-branch
# EtherHiding config scan → nothing printed
git switch main && git pull --ff-only
B_RELEASE_SHA=$(git rev-parse HEAD)
git rev-parse HEAD^{tree}   # must equal the rehearsed tree; if not, rehearse once more, with the tag on HEAD
```

---

### Task 7: A — pin B's release commit; adopt Plan 5a's interfaces

**Files:**
- Modify:
  - `package.json`: the `ai-practice-report` dependency and `corePin`;
  - `bun.lock`;
  - `src/cli/{run,find,session,explain}.ts`;
  - `src/cli/scan-options.ts` and `test/cli/scan-options.test.ts`, which Plan 5b Task 10 created: `candidateScan` gains `repoStores` (P5 pre-flight J7, J8);
  - `src/cli/help.ts`: the tool-id list wraps at 100 columns for all 22 ids (P5 pre-flight J7);
  - `src/copy.ts`: `PRIVACY_STATEMENT` sentence 4 gains "and Aider's history files", and the snapshots that hold the statement (P5 pre-flight J7);
  - `src/consent/fingerprints.ts`: Plan 5b's local `isStableId` gives way to core's `stableSessionId` (P5 pre-flight J7, J9);
  - `test/kit/core.ts`, which also re-exports B's `app/coach/agents.ts` by relative path, for the contract test only (P5 pre-flight J7);
  - `test/cli/explain.test.ts`;
  - the contract tests, wherever Plan 5a announced a change.
- Create: `test/contract/agents.test.ts` (P5 pre-flight J7)

**Interfaces:**
```ts
// src/cli/scan-options.ts
export function candidateScan(o: { platform: "darwin" | "linux" | "win32"; repoSignals: boolean; repoStores?: boolean /* default: repoSignals */ }): { wsl: boolean; repoSignals: boolean; repoStores: boolean };   // wsl: platform === "win32"; find and session end pass { repoSignals: false, repoStores: true } (P5 pre-flight J7)
// test/kit/core.ts
export function allBuilders(h: FakeHome): void;   // every fixture builder B's test kits export: Plan 1's eight and Plan 5a's readers
// test/contract/agents.test.ts — A keeps its own brief runner and never imports ./agents; this test holds A's claude and codex argv and env (briefArgv, briefEnv) equal to B's AGENTS table (P5 pre-flight J7)
```
- **Explain.** `explainText` gains a "Where" block. It lists each `SOURCE_ROOTS` key with its root for the current env, tildified, followed by the line "On Windows, the same files inside WSL distributions are read too; their names are never printed."
  - The env and tildify helpers come from `ai-practice-report/core`, and `main` passes `d.scanEnv ?? detectEnv()`.
  - If core exports neither `detectEnv` nor `tildify`, the block lists the placeholder names only, and the task report says so.

- [ ] **Step 1: Pin.**
  - Set the dependency to `github:build-with-bala/ai-practice-report#<B_RELEASE_SHA>`, and `corePin` to `{ repo: "build-with-bala/ai-practice-report", sha: <B_RELEASE_SHA>, ref: "v1.0.0" }`.
  - Run `bun install`, with the network.
  - The installed `node_modules/ai-practice-report/` must have version `1.0.0`, `scripts/release/{kit,lint,docs}.ts`, and core exports `SOURCE_ROOTS`, `PLACEHOLDER_WILDCARDS` and `scan` with `wsl`. Core also exports `stableSessionId` and `ScanOptions.repoStores`, and `app/coach/agents.ts` holds `AGENTS` (P5 pre-flight J7). If anything is missing, report BLOCKED.
- [ ] **Step 2: Write the failing tests.**
  - **The pin and core version:** Plan 4's pin test passes on the new SHA, and `CORE_VERSION === "1.0.0"`.
  - **`scan-options.test.ts`** (Plan 5b Task 10's, extended):
    - `win32` → `wsl: true`; `darwin` and `linux` → `wsl: false`;
    - `repoSignals` passes through, and `repoStores` defaults to it;
    - `src/cli/run.ts`, `find.ts` and `session.ts` each contain `candidateScan(` and pass its result to `scan`;
    - `find` and `session end` pass `repoSignals: false` with `repoStores: true`, the candidate run's default, so repo-scoped sessions stay findable with git off (P5 pre-flight J7).
  - **`agents.test.ts`** (P5 pre-flight J7): for claude and codex, `briefArgv` equals B's `AGENTS[cli].argv({ shim: false, schemaJson })` token for token, apart from A's schema value and A's `--output-last-message <file>` pair; `briefEnv(cli, {})` equals B's `AGENTS[cli].env` plus `NO_COLOR=1`.
  - **Stable ids** (P5 pre-flight J7, J9): core's `stableSessionId` agrees with Plan 5b's `isStableId` on UUID, `ses_…`, `T-<uuid>` and 16-hex ids; after the swap, F7's picks, continuity and pairing sessions use `stableSessionId`, and Plan 5b's continuity and fingerprint tests pass unchanged.
  - **Help** (P5 pre-flight J7): with every registry tool id, each help line is at most 100 columns.
  - **Privacy sentence 4** (P5 pre-flight J7): `PRIVACY_STATEMENT[3]` (sentence 4) is exactly "In the git repositories your sessions ran in, it reads commit metadata, a short list of config files and Aider's history files (see --explain), never source files; --no-repo-signals turns this off." Regenerated snapshots differ only in sentence 4.
  - **Coach runs** (P5 pre-flight J7): a Claude Code fixture session whose cwd is `<home>/.ai-practice/coach` is absent from the candidate run's payload, because core drops it (`skipped["own-coach"]`).
  - **`explain.test.ts`:**
    - the output holds every `SOURCE_ROOTS` key and the WSL line;
    - every `<…>` token in any registry `describe` text is a `SOURCE_ROOTS` key or in `PLACEHOLDER_WILDCARDS`;
    - the static import rule now also allows those two names and the env helpers.
  - **Fixtures:** the contract tests and the canary harness (R1–R12) run with the new `allBuilders`.
- [ ] **Step 3: Run** `bun test` → FAIL.
- [ ] **Step 4: Implement.** If a contract differs in a way Plan 5a never announced, report BLOCKED with the difference. Never patch around it.
- [ ] **Step 5: Run** `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 6: Commit** `build: pin ai-practice-report v1.0.0; explain roots, every reader in the canary harness, the agents-table contract, stable session ids and repo stores` (P5 pre-flight J7).

---

### Task 8: A — the release key: generate, back up, set the secret, ship the public half

**Files:**
- Create: `scripts/release/key.ts`, `scripts/release-key.ts`, `test/release/key.test.ts`, `test/repo/no-release-seed.test.ts`
- Modify:
  - `src/trust/release-keys.json`: the real public entry;
  - `test/trust/release.test.ts`: the shipped list;
  - `.gitignore`: add `*.release-key.json`.

**Interfaces:**
```ts
// scripts/release/key.ts
export const RELEASE_KEY_ENV = "AIPROF_RELEASE_SIGNING_KEY";
export interface ReleaseKeyBackup { format: "aiprof-release-key/1"; keyId: string; alg: "Ed25519"; seed: string; pub: string; fingerprint: string; createdAt: string }
export function newReleaseKey(keyId: string, o: { now: number; rand?: Rand }): { backup: ReleaseKeyBackup; entry: ReleaseKeysFile["keys"][number] };
export function writeBackup(path: string, b: ReleaseKeyBackup): void;   // 0600 in a 0700 folder; Error("exists"), Error("inside-repo")
export function readBackup(path: string): ReleaseKeyBackup;              // Error never quotes the file
export function signingKeyString(b: Pick<ReleaseKeyBackup, "keyId" | "seed">): string;   // "<keyId>:<seed>", Plan 4's define format
export function checkReleaseKey(value: string, file: ReleaseKeysFile): { keyId: string; fingerprint: string };
export function ephemeralKey(rand?: Rand): { keyId: string; define: string; pubkeys: string };
  // keyId "rehearsal-<fp 8 hex>"; define is the signing-key string "<keyId>:<b64u seed>" (never written to disk);
  // pubkeys is the AIPROF_RELEASE_PUBKEYS JSON for that key (public)
```
- **CLI** (`scripts/release-key.ts`, built on `main(argv, deps)` with injected `spawn`, `stdout`, `stderr`, `env` and `now`):
  - **`new --key-id ID --backup PATH`** prints exactly one line: the public entry `{"keyId","alg","pub","fingerprint","revoked":null}`.
  - **`set-secret --backup PATH --repo OWNER/NAME`** spawns `gh secret set AIPROF_RELEASE_SIGNING_KEY --env release --repo OWNER/NAME`, with `signingKeyString` on stdin and no trailing newline.
  - **`check --backup PATH | --env`** prints `release key <id> <display fingerprint> matches src/trust/release-keys.json`.
- **Rules:**
  - **`writeBackup`** refuses a folder that is inside a git work tree: any ancestor holding `.git`.
  - **`checkReleaseKey`:**
    - it parses `<id>:<43-char b64u seed>`;
    - the entry must exist and not be revoked;
    - the derived public key must equal the entry's `pub`;
    - every error names only key ids and display fingerprints.
  - **Secrecy:** no message, line or argv ever holds the seed.

- [ ] **Step 1: Write the failing tests.**
  - **`key.test.ts`, generation and backup:**
    - `newReleaseKey("rel-test", { now, rand: fixed })` is deterministic, and its entry's `fingerprint` equals `fingerprint(unb64u(pub))`;
    - Plan 4's `resolveSigner({ embedded: signingKeyString(backup) })` gives a `release` signer with the same `pub`;
    - `writeBackup` makes a 0600 file in a 0700 folder (POSIX);
    - an existing file → `exists`;
    - a folder inside a temp git repo → `inside-repo`;
    - `readBackup` round-trips, and a malformed backup's Error does not contain its seed.
  - **`key.test.ts`, checking** (Review Focus 1):
    - **Match:** gives `{ keyId, fingerprint }`.
    - **Same id, other key:** an Error that names the id and both display fingerprints.
    - **Unknown id, or a revoked entry:** an Error.
    - **Malformed values** (`"x"`, no colon, a 31-byte seed): an Error that does not contain the value.
  - **`key.test.ts`, the rehearsal key:** `ephemeralKey()` gives an id matching `^rehearsal-[0-9a-f]{8}$`. `resolveSigner({ embedded: define })` gives a `release` signer under that id, and `loadTrust({ AIPROF_RELEASE_PUBKEYS: pubkeys })` loads its public key with no error.
  - **`key.test.ts`, the CLI:**
    - `new`'s stdout is one JSON line with the five entry keys and no seed;
    - `set-secret` spawns exactly the argv above, with stdin `<id>:<seed>`, and neither argv nor the script's stdout and stderr contain the seed;
    - `check --env` reads the variable from the injected env.
  - **`no-release-seed.test.ts`:**
    - **The scan:** for every tracked text file (`git ls-files`, skipping any file whose first 8 KiB hold a NUL byte), read every 43-char base64url token, every 44-char base64 token ending in `=` and every 64-hex token as a 32-byte seed.
    - **The rule:** the Ed25519 public key each derives, through Plan 4 F3's PKCS#8 prefix, equals no `pub` in `release-keys.json`.
    - **Positive control:** a temp text holding a test-time key's seed in all three encodings gives three hits against that key's `pub`.
  - **`release.test.ts`:** "the shipped list is empty" becomes "the shipped list holds exactly `rel-2026a`, not revoked, with a fingerprint that matches its `pub`".
- [ ] **Step 2: Run** `bun test test/release test/repo test/trust` → FAIL.
- [ ] **Step 3: Implement** `key.ts` and `release-key.ts`, and add the `.gitignore` line. Then run `bun test test/release/key.test.ts test/repo` → PASS. `release.test.ts` still fails until Step 4.
- [ ] **Step 4: Generate the real key.** Do this once, locally, with the sandbox on. Never generate a second key for `rel-2026a`.
```bash
bun scripts/release-key.ts new --key-id rel-2026a --backup ~/.ai-profiler-release/rel-2026a.release-key.json > <scratch>/rel-2026a.pub.json
ls -l ~/.ai-profiler-release/                     # -rw------- for the file
ls -ld ~/.ai-profiler-release                     # drwx------
```
  - Write `{"v":1,"keys":[<the entry from <scratch>/rel-2026a.pub.json>]}` to `src/trust/release-keys.json`, as 2-space JSON with a final newline.
  - Delete `<scratch>/rel-2026a.pub.json`.
- [ ] **Step 5: Set the secret** (sandbox off).
```bash
bun scripts/release-key.ts set-secret --backup ~/.ai-profiler-release/rel-2026a.release-key.json --repo build-with-bala/ai-candidate-profiler
gh secret list --env release --repo build-with-bala/ai-candidate-profiler   # AIPROF_RELEASE_SIGNING_KEY
bun scripts/release-key.ts check --backup ~/.ai-profiler-release/rel-2026a.release-key.json   # "… matches src/trust/release-keys.json"
```
- [ ] **Step 6: Run** `bun test && bunx tsc --noEmit` → PASS. This includes `no-private-keys` and `no-release-seed`.
- [ ] **Step 7: Commit.** `git status --porcelain` lists only this task's repo files; the backup lives outside `<A>`. Commit `feat(release): rel-2026a — public half shipped; private half only in the release environment and the owner's offline backup`.
- [ ] **Step 8: Report** to the controller, for the final report: the key id, its display fingerprint, and the backup location `~/.ai-profiler-release/rel-2026a.release-key.json`.

---

### Task 9: A — the release CLI with the key, notes, smoke and workflows; hardened host builds; v2.0.0

**Files:**
- Create:
  - `scripts/kit/release.ts`, `scripts/release.ts` and `scripts/release/{notes,smoke}.ts`;
  - `.github/workflows/release.yml`;
  - `test/release/{cli,notes,smoke}.test.ts` and `test/repo/workflows.test.ts`.
- Modify:
  - `scripts/build.ts`;
  - `test/compile.test.ts`;
  - `.github/workflows/{ci,security-guard}.yml`, with the same edits as B's Task 3;
  - `package.json`: `version: "2.0.0"`, plus the scripts `release` and `docs`;
  - the tests that pin the running version, and the snapshots.

**Interfaces:**
```ts
// scripts/kit/release.ts — the only bridge into B's release kit (as test/kit/core.ts is for B's test kits)
export * from "../../node_modules/ai-practice-report/scripts/release/kit.ts";
export * from "../../node_modules/ai-practice-report/scripts/release/lint.ts";
export * from "../../node_modules/ai-practice-report/scripts/release/docs.ts";
// scripts/build.ts
export async function buildHost(o: { outDir: string; signingKey?: string }): Promise<string>;
  // compileBinary({ entry: "src/cli.ts", outfile, define: signingKey ? { AIPROF_RELEASE_SIGNING_KEY: JSON.stringify(signingKey) } : undefined })
// scripts/release/smoke.ts
export type ProfilerSmokeChecks = Record<"version" | "help-statements" | "explain" | "flow" | "signed-as-expected" | "dossier-audit" | "hostile-folder", boolean>;
export async function smokeBinary(bin: string, o: { version: string; tmp: string; expect: "release" | "trusted-env"; pubkeys?: string }): Promise<ProfilerSmokeChecks>;
// scripts/release.ts — B's main and ReleaseDeps, with ctx { repo: "build-with-bala/ai-candidate-profiler", bin: "ai-profiler", title: "AI Candidate Profiler v" + version }
```

**What differs from B:**
- **`build`, release kind:**
  1. A missing `AIPROF_RELEASE_SIGNING_KEY` → exit 1 with `error: release builds need AIPROF_RELEASE_SIGNING_KEY`.
  2. `checkReleaseKey` against the shipped `release-keys.json` runs before any compile, and a mismatch exits 1. On a match, it prints the `matches` line.
  3. The variable is deleted from `d.env`.
  4. All five compiles get `define: { AIPROF_RELEASE_SIGNING_KEY: JSON.stringify(value) }`.
- **`build`, rehearsal kind:**
  - it ignores any env value and uses `ephemeralKey()`;
  - it writes `dist/rehearsal-pubkeys.json`, which `verifyDist` accepts as `extra`.
- **Every child process** starts with `childEnv(d.env, [RELEASE_KEY_ENV])`.
- **Smoke expectations:**
  - `verify-dist` and `smoke` expect `release` for a release tag;
  - for a rehearsal tag, they expect `trusted-env`, with `pubkeys` from `dist/rehearsal-pubkeys.json`.
- **`smokeBinary`** runs in the same isolated env as B's, plus `AIPROF_HOME=<tmp>/aiprof`, plus `AIPROF_RELEASE_PUBKEYS` only for `trusted-env`. Its checks:
  - **`version`.**
  - **`help-statements`:** every `PRIVACY_STATEMENT` and `TRUST_STATEMENT` sentence.
  - **`explain`:** exits 0.
  - **`flow`:** `keys init --name "Smoke Co"`, then `invite --role backend`, then a candidate run with `--invite <token> --yes --no-open --out <tmp>/out/candidate.aiprof` on the empty home, then `verify <bundle> --no-open --out <tmp>/out/dossier.html`. Each step exits 0.
  - **`signed-as-expected`:** for `release`, the banner reads `Signed v<version> (release key rel-2026a)`; for `trusted-env`, it reads `Signed by a key you trust`.
  - **`dossier-audit`:** `auditHtml` is clean.
  - **`hostile-folder`:** `verify` is run again from a folder holding a `.env` (`AIPROF_RELEASE_PUBKEYS=not-json` and `AIPROF_HOME=<tmp>/canary-home`) and the preload `bunfig.toml`. It gives the same exit code and banner as before, there is no `PRELOADED`, and there is no `<tmp>/canary-home`.
- **`release.yml`** is B's file with the `ai-profiler-…` assets in the smoke matrix, plus one line in the `release` job's build step:
```yaml
      - run: bun scripts/release.ts build --tag "$TAG"
        env:
          TAG: ${{ github.ref_name }}
          AIPROF_RELEASE_SIGNING_KEY: ${{ secrets.AIPROF_RELEASE_SIGNING_KEY }}
```
- **`releaseNotes`** holds:
  - B's parts, with A's `PRIVACY_STATEMENT`;
  - `TRUST_STATEMENT`;
  - the release key's id and display fingerprint;
  - the core pin: `v1.0.0` and the 40-hex SHA.

- [ ] **Step 1: Write the failing tests.**
  - **`cli.test.ts`** (Review Focus 1):
    - **No key:** release mode without the variable → exit 1, and `compile` is never called.
    - **Wrong key:** a test-time key checked against an injected shipped list that holds another key → exit 1. The output names both display fingerprints and never the seed, and `compile` is never called.
    - **Matching key:** an injected shipped list that holds the test key, and:
      - `compile` runs five times, each with the define equal to `JSON.stringify(value)`;
      - stdout and stderr lack the seed;
      - `d.env` no longer has the variable;
      - every `sign`, `onMain` and `gh` call got an env without it.
    - **Rehearsal:** with an env key present, the define holds a `rehearsal-` key, never the env one, and `dist/rehearsal-pubkeys.json` loads with `loadTrust`.
  - **`workflows.test.ts`:**
    - `lintWorkflows(".github/workflows", { secrets: ["AIPROF_RELEASE_SIGNING_KEY"], bin: "ai-profiler" })` is `[]`;
    - the secret occurs once, in the `release` job's build step;
    - B's negative fixtures are not repeated here; they live with the rules in B.
  - **`notes.test.ts`:** every sentence of both statements, the key id and display fingerprint, `CORE_PIN.sha`, and each asset's `attest` command with `refs/tags/v2.0.0`.
  - **`smoke.test.ts`** (timeout 180 s): `buildHost({ outDir, signingKey: <test-time key> })`, then `smokeBinary(…, { expect: "trusted-env", pubkeys })` → every check true.
  - **`compile.test.ts`** (Review Focus 2): the hostile-folder case on the binary built with a key; the build without a key still verifies as "DEV BUILD", exit 3.
  - **Version:** `"2.0.0"`. Format vectors keep their literal `2.0.0-dev` meta.
- [ ] **Step 2: Run** `bun test test/release test/repo test/compile.test.ts` → FAIL.
- [ ] **Step 3: Implement** everything above, and bump the version.
- [ ] **Step 4: Run** `bun test --update-snapshots`. Snapshot diffs may change only version strings. Then run `bun test && bunx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `ci(release): key-checked release builds, rehearsal with a throwaway key, workflow lint; v2.0.0`.

---

### Task 10: A — README, method, releasing and security docs; privacy sentence 7

**Files:**
- Create: `scripts/docs.ts`, `docs/method.md`, `docs/releasing.md`, `SECURITY.md`, `test/docs/{blocks,claims}.test.ts`
- Modify:
  - `README.md`, rewritten;
  - `src/copy.ts`: `PRIVACY_STATEMENT` gains sentence 7;
  - `test/docs.test.ts`: D1–D5 also cover `README.md` and `SECURITY.md`;
  - the spec's status line, as in B's Task 4;
  - the snapshots that render the privacy statement.

**`PRIVACY_STATEMENT[6]`** (exact): "If the recruiter runs verify --brief, their own agent CLI sends the scores, evidence counts and integrity checks from your file to their AI provider, but never names, labels, fingerprints or dates."

**Blocks** (A; `scripts/docs.ts` has B's interface, through the bridge):

| file | block | rendered from |
|---|---|---|
| README.md | `download`, `verify` | the kit, for `build-with-bala/ai-candidate-profiler`, `ai-profiler` and `v` + `VERSION` |
| README.md | `flags` | `helpText(<registry tool ids>)`, the lines before the statements, fenced |
| README.md | `privacy` | `PRIVACY_STATEMENT`, all seven sentences |
| README.md | `trust` | `TRUST_STATEMENT` |
| README.md | `timestamp` | `TSA_NOTICE`, filled in with the default authority from `src/trust/tsa.json` |
| README.md | `pairing` | `PAIRING_NOTICE` |
| README.md | `release-key` | each non-revoked `release-keys.json` entry: its id and `displayFingerprint` |
| README.md | `core` | `CORE_PIN` and `CORE_VERSION`, with a link to B at that SHA |
| docs/method.md | `fields` | `OPTIONAL_FIELDS`, plus the always-shipped payload keys of Plan 4's builder's call 4 |
| docs/method.md | `roles` | `src/roles/shipped.ts`: id, title and must-haves |
| docs/method.md | `brief` | `BRIEF_INSTRUCTIONS`, exactly what the recruiter's AI is told |
| docs/method.md | `caveats` | `CALIBRATE_CAVEATS` |
| docs/method.md | `keys` | every `release-keys.json` entry: id, fingerprint and revocation |

**Prose** (checked by `findOverclaims`):
- **README.md.** Sections in this order:
  1. **A pitch:** consented, tamper-evident evidence of how a person works with AI agents, plus a human interview.
  2. **The loop:** the spec §8.1 steps as a short list.
  3. **For candidates:** `download`, `verify`, running with an invite, the consent preview, `privacy`, `timestamp` and `pairing`.
  4. **For recruiters:** `flags`, then keys, invites, `verify`, which never renders candidate HTML, the dossier, `compare` with no default order, the kit, the pairing step, `--brief` with the recruiter's own AI, and `calibrate`.
  5. **Trust:** `trust`, then `release-key`. Verify with the latest release, because older binaries do not know about later revocations. Set `AIPROF_RELEASE_PUBKEYS` only yourself: release binaries never read it from a `.env` file.
  6. **v1 compatibility:** spec §8.7.
  7. **The method:** a link to `docs/method.md`, then `core`.
  8. **Build from source:** a build without the key verifies as DEV BUILD.
  9. **Security and releasing; license.**
- **docs/method.md:**
  - what A adds to B's method: the `aiprof/2` bundle, signing over JCS, invite binding, sealing, the RFC 3161 timestamp and what it sends;
  - integrity bands, and that the server-backed share is shown and never weighted;
  - role fit: meets, partial, below or insufficient;
  - the interview kit; the pairing file; the brief; calibration, which needs n ≥ 20;
  - the blocks above, and a link to B's method at the pinned SHA.
- **docs/releasing.md:** B's sections, plus **Release keys**:
  - **Where things live:** `rel-2026a` covers the v2 line. The public half is in `src/trust/release-keys.json`. The private half is only in the `release` secret `AIPROF_RELEASE_SIGNING_KEY` and in the owner's offline backup `~/.ai-profiler-release/rel-2026a.release-key.json`. The commands are `new`, `set-secret` and `check`.
  - **Planned rotation,** for a new major line:
    1. Make a new id with `new`.
    2. Add its entry to `release-keys.json`, and keep the old one, so that older bundles still verify.
    3. Run `set-secret`, which replaces the environment secret.
    4. Release. The build's key check proves that the secret and the shipped entry match.
    5. Keep the old backup until no supported line uses it.
  - **Compromise:**
    1. Set the old entry's `revoked` to `{ at, reason }`.
    2. Make a new key, as in a planned rotation, and ship a release.
    3. Bundles signed with the revoked key then fail `verify` as `revoked-key`, with the date and reason.
    4. Tell recruiters to update.
    5. Delete the old backup.
  - **Never** commit, print, paste, or pass the seed on a command line.
- **SECURITY.md:** B's sections, with supported version 2.x (v1 is unsupported), plus:
  - a summary of the release key, with a link to `docs/releasing.md`;
  - the honest limit from spec §3: an embedded key can be extracted.

- [ ] **Step 1: Write the failing tests.**
  - **`blocks.test.ts`:**
    - `staleBlocks(<A>)` is `[]`;
    - the `privacy` body has seven numbered sentences, and the seventh is exactly the sentence above;
    - the `release-key` body holds `rel-2026a` and its display fingerprint;
    - the `core` body holds `CORE_PIN.sha`.
  - **`claims.test.ts`:** B's rule, over A's `README.md`, `SECURITY.md`, `docs/method.md`, `docs/releasing.md` and `releaseNotes(ctx)`.
  - **Existing copy tests:**
    - Plan 4's tests that `--help`, the preview and the dossier's §6 hold every `PRIVACY_STATEMENT` sentence now include sentence 7;
    - `uncoveredChars` over it is `[]`;
    - every help line stays at most 100 columns.
  - **`docs.test.ts`:** D1–D5 pass on `README.md` and `SECURITY.md`.
- [ ] **Step 2: Run** `bun test` → FAIL.
- [ ] **Step 3: Write** the sentence, the tooling and the prose. Then run `bun scripts/docs.ts --write`.
- [ ] **Step 4: Run** `bun test --update-snapshots`. Diffs may only add sentence 7. Then run `bun test && bunx tsc --noEmit && bun scripts/docs.ts --check` → PASS.
- [ ] **Step 5: Commit** `docs: README, method, releasing (key rotation) and security docs; privacy sentence 7 for --brief`.

---

### Task 11: A — final visual QA of every dossier surface (controller gate)

**Files:** only fix-ups, in the files that own each issue.

- [ ] **Step 1: Write the QA set.** Use Plan 4 Task 20's `writeQaFiles` to write into `<scratch>/qa/A/in`:
  - every `DossierKind`, including the preview, the candidate copy, self-reported, dev build, flagged, and Plan 5b's timestamped, paired and briefed kinds;
  - the standalone pairing page;
  - `console-5` and `console-20`.
- [ ] **Step 2: Run** `bun scripts/visual-qa.ts --playwright <installed playwright package> --in <scratch>/qa/A/in --out <scratch>/qa/A/out`. It covers dark and light, 1440 px and 390 px, A4 print, and the console's sort, notes and CSV checks. Every check must PASS.
- [ ] **Step 3: Controller review** of every PNG and PDF. It applies Plan 4 Task 20's checklist and Plan 5b Task 16's checks of Ex.P, the brief and the TSA lines. It adds these:
  - `v2.0.0` appears in the certificate and in §6;
  - no `-dev` appears;
  - sentence 7 appears in the preview and in §6;
  - the release-build fixtures show their key id in §6;
  - no surface shows a ranking or a recommendation.
- [ ] **Step 4: Fix and repeat.** Each issue becomes a `fix(dossier): …` commit in its owning file, and the QA runs again until the controller approves.

---

### Task 12: A — PR, rehearsal on the PR head, whole-branch review, merge

**Files:** none new.

**Interfaces:** **Produces** `A_RELEASE_SHA`, the merge commit on A's `origin/main`, which Task 13 tags.

- [ ] **Step 1: Final checks.**
  - `bun test && bunx tsc --noEmit && bun scripts/docs.ts --check` → PASS.
  - `package.json`'s `corePin.sha` equals `B_RELEASE_SHA`.
  - Local acceptance: `bun scripts/profiler-smoke.ts` against the real HOME exits 0, with every line PASS. Keep only the pass/fail lines.
- [ ] **Step 2: Push and open the PR.**
```bash
# EtherHiding config scan → nothing printed
git fetch origin && git merge-base --is-ancestor origin/main feat/ship-v2   # exit 0, else BLOCKED
git push -u origin feat/ship-v2
gh pr create --base main --title "Ship v2.0.0: core v1.0.0 pin, release key, release workflow, docs" --body "<summary · key id and display fingerprint · pass/fail lines · visual QA approved by the controller · no figures from anyone's machine>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch
```
- [ ] **Step 3: Rehearse.** Follow Task 6 Steps 3–5 in this repo, with tag `v0.0.0-rehearsal.<n>` on `HEAD`.
  - Expected: all five `rehearsal-smoke` jobs PASS with `signed-as-expected` in `trusted-env` mode, and `release` is `skipped`.
  - The asset for the controller's own platform prints `2.0.0` for `--version`.
  - Then delete the tag and the artifact.
- [ ] **Step 4: Whole-branch review** by the controller. Any code change after the review means rehearsing again.
- [ ] **Step 5: Merge.**
```bash
gh pr merge --squash --delete-branch
git fetch origin
A_RELEASE_SHA=$(git rev-parse origin/main)
git rev-parse origin/main^{tree}   # must equal the rehearsed tree; if not, rehearse once more on origin/main
```

---

### Task 13: Joint launch — the tags, the owner's approval, the release runs

**Files:** none.

- [ ] **Step 1: Preconditions** (read-only).
  - Both PRs are merged, and the latest CI on each `main` is green.
  - A's `origin/main` `corePin.sha` equals `B_RELEASE_SHA`, and that commit is on B's `origin/main`.
  - `git ls-remote --tags origin v1.0.0` (in B) and `v2.0.0` (in A) print nothing.
  - `git ls-remote --tags origin 'v0.0.0-*'` prints nothing in either repo.
- [ ] **Step 2: B first.**
```bash
# EtherHiding config scan in <B> → nothing printed
git -C <B> tag -a v1.0.0 "$B_RELEASE_SHA" -m "AI Practice Report v1.0.0"
git -C <B> push origin refs/tags/v1.0.0
```
  Watch the run. `gh run view <id> --repo build-with-bala/ai-practice-report --json jobs` shows guard and test succeeded, and `release` as `waiting`. `gh api repos/build-with-bala/ai-practice-report/actions/runs/<id>/pending_deployments --jq '[.[].environment.name]'` → `["release"]`.
- [ ] **Step 3: Then A.**
```bash
# EtherHiding config scan in <A> → nothing printed
git -C <A> tag -a v2.0.0 "$A_RELEASE_SHA" -m "AI Candidate Profiler v2.0.0"
git -C <A> push origin refs/tags/v2.0.0
```
  Wait until A's `release` job is also `waiting`.

  **If guard or test fails on a tag:**
  1. Fix it through a PR.
  2. Delete the unreleased tag with `git push origin :refs/tags/<tag>`. The ruleset allows this for the admin, and no release exists yet.
  3. Push the tag again on the new merge commit.

  If B's commit changed, A goes back to Task 7 Step 1.
- [ ] **Step 4: The only human step: the owner's approval.** This wait is expected, and nothing else needs the owner. The controller sends the owner one message:

  > Both release runs passed their checks and are waiting for your approval in the protected `release` environment: `<B run URL>` and `<A run URL>`. On each page choose **Review deployments → release → Approve and deploy**. Nothing is published until you approve.

  Claude never approves on the owner's behalf. It never calls the pending-deployments approval API, and it never edits the environment.
- [ ] **Step 5: Watch the approved runs.** `gh run watch <id> --repo <R> --exit-status` → success for both.

  **If a run fails after approval:**
  - **Before publishing:** publish is the last step, and it checks the uploads first. So nothing public exists. Fix through a PR, then re-tag as in Step 3, or re-run the failed job with `gh run rerun <id> --failed` if no code changed. A re-run asks the owner to approve again; tell them.
  - **After publishing:** a published release is immutable. Fix it with a patch release, never by replacing assets.

---

### Task 14: Verify the published releases; clean up

**Files:** none.

- [ ] **Step 1: Release state.** For each repo and its tag, run `gh release view <tag> --repo <R> --json isDraft,isPrerelease,isImmutable,assets --jq '{isDraft, isPrerelease, isImmutable, assets: [.assets[].name] | sort}'`.
  - Expected: not a draft, not a prerelease, immutable, and exactly the five assets plus `SHA256SUMS`.
- [ ] **Step 2: Checksums and attestations.**
  - Run `gh release download <tag> --repo <R> -D <scratch>/verify/<repo>`, then `shasum -a 256 -c SHA256SUMS` → five OK.
  - For every asset, `verifyCommands(ctx, asset).attest`, exactly as the README prints it, exits 0.
- [ ] **Step 3: Downloaded binaries.** Smoke the asset for the controller's own platform with each repo's own smoke:
  - B: `bun scripts/release.ts smoke --tag v1.0.0 --asset <name> --dir <scratch>/verify/<repo>`;
  - A: the same with `--tag v2.0.0`, which expects `release`.

  Every line must PASS. A's run proves that the published binary's bundles verify against the shipped key.
- [ ] **Step 4: Links and tag targets.**
  - For every asset of both repos, `curl -sI https://github.com/build-with-bala/<repo>/releases/latest/download/<asset>` returns a redirect (`302`). v1's link names therefore keep working.
  - `git -C <B> rev-parse 'v1.0.0^{commit}'` equals A's `corePin.sha`.
- [ ] **Step 5: Clean up.**
  - Neither remote has a `v0.0.0-*` tag.
  - No `rehearsal-dist` artifact is left: list them through the API and delete any that remain.
  - Remove `<scratch>/verify` and `<scratch>/qa`.
  - Delete the merged local feature branches.
  - In A, `backup/feat-v2-pre-scrub` must not exist. Delete it locally if it does, and never push it.
- [ ] **Step 6: Final report** for the controller, with no figures:
  - the two release URLs;
  - the pass/fail lines;
  - the key id, its display fingerprint and the backup location;
  - one line saying that both runs were approved by the owner.
