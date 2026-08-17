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

1. Download the executable for your OS from `dist/` (or the release page):
   - `ai-profiler-macos-arm64` (Apple Silicon) / `ai-profiler-macos-x64` (Intel)
   - `ai-profiler-windows-x64.exe`
   - `ai-profiler-linux-x64` / `ai-profiler-linux-arm64`
2. Run it.

   **macOS** — paste this one line in Terminal from the download folder (it
   picks Apple Silicon vs Intel, clears Gatekeeper's quarantine flag, and runs):

   ```bash
   A=$(uname -m); [ "$A" = x86_64 ] && A=x64; chmod +x ai-profiler-macos-$A; xattr -d com.apple.quarantine ai-profiler-macos-$A 2>/dev/null; ./ai-profiler-macos-$A
   ```

   (or `bash run-macos.command`, which does the same thing.)

   **Windows** — double-click `ai-profiler-windows-x64.exe`.

   **Linux**:

   ```bash
   chmod +x ai-profiler-linux-x64 && ./ai-profiler-linux-x64
   ```

   Add `--name "Your Name"` to any of these to put your real name on the report.

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
