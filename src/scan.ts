// scan.ts — local-trace scanners for the five AI coding tools.
// Aggregates only: counts, dates, lengths, feature flags. Never stores prompt text.

import { readdirSync, statSync, existsSync, readFileSync, copyFileSync, mkdtempSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir, tmpdir, userInfo, platform as osPlatform } from "node:os";

export type ToolStatus = "active" | "dormant" | "installed" | "not_found";

export interface Metric {
  label: string;
  value: string | number;
  hint?: string;
}

export interface ToolReport {
  id: string;
  name: string;
  status: ToolStatus;
  firstUsed?: string; // YYYY-MM-DD
  lastUsed?: string;
  daily: Record<string, number>; // user-initiated events per local day
  metrics: Metric[];
  projects: string[]; // basenames (redacted upstream if requested)
  raw: Record<string, any>; // scoring inputs
  notes: string[]; // caveats surfaced in the report
}

const HOME = homedir();
const PLAT = osPlatform(); // darwin | win32 | linux

// ---------- shared helpers ----------

function safeList(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
function safeStat(p: string) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}
function readJson(p: string): any {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}
function localDay(ts: number | string | Date): string | null {
  const d = typeof ts === "object" ? ts : new Date(ts);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  if (y < 2015 || y > 2100) return null;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function bump(map: Record<string, number>, key: string | null, n = 1) {
  if (!key) return;
  map[key] = (map[key] || 0) + n;
}
function dayRange(daily: Record<string, number>): { first?: string; last?: string } {
  const keys = Object.keys(daily).sort();
  return keys.length ? { first: keys[0], last: keys[keys.length - 1] } : {};
}
function statusFrom(lastUsed: string | undefined, hasData: boolean, installed: boolean): ToolStatus {
  if (!installed && !hasData) return "not_found";
  if (!hasData) return "installed";
  if (!lastUsed) return "installed";
  const ageDays = (Date.now() - new Date(lastUsed + "T12:00:00").getTime()) / 86400000;
  return ageDays <= 30 ? "active" : "dormant";
}
function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return Math.round(n / 1000) + "k";
  if (n >= 1_000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

// Iterate a JSONL file line by line. Skips unparseable lines. Caps very large files.
const MAX_JSONL_BYTES = 250 * 1024 * 1024;
function eachJsonl(path: string, cb: (obj: any) => void): boolean {
  const st = safeStat(path);
  if (!st || st.size > MAX_JSONL_BYTES) return false;
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return false;
  }
  let start = 0;
  while (start < text.length) {
    let end = text.indexOf("\n", start);
    if (end === -1) end = text.length;
    const line = text.slice(start, end);
    start = end + 1;
    if (line.length < 2) continue;
    try {
      cb(JSON.parse(line));
    } catch {
      /* skip malformed line */
    }
  }
  return true;
}

// Open a copy of a VS Code-style state.vscdb (SQLite ItemTable) read-only.
// Copy first: the live app may hold a lock.
let sqliteMod: any = null;
async function openStateDb(path: string): Promise<Map<string, string> | null> {
  if (!existsSync(path)) return null;
  try {
    if (!sqliteMod) sqliteMod = await import("bun:sqlite");
    const tmp = join(mkdtempSync(join(tmpdir(), "aiprof-")), "state.vscdb");
    copyFileSync(path, tmp);
    const db = new sqliteMod.Database(tmp, { readonly: true });
    const rows = db.query("SELECT key, value FROM ItemTable").all() as { key: string; value: string }[];
    db.close();
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.key, r.value);
    return map;
  } catch {
    return null;
  }
}

