// Public docs state formats and rules, never figures, local paths or other facts from the
// owner's machine. This test walks docs/**/*.md and fails with one `file:line rule` entry per
// violation. Code spans are inline backtick spans. D1–D5 and D7 skip fenced code blocks;
// D6 reads every line, code included, because a path leaks from a code block too.
//
//   D1  On a line holding [measured] outside code spans, no digit remains outside code
//       spans. Allowed: version tokens (v1, v0.38), phase and tier names (P0–P6), check
//       ids (C1–C10) and section references (§6.1).
//   D2  A line that names the machine ("this machine", "this Mac", also with 's) holds no
//       figure outside code spans: a number followed by % or one of FIGURE_UNITS (with an
//       optional + between), or a number right after "this machine:" / "this Mac:". A
//       number right after ≤ < ≥ > (spaces allowed) is a budget, not a figure.
//   D3  No R² outside code spans.
//   D4  No ratio a/b outside code spans whose two sides each have at least 3 digits or commas.
//   D5  In a table whose header row starts with "| Check |", every row has exactly 2 cells.
//   D6  No home-directory path: /Users/<name>/, /home/<name>/, C:\Users\<name>\, the same
//       home flattened into a folder name (-Users-<name>-…, as in project and scratch
//       folders), a user folder (~/Desktop, ~/Documents, ~/Downloads, or those under
//       $HOME or %USERPROFILE%), or a bare Desktop/… path. Paths of a tool's documented
//       store layout (~/.claude/projects/…, ~/.codex/…, %APPDATA%\…) are format facts and
//       pass, as do placeholders (<name>, *, $USER) and the synthetic homes that the plans'
//       test fixtures use.
//   D7  Outside code spans and double-quoted strings (stripped only when a line's quotes
//       pair up), no phrase states a fact about the machine: "this Mac" (also 's), "this
//       machine's", "on/of/from this machine", "installed here", "untestable locally" or
//       "cannot test locally". Quoted product copy about the user's machine passes. A bare
//       "this machine" and "here" in general are not checked: product requirements use
//       them too ("whether it matches this machine", "binding here").
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

type Rule = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7";
interface Violation { line: number; rule: Rule }

const ROOT = join(import.meta.dir, "..");

