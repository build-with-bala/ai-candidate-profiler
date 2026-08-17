# AI Candidate Profiler

Evidence-based profiling of how a developer *actually* works with AI coding
tools. The candidate runs one executable on their machine; it scans local
traces of **Claude Code, OpenAI Codex, Cursor, Google Antigravity, and GitHub
Copilot**, scores six competency axes, and writes a self-contained interactive
HTML dossier they send back to you.

No questionnaire, no self-reporting — the report is built from what the tools
themselves left on disk: sessions, prompts, tool calls, subagent delegations,
MCP/hooks/skills customization, models, streaks, and activity history.

## For the candidate

**macOS** — paste one line in Terminal (downloads the right binary and runs it;
no Gatekeeper prompt because curl downloads aren't quarantined):

```bash
A=$(uname -m); [ "$A" = x86_64 ] && A=x64; curl -fsSL -o ai-profiler "https://github.com/build-with-bala/ai-candidate-profiler/releases/latest/download/ai-profiler-macos-$A" && chmod +x ai-profiler && ./ai-profiler
```

**Windows** — download `ai-profiler-windows-x64.exe` from the
[latest release](https://github.com/build-with-bala/ai-candidate-profiler/releases/latest)
and double-click it.

**Linux**:

```bash
curl -fsSL -o ai-profiler "https://github.com/build-with-bala/ai-candidate-profiler/releases/latest/download/ai-profiler-linux-x64" && chmod +x ai-profiler && ./ai-profiler
```

Each writes `ai-profile-<name>-<date>.html` in the current folder and opens it
in your browser — that one file is what you send back. Add `--name "Your Name"`
to put your real name on the report. If you downloaded the macOS binary with a
browser instead of curl, first-run needs right-click → Open (unsigned binary),
or use the bundled `run-macos.command`. Verify downloads against `SHA256SUMS`
on the release page.

3. It writes `ai-profile-<name>-<date>.html` in the current folder and opens
   it. Review it, then send that one file back.

**Privacy:** the profiler reads *aggregates only* — counts, timestamps, model
and tool names, and prompt lengths. It never reads or transmits prompt text,
code, file contents, credentials, or API keys. The report is a static file
that makes no network requests. Add `--redact` to anonymize project names.

## Options

| Flag | Effect |
|------|--------|
| `--name "Full Name"` | Name on the report (default: OS username) |
| `--out path.html` | Output location |
| `--redact` | Anonymize project names and account identities |
| `--json` | Also write the raw metrics JSON |
| `--no-open` | Don't auto-open the browser |

## Scoring

Six axes, weighted into a 0–100 overall score with a verdict band and an
six role tags matched from a ~29-role catalog (Architect, Data Engineer, Platform Engineer, Product Owner, Orchestrator, QA, Security, Frontend/Backend/Full-Stack, Toolsmith, …) — each with a %-match, an icon, and evidence from the candidate's own traces; the top three are highlighted:

| Axis | Weight | Signal |
|------|--------|--------|
| Tool breadth | 10% | which tools are in active rotation |
| Power-user depth | 22% | MCP, hooks, skills, subagents, config customization |
| Consistency | 18% | active days, streaks, recency |
| Technical knowledge | 15% | languages edited via agents, shell/toolchain domains driven, technical concepts discussed |
| Agentic leverage | 22% | delegated agent work vs. chat-only usage, plus orchestration: workflows, scheduled agents, background tasks |
| Prompt craft | 13% | steering efficiency: how far agents run per brief (yield), interruption + correction rates, plan-mode/skill framing, structural depth, codified context |

Full methodology (paths scanned, limitations) is in the report's **Method**
tab. Local traces under-count cloud-side work and say nothing about output
quality — pair the dossier with a live pairing session before deciding.

## Build from source

```bash
./build.sh              # builds all 5 targets into dist/ (needs Bun ≥ 1.1)
bun src/main.ts         # or run directly without compiling
```

`src/template.html` is the report shell (embedded at compile time); fonts and
all assets are inlined, so the output HTML works offline.