// Per-prompt "depth" features — structural markers of a well-briefed prompt,
// computed in-memory at scan time; only aggregate counts are persisted.
export interface DepthStats {
  n: number; // prompts evaluated (every turn: openers, follow-ups, scripted sessions)
  d0: number; // shallow: bare command, no context
  d1: number; // directive: one signal (a path, some length)
  d2: number; // structured: two signals
  d3: number; // rich spec: three or more signals
  churn: number; // terse negative turns ("no", "wrong", "again")
  withContext: number; // prompts that included code/error/pasted context
  sumScore: number;
}
export function newDepth(): DepthStats {
  return { n: 0, d0: 0, d1: 0, d2: 0, d3: 0, churn: 0, withContext: 0, sumScore: 0 };
}
const RE_FILE = /[\w.-]+\.(ts|tsx|js|jsx|mjs|py|go|rs|java|rb|php|cs|c|cpp|h|css|scss|html|json|ya?ml|toml|md|sql|sh|env|swift|kt|vue|svelte)\b/i;
const RE_PATH = /(^|\s)[~.]?\/[\w@./-]{3,}|\b[\w.-]+\/[\w.-]+\/[\w./-]+/;
const RE_LIST = /^\s*([-*•]|\d+[.)])\s/;
const RE_CONSTRAINT = /\b(must|should|don'?t|do not|avoid|ensure|verify|make sure|instead|because|so that|expected|constraint|require[sd]?|keep|only|never|always)\b/gi;
const RE_CONTEXT = /```|\bTraceback\b|\b\w*Error:|\bException\b|\bstack trace\b|^\s+at\s+\w/m;
const RE_CHURN = /\b(no|nope|wrong|not|again|still|broken|revert|undo|stop|bad|nvm)\b/i;
// Score any prompt on its structural depth; terse negative turns also feed churn.
export function addPromptDepth(ds: DepthStats, text: string, hasPaste = false) {
  const t = String(text);
  if (!t.trim()) return;
  const words = t.trim().split(/\s+/).length;
  let score = 0;
  if (RE_CONTEXT.test(t) || hasPaste) {
    score++;
    ds.withContext++;
  }
  if (RE_FILE.test(t) || RE_PATH.test(t)) score++;
  const lines = t.split("\n");
  if (lines.length >= 4 || lines.filter((l) => RE_LIST.test(l)).length >= 2) score++;
  if ((t.match(RE_CONSTRAINT) || []).length >= 2) score++;
  if (words >= 40) score++;
  if (words <= 4 && RE_CHURN.test(t)) ds.churn++;
  ds.n++;
  ds.sumScore += Math.min(score, 4);
  if (score === 0) ds.d0++;
  else if (score === 1) ds.d1++;
  else if (score === 2) ds.d2++;
  else ds.d3++;
}

// ---------- technical-knowledge signals ----------

// Technical concepts a developer discusses with an AI — matched with word
// boundaries against prompt text; only the matched term names are kept.
const TECH_TERMS = [
  "database","migration","webhook","websocket","docker","kubernetes","container","redis","postgres","mysql","mongodb","sqlite",
  "queue","celery","cron","cache","caching","index","transaction","deadlock","race condition","mutex","thread","async","await",
  "oauth","jwt","token","authentication","authorization","encryption","hash","ssl","tls","dns","nginx","proxy","load balancer",
  "pipeline","deploy","deployment","rollback","rebase","merge conflict","regression","unit test","integration test","e2e","mock",
  "refactor","memory leak","latency","throughput","pagination","rate limit","cors","csrf","xss","sql injection","orm","schema",
  "endpoint","microservice","monolith","event loop","closure","recursion","algorithm","regex","compiler","linter","typescript",
  "kafka","grpc","graphql","rest api","s3","lambda","terraform","serverless","embedding","vector","llm","prompt injection",
  "middleware","dependency","environment variable","secret","api key","firewall","port","subnet","vpn","backup","snapshot",
];
const RE_TECH = new RegExp("\\b(" + TECH_TERMS.join("|").replace(/ /g, "\\s+") + ")\\b", "gi");
export function collectTech(text: string, into: Set<string>) {
  const m = String(text).match(RE_TECH);
  if (m) for (const t of m) into.add(t.toLowerCase().replace(/\s+/g, " "));
}

// Shell-command domains — breadth of the toolchain someone actually drives.
const CMD_DOMAINS: [string, RegExp][] = [
  ["git", /\bgit\b/],
  ["containers", /\b(docker|podman|kubectl|helm|docker-compose|colima)\b/],
  ["databases", /\b(psql|mysql|mongosh?|redis-cli|sqlite3|createdb|pg_dump|mongodump)\b/],
  ["cloud/iac", /\b(aws|gcloud|az|terraform|ansible|heroku|flyctl|vercel|netlify|coolify)\b/],
  ["networking", /\b(curl|wget|ssh|scp|rsync|dig|nslookup|traceroute|netstat|lsof|iptables|ufw|tailscale)\b/],
  ["packages", /\b(npm|pnpm|yarn|bun|pip3?|poetry|uv|cargo|gem|composer|brew|apt(-get)?)\b/],
  ["build", /\b(make|cmake|gradle|mvn|tsc|vite|webpack|esbuild|xcodebuild|cap sync)\b/],
  ["testing", /\b(pytest|jest|vitest|playwright|cypress|phpunit|rspec|go test|tox)\b/],
  ["system", /\b(systemctl|journalctl|crontab|chmod|chown|htop|launchctl|pm2)\b/],
  ["scripting", /\b(python3?|node|deno|ruby|osascript)\b/],
];
export function classifyCommand(cmd: string, domains: Record<string, number>) {
  for (const [name, re] of CMD_DOMAINS) if (re.test(cmd)) bump(domains, name);
}
const RE_EXT = /\.([a-z0-9]{1,7})$/i;
export function extOf(path: string): string | null {
  const m = String(path).match(RE_EXT);
  return m ? m[1].toLowerCase() : null;
}

// Yield/steering aggregates for craft v2: how far the agent runs per human turn.
export function summarizeYields(yields: number[], firsts: number[]) {
  if (!yields.length) return null;
  const s = [...yields].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  const fs = [...firsts].sort((a, b) => a - b);
  return {
    n: yields.length,
    median: q(0.5),
    p75: q(0.75),
    p90: q(0.9),
    highShare: yields.filter((y) => y >= 10).length / yields.length,
    firstMedian: fs.length ? fs[Math.floor(fs.length / 2)] : 0,
  };
}

function promptLenBuckets(lens: number[]) {
  const b = { tiny: 0, short: 0, solid: 0, detailed: 0 };
  for (const l of lens) {
    if (l < 30) b.tiny++;
    else if (l < 100) b.short++;
    else if (l < 400) b.solid++;
    else b.detailed++;
  }
  return b;
}
function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// ---------- Claude Code ----------

export function scanClaudeCode(log: (s: string) => void): ToolReport {
  const root = join(HOME, ".claude");
  const rep: ToolReport = {
    id: "claudeCode",
    name: "Claude Code",
    status: "not_found",
    daily: {},
    metrics: [],
    projects: [],
    raw: {},
    notes: [],
  };
  const installed = existsSync(root);
  const projectsDir = join(root, "projects");
  const projectSlugs = safeList(projectsDir).filter((d) => !d.startsWith("."));

  let userPrompts = 0;
  let assistantMsgs = 0;
  let toolCalls = 0;
  let sessions = 0;
  let sidechainSessions = 0;
  let outputTokens = 0;
  let thinkingMsgs = 0;
  const models: Record<string, number> = {};
  const toolCounts: Record<string, number> = {};
  const mcpTools = new Set<string>();
  const promptLens: number[] = [];
  const hourHist: number[] = new Array(24).fill(0);
  const sessionDepths: number[] = [];
  const versions = new Set<string>();
  const editedExts: Record<string, number> = {};
  const cmdDomains: Record<string, number> = {};
  const yields: number[] = [];
  const firstYields: number[] = [];
  let interrupts = 0;

  let filesScanned = 0;
  const FILE_CAP = 4000;
  outer: for (const slug of projectSlugs) {
    const dir = join(projectsDir, slug);
    const files = safeList(dir).filter((f) => f.endsWith(".jsonl"));
    for (const f of files) {
      if (filesScanned >= FILE_CAP) {
        rep.notes.push(`Transcript cap reached (${FILE_CAP} sessions) — oldest sessions beyond cap skipped.`);
        break outer;
      }
      filesScanned++;
      let sesUser = 0;
      let sesTools = 0;
      let sawContent = false;
      let sawSidechain = false;
      let curYield = 0;
      let promptSeen = false;
      const yieldsBefore = yields.length;
      eachJsonl(join(dir, f), (o) => {
        if (o.isSidechain) sawSidechain = true;
        if (o.type === "user" && o.message && !o.isSidechain) {
          const m = o.message;
          // tool results echo back as user messages (and carry promptId too) —
          // only text the human actually typed counts as a prompt
          const hasToolResult =
            Array.isArray(m.content) && m.content.some((c: any) => c && c.type === "tool_result");
          const cstr =
            typeof m.content === "string"
              ? m.content
              : Array.isArray(m.content)
                ? m.content.filter((c: any) => c?.type === "text").map((c: any) => c.text || "").join("")
                : "";
          if (cstr.startsWith("[Request interrupted")) {
            interrupts++;
            return;
          }
          const isPrompt = !hasToolResult && cstr.length > 0 && !cstr.startsWith("<") && !cstr.startsWith("[");
          if (isPrompt) {
            userPrompts++;
            sesUser++;
            sawContent = true;
            const day = localDay(o.timestamp);
            bump(rep.daily, day);
            const d = new Date(o.timestamp);
            if (!isNaN(d.getTime())) hourHist[d.getHours()]++;
            // how far did the agent run on the previous brief?
            if (promptSeen) yields.push(curYield);
            curYield = 0;
            promptSeen = true;
            // prompt text stats come from history.jsonl (the canonical typed-prompt
            // log) to avoid double-counting the same prompts here
          }
        } else if (o.type === "assistant" && o.message) {
          assistantMsgs++;
          sawContent = true;
          const m = o.message;
          if (m.model && m.model !== "<synthetic>") bump(models, m.model);
          if (m.usage?.output_tokens) outputTokens += m.usage.output_tokens;
          if (o.version) versions.add(o.version);
          if (Array.isArray(m.content)) {
            for (const c of m.content) {
              if (c?.type === "tool_use" && c.name) {
                toolCalls++;
                if (!o.isSidechain) sesTools++;
                bump(toolCounts, c.name);
                // a Workflow launch fans out to agents whose actions aren't in this
                // transcript — weight it as a long run
                curYield += c.name === "Workflow" ? 10 : 1;
                if (String(c.name).startsWith("mcp__")) mcpTools.add(String(c.name).split("__")[1] || c.name);
                const inp = c.input || {};
                if ((c.name === "Edit" || c.name === "Write" || c.name === "MultiEdit") && inp.file_path) {
                  const e = extOf(inp.file_path);
                  if (e) bump(editedExts, e);
                } else if (c.name === "NotebookEdit" && inp.notebook_path) {
                  bump(editedExts, "ipynb");
                } else if (c.name === "Bash" && typeof inp.command === "string") {
                  classifyCommand(inp.command, cmdDomains);
                }
              } else if (c?.type === "thinking") thinkingMsgs++;
            }
          }
        }
      });
      if (promptSeen) {
        yields.push(curYield);
        firstYields.push(yields[yieldsBefore]);
      }
      if (sawContent) sessions++;
      if (sawSidechain) sidechainSessions++;
      if (sesUser > 0) sessionDepths.push(sesTools / sesUser);
    }
  }
  log(`  claude-code: ${filesScanned} transcripts, ${userPrompts} prompts`);

  // history.jsonl — long-lived prompt log; use for first-use + depth/length stats + daily merge
  const histDaily: Record<string, number> = {};
  const depth = newDepth();
  const techTerms = new Set<string>();
  eachJsonl(join(root, "history.jsonl"), (o) => {
    if (o.timestamp) bump(histDaily, localDay(o.timestamp));
    if (typeof o.display === "string" && o.display.length) {
      promptLens.push(o.display.length);
      const hasPaste = !!o.pastedContents && Object.keys(o.pastedContents).length > 0;
      addPromptDepth(depth, o.display, hasPaste);
      collectTech(o.display, techTerms);
    }
  });
  for (const [d, n] of Object.entries(histDaily)) rep.daily[d] = Math.max(rep.daily[d] || 0, n);

  // config depth
  const cfg = readJson(join(HOME, ".claude.json")) || {};
  const settings = readJson(join(root, "settings.json")) || {};
  const mcpServers = new Set<string>(Object.keys(cfg.mcpServers || {}));
  const cfgProjects = cfg.projects || {};
  for (const p of Object.values<any>(cfgProjects)) for (const s of Object.keys(p?.mcpServers || {})) mcpServers.add(s);
  const hooks = Object.keys(settings.hooks || {});
  const skills = safeList(join(root, "skills")).filter((s) => !s.startsWith(".")).length;
  const commands = safeList(join(root, "commands")).filter((s) => s.endsWith(".md")).length;
  const plugins = safeList(join(root, "plugins", "cache")).filter((s) => !s.startsWith(".")).length;
  const agents = safeList(join(root, "agents")).filter((s) => s.endsWith(".md")).length;

  const { first, last } = dayRange(rep.daily);
  rep.firstUsed = cfg.firstStartTime ? localDay(cfg.firstStartTime) || first : first;
  rep.lastUsed = last;
  const hasData = userPrompts > 0 || Object.keys(rep.daily).length > 0;
  rep.status = statusFrom(last, hasData, installed);
  rep.projects = projectSlugs.map((s) => s.split("-").filter(Boolean).pop() || s);

  const lateNight = hourHist.slice(0, 6).reduce((a, b) => a + b, 0);
  const totalHr = hourHist.reduce((a, b) => a + b, 0) || 1;
  const delegations = (toolCounts["Task"] || 0) + (toolCounts["Agent"] || 0);

  rep.raw = {
    userPrompts,
    assistantMsgs,
    toolCalls,
    sessions,
    sidechainSessions,
    delegations,
    outputTokens,
    models,
    toolCounts,
    mcpToolsUsed: [...mcpTools],
    mcpServersConfigured: [...mcpServers],
    hooks,
    skills,
    commands,
    plugins,
    agents,
    numStartups: cfg.numStartups || 0,
    hasUsedBackgroundTask: !!cfg.hasUsedBackgroundTask,
    depth,
    editedExts,
    cmdDomains,
    techTerms: [...techTerms],
    yieldStats: summarizeYields(yields, firstYields),
    interrupts,
    promptLens,
    promptBuckets: promptLenBuckets(promptLens),
    medianPromptLen: median(promptLens),
    avgToolsPerPrompt: sessionDepths.length ? sessionDepths.reduce((a, b) => a + b, 0) / sessionDepths.length : 0,
    projectCount: projectSlugs.length,
    lateNightShare: lateNight / totalHr,
    hourHist,
    versions: [...versions].slice(-3),
  };

  if (hasData) {
    rep.metrics = [
      { label: "Sessions", value: fmt(sessions), hint: "transcript files with content" },
      { label: "Prompts", value: fmt(userPrompts), hint: "user messages sent" },
      { label: "Tool calls", value: fmt(toolCalls), hint: "file edits, shell, search…" },
      { label: "Subagent runs", value: fmt(delegations + sidechainSessions), hint: "delegated side-tasks" },
      { label: "Output tokens", value: fmt(outputTokens), hint: "generated by the model" },
      { label: "Projects", value: projectSlugs.length },
      { label: "MCP servers", value: mcpServers.size, hint: "configured integrations" },
      { label: "Custom skills", value: skills, hint: "+" + commands + " commands, " + hooks.length + " hooks" },
    ];
  }
  return rep;
}

// ---------- OpenAI Codex ----------

export function scanCodex(log: (s: string) => void): ToolReport {
  const root = join(HOME, ".codex");
  const rep: ToolReport = {
    id: "codex",
    name: "OpenAI Codex",
    status: "not_found",
    daily: {},
    metrics: [],
    projects: [],
    raw: {},
    notes: [],
  };
  const installed = existsSync(root);

  let sessions = 0;
  let userMsgs = 0;
  let toolCalls = 0;
  const originators = new Set<string>();
  const models: Record<string, number> = {};
  const projects = new Set<string>();
  const promptLens: number[] = [];
  const depth = newDepth();
  const techTerms = new Set<string>();
  const cmdDomains: Record<string, number> = {};
  const yields: number[] = [];
  const firstYields: number[] = [];
  let interrupts = 0;
  let gitSessions = 0;

  // sessions/YYYY/MM/DD/rollout-*.jsonl
  const sessRoot = join(root, "sessions");
  const files: string[] = [];
  for (const y of safeList(sessRoot))
    for (const m of safeList(join(sessRoot, y)))
      for (const d of safeList(join(sessRoot, y, m)))
        for (const f of safeList(join(sessRoot, y, m, d)))
          if (f.endsWith(".jsonl")) files.push(join(sessRoot, y, m, d, f));
  const FILE_CAP = 3000;
  if (files.length > FILE_CAP) rep.notes.push(`Session cap reached (${FILE_CAP}) — oldest skipped.`);

  for (const fp of files.slice(-FILE_CAP)) {
    sessions++;
    let sesHasUser = false;
    let curYield = 0;
    let promptSeen = false;
    const yieldsBefore = yields.length;
    eachJsonl(fp, (o) => {
      const p = o.payload || {};
      if (o.type === "session_meta") {
        if (p.originator) originators.add(p.originator);
        if (p.cwd) projects.add(basename(p.cwd));
        if (p.git) gitSessions++;
      } else if (o.type === "turn_context" && p.model) {
        bump(models, p.model);
      } else if (o.type === "event_msg" && p.type === "turn_aborted") {
        interrupts++;
      } else if (o.type === "response_item") {
        if (p.type === "message" && p.role === "user") {
          const text = Array.isArray(p.content)
            ? p.content.map((c: any) => c?.text || "").join("")
            : "";
          if (text && !text.startsWith("<environment_context") && !text.startsWith("<user_instructions")) {
            userMsgs++;
            sesHasUser = true;
            bump(rep.daily, localDay(o.timestamp));
            promptLens.push(text.length);
            addPromptDepth(depth, text);
            collectTech(text, techTerms);
            if (promptSeen) yields.push(curYield);
            curYield = 0;
            promptSeen = true;
          }
        } else if (p.type === "function_call" || p.type === "local_shell_call" || p.type === "custom_tool_call") {
          toolCalls++;
          curYield++;
          try {
            let cmd = "";
            if (p.type === "local_shell_call" && Array.isArray(p.action?.command)) cmd = p.action.command.join(" ");
            else if (typeof p.arguments === "string" && p.arguments.includes("command")) {
              const a = JSON.parse(p.arguments);
              cmd = Array.isArray(a.command) ? a.command.join(" ") : String(a.command || "");
            }
            if (cmd) classifyCommand(cmd, cmdDomains);
          } catch {}
        }
      }
    });
    if (promptSeen) {
      yields.push(curYield);
      firstYields.push(yields[yieldsBefore]);
    }
    if (!sesHasUser) {
      // still count the session day from filename: rollout-2026-07-23T14-40-20-...
      const m = basename(fp).match(/rollout-(\d{4}-\d{2}-\d{2})T/);
      if (m) bump(rep.daily, m[1], 0);
    }
  }
  log(`  codex: ${sessions} rollouts, ${userMsgs} prompts`);

  // history.jsonl (ts in seconds)
  const histDaily: Record<string, number> = {};
  eachJsonl(join(root, "history.jsonl"), (o) => {
    if (o.ts) bump(histDaily, localDay(o.ts * 1000));
  });
  for (const [d, n] of Object.entries(histDaily)) rep.daily[d] = Math.max(rep.daily[d] || 0, n);

  // config depth
  let configLines = 0;
  let mcpBlocks = 0;
  let profiles = 0;
  try {
    const toml = readFileSync(join(root, "config.toml"), "utf8");
    configLines = toml.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#")).length;
    mcpBlocks = (toml.match(/\[mcp_servers\./g) || []).length;
    profiles = (toml.match(/\[profiles\./g) || []).length;
  } catch {}

  const { first, last } = dayRange(rep.daily);
  rep.firstUsed = first;
  rep.lastUsed = last;
  const hasData = sessions > 0 || Object.keys(rep.daily).length > 0;
  rep.status = statusFrom(last, hasData, installed);
  rep.projects = [...projects];

  rep.raw = {
    sessions,
    userMsgs,
    toolCalls,
    originators: [...originators],
    models,
    configLines,
    mcpBlocks,
    profiles,
    gitSessions,
    depth,
    cmdDomains,
    techTerms: [...techTerms],
    yieldStats: summarizeYields(yields, firstYields),
    interrupts,
    promptLens,
    promptBuckets: promptLenBuckets(promptLens),
    medianPromptLen: median(promptLens),
    projectCount: projects.size,
  };
  if (hasData) {
    rep.metrics = [
      { label: "Sessions", value: fmt(sessions), hint: "agent rollouts" },
      { label: "Prompts", value: fmt(userMsgs) },
      { label: "Tool calls", value: fmt(toolCalls), hint: "shell + function calls" },
      { label: "Surfaces", value: [...originators].join(", ") || "—", hint: "CLI / IDE / cloud" },
      { label: "Projects", value: projects.size },
      { label: "MCP servers", value: mcpBlocks },
      { label: "In-repo work", value: sessions ? Math.round((100 * gitSessions) / sessions) + "%" : "—", hint: "sessions inside a git repo" },
    ];
  }
  return rep;
}

// ---------- Cursor ----------

function vscodeUserDir(appName: string): string {
  if (PLAT === "darwin") return join(HOME, "Library", "Application Support", appName, "User");
  if (PLAT === "win32") return join(process.env.APPDATA || join(HOME, "AppData", "Roaming"), appName, "User");
  return join(process.env.XDG_CONFIG_HOME || join(HOME, ".config"), appName, "User");
}

export async function scanCursor(log: (s: string) => void): Promise<ToolReport> {
  const userDir = vscodeUserDir("Cursor");
  const rep: ToolReport = {
    id: "cursor",
    name: "Cursor",
    status: "not_found",
    daily: {},
    metrics: [],
    projects: [],
    raw: {},
    notes: [],
  };
  const installed = existsSync(userDir) || existsSync(join(HOME, ".cursor"));

  let prompts = 0;
  let generations = 0;
  let composers = 0;
  let chatTabs = 0;
  let chatBubbles = 0;
  const promptLens: number[] = [];
  const depth = newDepth();
  const cursorTech = new Set<string>();
  const projects = new Set<string>();

  const g = await openStateDb(join(userDir, "globalStorage", "state.vscdb"));
  if (g) {
    try {
      const p = JSON.parse(g.get("aiService.prompts") || "[]");
      if (Array.isArray(p)) {
        prompts = p.length;
        for (const it of p)
          if (typeof it?.text === "string") {
            promptLens.push(it.text.length);
            addPromptDepth(depth, it.text);
            collectTech(it.text, cursorTech);
          }
      }
    } catch {}
    try {
      const gen = JSON.parse(g.get("aiService.generations") || "[]");
      if (Array.isArray(gen)) {
        generations = gen.length;
        for (const it of gen) if (it?.unixMs) bump(rep.daily, localDay(it.unixMs));
      }
    } catch {}
    try {
      const comp = JSON.parse(g.get("composer.composerData") || "{}");
      const all = comp?.allComposers;
      if (Array.isArray(all)) {
        composers = all.length;
        for (const c of all) if (c?.createdAt) bump(rep.daily, localDay(c.createdAt));
      }
    } catch {}
  }

  // per-workspace chat data
  const wsRoot = join(userDir, "workspaceStorage");
  const wsDirs = safeList(wsRoot).slice(0, 300);
  for (const ws of wsDirs) {
    const db = await openStateDb(join(wsRoot, ws, "state.vscdb"));
    if (!db) continue;
    let wsHasAI = false;
    try {
      const chat = JSON.parse(db.get("workbench.panel.aichat.view.aichat.chatdata") || "{}");
      if (Array.isArray(chat?.tabs)) {
        chatTabs += chat.tabs.length;
        for (const t of chat.tabs) {
          if (Array.isArray(t?.bubbles)) chatBubbles += t.bubbles.length;
          if (t?.lastSendTime) bump(rep.daily, localDay(t.lastSendTime));
          wsHasAI = true;
        }
      }
    } catch {}
    try {
      const comp = JSON.parse(db.get("composer.composerData") || "{}");
      if (Array.isArray(comp?.allComposers) && comp.allComposers.length) {
        composers += comp.allComposers.length;
        for (const c of comp.allComposers) if (c?.createdAt) bump(rep.daily, localDay(c.createdAt));
        wsHasAI = true;
      }
    } catch {}
    if (wsHasAI) {
      const meta = readJson(join(wsRoot, ws, "workspace.json"));
      const folder = meta?.folder || "";
      if (folder) projects.add(basename(decodeURIComponent(String(folder))));
    }
  }
  log(`  cursor: ${prompts} prompts, ${composers} composer sessions`);

  const { first, last } = dayRange(rep.daily);
  rep.firstUsed = first;
  rep.lastUsed = last;
  const hasData = prompts > 0 || composers > 0 || chatTabs > 0 || generations > 0;
  rep.status = statusFrom(last, hasData, installed);
  rep.projects = [...projects];
  if (hasData && Object.keys(rep.daily).length === 0)
    rep.notes.push("Cursor stores few timestamps locally — activity dates are approximate or missing.");

  rep.raw = {
    prompts,
    generations,
    composers,
    chatTabs,
    chatBubbles,
    depth,
    techTerms: [...cursorTech],
    promptLens,
    promptBuckets: promptLenBuckets(promptLens),
    medianPromptLen: median(promptLens),
    projectCount: projects.size,
  };
  if (hasData) {
    rep.metrics = [
      { label: "Prompts", value: fmt(prompts), hint: "chat + inline (Cmd-K)" },
      { label: "Generations", value: fmt(generations), hint: "completions accepted flow" },
      { label: "Agent sessions", value: fmt(composers), hint: "Composer / agent mode" },
      { label: "Chat tabs", value: fmt(chatTabs) },
      { label: "Projects", value: projects.size },
    ];
  }
  return rep;
}

// ---------- GitHub Copilot ----------

export function scanCopilot(log: (s: string) => void): ToolReport {
  const rep: ToolReport = {
    id: "copilot",
    name: "GitHub Copilot",
    status: "not_found",
    daily: {},
    metrics: [],
    projects: [],
    raw: {},
    notes: [],
  };

  const variants = [
    { app: "Code", ext: ".vscode" },
    { app: "Code - Insiders", ext: ".vscode-insiders" },
    { app: "VSCodium", ext: ".vscode-oss" },
  ];

  let chatSessions = 0;
  let chatRequests = 0;
  let editingSessions = 0;
  const modelIds = new Set<string>();
  const agentIds = new Set<string>();
  let extVersion = "";
  let signedInUser = "";

  for (const v of variants) {
    const userDir = vscodeUserDir(v.app);
    const wsRoot = join(userDir, "workspaceStorage");
    for (const ws of safeList(wsRoot).slice(0, 400)) {
      const csDir = join(wsRoot, ws, "chatSessions");
      for (const f of safeList(csDir).filter((f) => f.endsWith(".json"))) {
        const s = readJson(join(csDir, f));
        if (!s) continue;
        const reqs = Array.isArray(s.requests) ? s.requests : [];
        if (!reqs.length && !s.lastMessageDate) continue;
        chatSessions++;
        chatRequests += reqs.length;
        const fallbackDay = localDay(s.lastMessageDate || s.creationDate);
        for (const r of reqs) {
          const day = localDay(r?.timestamp) || fallbackDay;
          bump(rep.daily, day);
          if (r?.modelId) modelIds.add(String(r.modelId));
          if (r?.agent?.id) agentIds.add(String(r.agent.id));
        }
        if (!reqs.length && fallbackDay) bump(rep.daily, fallbackDay, 0);
      }
      const editDir = join(wsRoot, ws, "chatEditingSessions");
      const edits = safeList(editDir).length;
      if (edits) editingSessions += edits;
    }
    // extension install
    const extRoot = join(HOME, v.ext, "extensions");
    for (const e of safeList(extRoot)) {
      const m = e.match(/^github\.copilot(-chat)?-(\d[\d.]*)/);
      if (m) extVersion = m[2];
    }
  }

  // auth (hosts/apps.json)
  const ghDir =
    PLAT === "win32"
      ? join(process.env.LOCALAPPDATA || join(HOME, "AppData", "Local"), "github-copilot")
      : join(process.env.XDG_CONFIG_HOME || join(HOME, ".config"), "github-copilot");
  for (const f of ["apps.json", "hosts.json"]) {
    const j = readJson(join(ghDir, f));
    if (j && typeof j === "object")
      for (const v of Object.values<any>(j)) if (v?.user) signedInUser = String(v.user);
  }

  log(`  copilot: ${chatSessions} chat sessions, ${chatRequests} requests`);

  const { first, last } = dayRange(rep.daily);
  rep.firstUsed = first;
  rep.lastUsed = last;
  const installed = !!extVersion || !!signedInUser;
  const hasData = chatRequests > 0 || chatSessions > 0;
  rep.status = statusFrom(last, hasData, installed);
  rep.notes.push("Inline tab-completions are not persisted locally — completion volume is not measurable offline.");

  rep.raw = {
    chatSessions,
    chatRequests,
    editingSessions,
    modelIds: [...modelIds],
    agentIds: [...agentIds],
    extVersion,
    signedInUser,
  };
  if (hasData || installed) {
    rep.metrics = [
      { label: "Chat sessions", value: fmt(chatSessions) },
      { label: "Chat requests", value: fmt(chatRequests) },
      { label: "Agent-edit sessions", value: fmt(editingSessions), hint: "Copilot Edits / agent mode" },
      { label: "Models used", value: modelIds.size || "—" },
      { label: "Signed in as", value: signedInUser || "—" },
      { label: "Extension", value: extVersion ? "v" + extVersion : hasData ? "built-in / bundled" : "not installed" },
    ];
  }
  return rep;
}

// ---------- Google Antigravity ----------

export async function scanAntigravity(log: (s: string) => void): Promise<ToolReport> {
  const base =
    PLAT === "darwin"
      ? join(HOME, "Library", "Application Support", "Antigravity")
      : PLAT === "win32"
        ? join(process.env.APPDATA || join(HOME, "AppData", "Roaming"), "Antigravity")
        : join(process.env.XDG_CONFIG_HOME || join(HOME, ".config"), "Antigravity");
  const userDir = join(base, "User");
  const rep: ToolReport = {
    id: "antigravity",
    name: "Antigravity",
    status: "not_found",
    daily: {},
    metrics: [],
    projects: [],
    raw: {},
    notes: [],
  };
  const installed = existsSync(base) || existsSync(join(HOME, ".antigravity"));

  const convIds = new Set<string>();
  const convMaxSeq: Record<string, number> = {};
  let chatSessions = 0;
  let authEmail = "";
  const projects = new Set<string>();

  const g = await openStateDb(join(userDir, "globalStorage", "state.vscdb"));
  if (g) {
    for (const key of g.keys()) {
      const m = key.match(/^antigravity\.notification\.([0-9a-f-]{36})-(\d+)$/);
      if (m) {
        convIds.add(m[1]);
        convMaxSeq[m[1]] = Math.max(convMaxSeq[m[1]] || 0, parseInt(m[2], 10));
      }
    }
    try {
      const auth = JSON.parse(g.get("antigravityAuthStatus") || "{}");
      authEmail = auth?.email || auth?.userEmail || "";
    } catch {}
    try {
      const recents = JSON.parse(g.get("history.recentlyOpenedPathsList") || "{}");
      for (const e of recents?.entries || [])
        if (e?.folderUri) projects.add(basename(decodeURIComponent(String(e.folderUri))));
    } catch {}
  }

  // per-workspace chat/agent sessions
  const wsRoot = join(userDir, "workspaceStorage");
  for (const ws of safeList(wsRoot).slice(0, 300)) {
    const db = await openStateDb(join(wsRoot, ws, "state.vscdb"));
    if (!db) continue;
    const idx = db.get("chat.ChatSessionStore.index");
    if (idx) {
      try {
        const j = JSON.parse(idx);
        const entries = Array.isArray(j) ? j : Array.isArray(j?.entries) ? j.entries : Object.values(j || {});
        chatSessions += entries.length;
        for (const e of entries as any[]) {
          const ts = e?.lastMessageDate || e?.creationDate || e?.timestamp || e?.lastUpdated;
          if (ts) bump(rep.daily, localDay(ts));
        }
      } catch {}
    }
    // workspace mtime as weak activity signal
    const st = safeStat(join(wsRoot, ws, "state.vscdb"));
    if (st && (db.has("antigravity.agentViewContainerId.state") || idx)) {
      bump(rep.daily, localDay(st.mtime), 0);
      const meta = readJson(join(wsRoot, ws, "workspace.json"));
      if (meta?.folder) projects.add(basename(decodeURIComponent(String(meta.folder))));
    }
  }
  log(`  antigravity: ${convIds.size} agent conversations, ${chatSessions} chat sessions`);

  const { first, last } = dayRange(rep.daily);
  rep.firstUsed = first;
  rep.lastUsed = last;
  const hasData = convIds.size > 0 || chatSessions > 0;
  rep.status = statusFrom(last, hasData, installed);
  rep.projects = [...projects];
  if (hasData)
    rep.notes.push("Antigravity keeps most agent history server-side — local traces under-count real usage.");

  const agentEvents = Object.values(convMaxSeq).reduce((a, b) => a + b, 0);
  rep.raw = {
    agentConversations: convIds.size,
    agentEvents,
    chatSessions,
    authEmail,
    projectCount: projects.size,
  };
  if (hasData || installed) {
    rep.metrics = [
      { label: "Agent conversations", value: convIds.size },
      { label: "Chat sessions", value: fmt(chatSessions) },
      { label: "Projects", value: projects.size },
      { label: "Signed in", value: authEmail ? "yes" : installed ? "unknown" : "—" },
    ];
  }
  return rep;
}

// ---------- machine meta ----------

export function machineMeta() {
  const osName = PLAT === "darwin" ? "macOS" : PLAT === "win32" ? "Windows" : "Linux";
  return {
    user: userInfo().username,
    os: osName,
    arch: process.arch,
    hostname: (() => {
      try {
        return require("node:os").hostname();
      } catch {
        return "";
      }
    })(),
  };
}