/** The line with each inline code span replaced by a space. A backtick run with no closing run stays literal. */
function stripCodeSpans(line: string): string {
  const parts = line.split(/(`+)/); // odd indices hold backtick runs
  let out = "";
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i % 2 === 0) { out += part; continue; }
    let close = i + 2;
    while (close < parts.length && parts[close] !== part) close += 2;
    if (close >= parts.length) { out += part; continue; }
    out += " ";
    i = close;
  }
  return out;
}

const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;

/** The fence marker that the line opens, or null. A backtick fence's info string holds no backtick. */
function opensFence(line: string): string | null {
  const m = FENCE.exec(line);
  if (!m || (m[1][0] === "`" && m[2].includes("`"))) return null;
  return m[1];
}

function closesFence(line: string, open: string): boolean {
  const m = FENCE.exec(line);
  return m !== null && m[1][0] === open[0] && m[1].length >= open.length && m[2].trim() === "";
}

const D1_ALLOWED = [/\bv\d+(?:\.\d+)*/g, /\bP[0-6]\b/g, /\bC(?:10|[1-9])\b/g, /§\d+(?:\.\d+)*/g];

function breaksD1(text: string): boolean {
  if (!text.includes("[measured]")) return false;
  return /\d/.test(D1_ALLOWED.reduce((rest, re) => rest.replace(re, " "), text));
}

const NAMES_MACHINE = /\bthis (?:machine|mac)\b/i;
const FIGURE_UNITS = ["GB", "MB", "KB", "files", "IDs", "ids", "versions", "days", "sessions", "threads", "requests", "trajectories", "UUIDs", "accounts", "axes"];
const FIGURE = new RegExp(String.raw`(?<![\d.,])\d[\d.,]*\s*\+?\s*(?:%|(?:${FIGURE_UNITS.join("|")})\b)`, "gi");
const MACHINE_NUMBER = /\bthis (?:machine|mac):\s*[~≈]?\s*\d/i;
const BUDGET = /[≤<≥>]\s*$/;

function breaksD2(text: string): boolean {
  if (!NAMES_MACHINE.test(text)) return false;
  if (MACHINE_NUMBER.test(text)) return true;
  return [...text.matchAll(FIGURE)].some((m) => !BUDGET.test(text.slice(0, m.index)));
}

const LONG_RATIO = /([\d,]{3,})\/([\d,]{3,})/g;

function breaksD4(text: string): boolean {
  return [...text.matchAll(LONG_RATIO)].some((m) => /\d/.test(m[1]) && /\d/.test(m[2]));
}

const CHECK_HEADER = /^\|\s*Check\s*\|/;

/** GFM cell count: the row split on unescaped pipes, without its outer pipes. */
function cellCount(row: string): number {
  return row.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "").split(/(?<!\\)\|/).length;
}

/** Synthetic home names that the plans' test fixtures use. A real user name never appears in the docs. */
const SYNTHETIC_HOMES = ["dev", "d", "x", "A", "Jo Ann", "canaryuser"];
const HOME_DIRS = [
  /(?:\\\\|\\|\/)(?:Users|home)(?:\\\\|\\|\/)/g, // /Users/…, /home/…, \home\… (WSL)
  /[A-Za-z]:(?:\\\\|\\|\/)users(?:\\\\|\\|\/)/gi, // C:\Users\…, C:\\Users\\… (escaped), c:/users/…
];
const HOME_SLUG = /(?<![\p{L}\p{N}_])-(?:Users|home)-/gu; // a home flattened into a folder name: /-Users-<name>-…, C--Users-<name>-…
const USER_FOLDERS = [
  /~(?:\\\\|\\|\/)(?:Desktop|Documents|Downloads)(?![\w-])/i,
  /(?:\$\{?HOME\}?|\$env:USERPROFILE|%USERPROFILE%)(?:\\\\|\\|\/)(?:Desktop|Documents|Downloads)(?![\w-])/i,
  /\bDesktop(?:\\\\|\\|\/)/, // a bare Desktop/… layout path
];
const NAME_END = /^(?:$|[\\/"'`\s)\],;:…])/;
const SLUG_NAME_END = /^(?:$|[-\\/"'`\s)\],;:…])/;

/** True when the text after a home prefix starts with a user name that is not a synthetic fixture home. */
function namesUser(rest: string, end: RegExp): boolean {
  if (SYNTHETIC_HOMES.some((name) => rest.startsWith(name) && end.test(rest.slice(name.length)))) return false;
  return /^[\p{L}\p{N}_]/u.test(rest); // placeholders (<name>), globs (*), variables ($USER, %USERNAME%) and ellipses pass
}

function breaksD6(line: string): boolean {
  if (USER_FOLDERS.some((re) => re.test(line))) return true;
  const namesAfter = (re: RegExp, end: RegExp) => [...line.matchAll(re)].some((m) => namesUser(line.slice(m.index + m[0].length), end));
  return HOME_DIRS.some((re) => namesAfter(re, NAME_END)) || namesAfter(HOME_SLUG, SLUG_NAME_END);
}

const MACHINE_FACT =
  /\bthis mac\b|\bthis machine['’]s\b|\b(?:on|of|from) this machine\b|\binstalled here\b|\buntestable locally\b|\bcan(?:not|['’]t) test locally\b/i;

/** The text without its quoted strings, which hold product copy about the user's machine. Straight quotes are stripped only when they pair up. */
function withoutQuotes(text: string): string {
  const out = text.replace(/“[^”]*”/g, " ");
  return (out.split('"').length - 1) % 2 === 0 ? out.replace(/"[^"]*"/g, " ") : out;
}

function breaksD7(text: string): boolean {
  return MACHINE_FACT.test(withoutQuotes(text));
}

/** Every violation in a Markdown document, one per line and rule, in line order. */
function lint(markdown: string): Violation[] {
  const found: Violation[] = [];
  let fence: string | null = null;
  let inTable = false;
  let checkTable = false;
  markdown.split(/\r?\n/).forEach((raw, i) => {
    const flag = (rule: Rule) => found.push({ line: i + 1, rule });
    if (breaksD6(raw)) flag("D6");
    if (fence !== null) {
      if (closesFence(raw, fence)) fence = null;
      return;
    }
    fence = opensFence(raw);
    if (fence !== null) { inTable = false; return; }
    const isRow = raw.trimStart().startsWith("|");
    if (isRow && !inTable) checkTable = CHECK_HEADER.test(raw.trim());
    inTable = isRow;
    const text = stripCodeSpans(raw);
    if (breaksD1(text)) flag("D1");
    if (breaksD2(text)) flag("D2");
    if (text.includes("R²")) flag("D3");
    if (breaksD4(text)) flag("D4");
    if (isRow && checkTable && cellCount(raw) !== 2) flag("D5");
    if (breaksD7(text)) flag("D7");
  });
  return found.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
}

function markdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...markdownFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(path);
  }
  return out.sort();
}

