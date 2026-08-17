#!/usr/bin/env bun
// AI Candidate Profiler — scans local traces of Claude Code, OpenAI Codex,
// Cursor, Antigravity, and GitHub Copilot, then renders a self-contained
// interactive HTML dossier. Aggregates only; no prompt text leaves the machine.

import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { scanClaudeCode, scanCodex, scanCursor, scanCopilot, scanAntigravity, machineMeta, type ToolReport } from "./scan";
import { score } from "./scoring";
// @ts-ignore — embedded at compile time
import template from "./template.html" with { type: "text" };

const VERSION = "1.5.0";
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
};

if (flag("--help") || flag("-h")) {
  console.log(`
AI Candidate Profiler v${VERSION}
Profiles how this machine's owner actually works with AI coding tools
(Claude Code, OpenAI Codex, Cursor, Antigravity, GitHub Copilot) and
writes a self-contained interactive HTML report.

Usage:  ai-profiler [options]

Options:
  --name "Full Name"   Candidate name shown on the report (default: OS username)
  --out  path.html     Output file (default: ./ai-profile-<name>-<date>.html)
  --redact             Anonymize project names (Project 01, 02, …)
  --json               Also write the raw metrics JSON next to the report
  --no-open            Don't open the report in a browser
  -h, --help           This help

Privacy: only counts, dates, durations, and feature flags are collected.
No prompt text, code, file contents, or API keys are read or included.
`);
  process.exit(0);
}

const redact = flag("--redact");
const meta = machineMeta();
const candidate = opt("--name") || meta.user;

const log = (s: string) => console.error(s);
log(`\n▲ AI Candidate Profiler v${VERSION}`);
log(`  profiling: ${candidate}  (${meta.os}/${meta.arch})`);
log(`  scanning local traces…`);

const t0 = Date.now();
const tools: ToolReport[] = [];
tools.push(scanClaudeCode(log));
tools.push(scanCodex(log));
tools.push(await scanCursor(log));
tools.push(scanCopilot(log));
tools.push(await scanAntigravity(log));

if (redact) {
  for (const t of tools) {
    t.projects = t.projects.map((_, i) => `Project ${String(i + 1).padStart(2, "0")}`);
    if (t.raw?.signedInUser) t.raw.signedInUser = "(redacted)";
    if (t.raw?.authEmail) t.raw.authEmail = "(redacted)";
    t.metrics = t.metrics.map((m) => (m.label === "Signed in as" ? { ...m, value: "(redacted)" } : m));
  }
}

const scored = score(tools);

// merged daily activity per tool for the heatmap
const daily: Record<string, Record<string, number>> = {};
for (const t of tools)
  for (const [d, n] of Object.entries(t.daily)) {
    if (!daily[d]) daily[d] = {};
    if (n > 0) daily[d][t.id] = n;
  }

const payload = {
  meta: {
    candidate,
    machineUser: redact ? "(redacted)" : meta.user,
    hostname: redact ? "(redacted)" : meta.hostname,
    os: `${meta.os} ${meta.arch}`,
    scanDate: new Date().toISOString(),
    toolVersion: VERSION,
    redacted: redact,
    scanSeconds: 0, // patched below
  },
  tools: tools.map((t) => {
    const { promptLens, hourHist, ...raw } = t.raw || {};
    return {
      id: t.id,
      name: t.name,
      status: t.status,
      firstUsed: t.firstUsed || null,
      lastUsed: t.lastUsed || null,
      metrics: t.metrics,
      projects: t.projects.slice(0, 40),
      notes: t.notes,
      raw: { ...raw, ...(hourHist ? { hourHist } : {}) },
    };
  }),
  daily,
  ...scored,
};
payload.meta.scanSeconds = Math.round((Date.now() - t0) / 100) / 10;

// inject + write
const json = JSON.stringify(payload).replace(/<\//g, "<\\/");
const html = (template as string).replace('"__PROFILE_DATA__"', json);
const slug = candidate.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "candidate";
const stamp = new Date().toISOString().slice(0, 10);
const outPath = resolve(opt("--out") || join(process.cwd(), `ai-profile-${slug}-${stamp}.html`));
writeFileSync(outPath, html);
if (flag("--json")) writeFileSync(outPath.replace(/\.html?$/, "") + ".json", JSON.stringify(payload, null, 2));

// terminal summary
const bar = (n: number) => "█".repeat(Math.round(n / 5)).padEnd(20, "░");
log(`\n  ┌─ ${candidate} — ${(scored.personas || []).map((p: any) => p.name).join(" · ") || scored.archetype.name}`);
log(`  │  ${scored.verdict.band}  ·  overall ${scored.overall}/100`);
for (const a of scored.axes) log(`  │  ${a.label.padEnd(18)} ${bar(a.score)} ${String(a.score).padStart(3)}`);
log(`  └─ scanned in ${payload.meta.scanSeconds}s`);
log(`\n  report: ${outPath}\n`);

// open in browser
if (!flag("--no-open")) {
  try {
    const cmd =
      process.platform === "darwin"
        ? ["open", outPath]
        : process.platform === "win32"
          ? ["cmd", "/c", "start", "", outPath]
          : ["xdg-open", outPath];
    spawn(cmd[0], cmd.slice(1), { detached: true, stdio: "ignore" }).unref();
  } catch {
    /* report path already printed */
  }
}