const rulesOf = (markdown: string): Rule[] => lint(markdown).map((v) => v.rule);

// The made-up figures and names below are not real ones.
describe("doc rules, on made-up lines", () => {
  test("D1: a [measured] line keeps no digit outside code spans", () => {
    expect(rulesOf("Ids track time in `2.1.9` and v0.38 (§6.6, C1–C10, P0–P6) [measured].")).toEqual([]);
    expect(rulesOf("Ids track time on 41 days of logs [measured].")).toEqual(["D1"]);
  });

  test("D2: a line naming the machine holds no figure; budgets and code spans pass", () => {
    expect(rulesOf("This machine keeps a cold scan ≤ 45 s and < 2 GB, and `this machine: 37 files` sits in a code span.")).toEqual([]);
    for (const line of ["this machine: 37", "this machine logs 8 GB", "This machine logged 17% of turns", "This machine has 300+ files"]) {
      expect(rulesOf(line)).toEqual(["D2"]);
    }
    expect(rulesOf("this Mac holds 8 GB")).toEqual(["D2", "D7"]);
  });

  test("D3: no R² outside code spans", () => {
    expect(rulesOf("The method reports `R²` for the fit.")).toEqual([]);
    expect(rulesOf("The fit has R² near one.")).toEqual(["D3"]);
  });

  test("D4: no ratio with 3+ digits or commas on each side outside code spans", () => {
    expect(rulesOf("Short ratios such as 45/67 pass, and so does `3,000/4,000`.")).toEqual([]);
    expect(rulesOf("3,000/4,000 records matched.")).toEqual(["D4"]);
  });

  test("D5: every row of a | Check | table has exactly 2 cells", () => {
    const ok = ["| Check | Rule |", "|---|---|", "| C1 ids in time order | out of order → fail |", "", "| Signal | Rule | Source |", "|---|---|---|", "| a | b | c |"];
    expect(rulesOf(ok.join("\n"))).toEqual([]);
    const bad = ["| Check | Rule | Baseline |", "|---|---|---|", "| C1 ids in time order | out of order → fail | clean |"];
    expect(rulesOf(bad.join("\n"))).toEqual(["D5", "D5", "D5"]);
  });

  test("D6: no home-directory path; store layouts, placeholders and fixture homes pass", () => {
    const ok = [
      "`~/.claude/projects/<slug>/*.jsonl`, `~/.codex/sessions/`, `~/Library/Application Support/Cursor`",
      "%APPDATA%\\Code\\User and \\\\wsl.localhost\\<distro>\\home\\*\\.codex",
      "`/Users/dev/Library`, `C:\\Users\\Jo Ann\\AppData`, `/home/dev/p q`, `c:/Users/A/proj`, `C:\\Users\\x\\Work`",
      "\"C:\\\\Users\\\\Jo Ann\\\\AppData\" (as escaped in a TS string), `/Users/canaryuser/clients`",
      "placeholders: `<A>/docs`, `/Users/<name>/`, `/home/$USER/`",
      "`aipr-home-*` temp folders, `~/.claude/projects/-Users-dev-p/s.jsonl`, `C--Users-x-Work`",
      "Claude Desktop and Devin Desktop, `$HOME/.codex`, `%USERPROFILE%\\.codex`",
    ];
    for (const line of ok) expect(rulesOf(line)).toEqual([]);
    const bad = [
      "/Users/someone/notes",
      "/home/someone/notes",
      "C:\\Users\\someone\\notes",
      "\"C:\\\\Users\\\\someone\\\\notes\"",
      "`~/Desktop/notes`",
      "/Users/devon/notes",
      "/private/tmp/claude-<uid>/-Users-someone-Desktop-notes/<session>/scratchpad",
      "`~/.claude/projects/-home-someone-src/abc.jsonl`",
      "C--Users-someone-proj",
      "Desktop/notes/plan.md",
      "$HOME/Documents/notes",
      "%USERPROFILE%\\Downloads\\notes",
      "~/Documents/notes",
      "`~/Downloads`",
    ];
    for (const line of bad) expect(rulesOf(line)).toEqual(["D6"]);
  });

  test("D7: no phrase states a fact about the machine; quoted copy and bare uses pass", () => {
    const ok = [
      "5. \"Your report stays on this machine and shows the real names of your projects.\"",
      "- the company fingerprint, with whether it matches this machine;",
      "the rule names `this Mac` and `on this machine` in code spans; no value from the owner's machine is kept",
      "a field confirmed “on this machine” is reworded; the rules are binding here",
    ];
    for (const line of ok) expect(rulesOf(line)).toEqual([]);
    const bad = [
      "proven on synthetic fixtures and on this Mac.",
      "agents may inspect this machine's traces",
      "a local run on this machine (results never committed)",
      "no figures from this machine>",
      "| **Cursor** (P0, not installed here) |",
      "| Untestable locally (P2 tools) | fixtures from docs |",
      "the builder can't test locally",
      "a 5\" screen shows this machine's traces", // an unpaired quote strips nothing
    ];
    for (const line of bad) expect(rulesOf(line)).toEqual(["D7"]);
  });

  test("fenced blocks: D1–D5 and D7 skip them, D6 reads them", () => {
    const fenced = ["```text", "this machine: 37 · R² · 3,000/4,000 · 41 days [measured] · on this Mac", "| Check | Rule | Baseline |", "```"];
    expect(rulesOf(fenced.join("\n"))).toEqual([]);
    expect(rulesOf(["~~~bash", "cd /Users/someone/project", "~~~"].join("\n"))).toEqual(["D6"]);
  });

  test("a violation carries its 1-based line number", () => {
    expect(lint("fine\r\nthis machine: 37")).toEqual([{ line: 2, rule: "D2" }]);
  });
});

describe("docs", () => {
  test("docs/**/*.md state formats and rules, not figures, paths or facts from the owner's machine", () => {
    const files = markdownFiles(join(ROOT, "docs"));
    const names = files.map((file) => relative(ROOT, file).split(sep).join("/"));
    expect(names).toContain("docs/superpowers/specs/2026-11-17-ai-leverage-suite-v2-design.md");
    const violations = files.flatMap((file, i) => lint(readFileSync(file, "utf8")).map((v) => `${names[i]}:${v.line} ${v.rule}`));
    expect(violations).toEqual([]);
  });
});
