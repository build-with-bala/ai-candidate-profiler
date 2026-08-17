// scoring.ts — turns raw scanner output into six competency axes,
// an archetype, a verdict band, and rule-based findings.

import type { ToolReport } from "./scan";

export interface Axis {
  key: string;
  label: string;
  score: number; // 0..100
  evidence: string;
}
export interface Findings {
  strengths: string[];
  risks: string[];
  questions: string[];
}
export interface Verdict {
  band: string;
  summary: string;
}
export interface Archetype {
  name: string;
  tagline: string;
}
export interface Persona {
  facet: string;
  name: string;
  tagline: string;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

function activeDays(daily: Record<string, number>, sinceDays: number): number {
  const cutoff = Date.now() - sinceDays * 86400000;
  return Object.keys(daily).filter((d) => new Date(d + "T12:00:00").getTime() >= cutoff).length;
}
function longestStreak(days: string[]): number {
  const set = new Set(days);
  let best = 0;
  for (const d of set) {
    const prev = new Date(new Date(d + "T12:00:00").getTime() - 86400000);
    if (set.has(prev.toISOString().slice(0, 10))) continue; // not a streak start
    let len = 1;
    let cur = new Date(d + "T12:00:00");
    for (;;) {
      cur = new Date(cur.getTime() + 86400000);
      if (set.has(cur.toISOString().slice(0, 10))) len++;
      else break;
    }
    best = Math.max(best, len);
  }
  return best;
}

export function score(tools: ToolReport[]) {
  const by: Record<string, ToolReport> = {};
  for (const t of tools) by[t.id] = t;
  const cc = by.claudeCode?.raw || {};
  const cx = by.codex?.raw || {};
  const cu = by.cursor?.raw || {};
  const cp = by.copilot?.raw || {};
  const ag = by.antigravity?.raw || {};

  // merged daily activity
  const allDaily: Record<string, number> = {};
  for (const t of tools)
    for (const [d, n] of Object.entries(t.daily)) allDaily[d] = (allDaily[d] || 0) + n;
  const allDays = Object.keys(allDaily).sort();

  // ---------- axis 1: breadth ----------
  let breadth = 0;
  const breadthBits: string[] = [];
  for (const t of tools) {
    if (t.status === "active") {
      breadth += 25;
      breadthBits.push(t.name);
    } else if (t.status === "dormant") breadth += 12;
    else if (t.status === "installed") breadth += 5;
  }
  breadth = clamp(breadth);
  const axBreadth: Axis = {
    key: "breadth",
    label: "Tool breadth",
    score: breadth,
    evidence: breadthBits.length
      ? `Active in the last 30 days: ${breadthBits.join(", ")}.`
      : "No tool shows activity in the last 30 days.",
  };

  // ---------- axis 2: power depth ----------
  const depthSignals: [boolean, string][] = [
    [(cc.mcpServersConfigured || []).length >= 2, `${(cc.mcpServersConfigured || []).length} MCP servers wired into Claude Code`],
    [(cc.mcpToolsUsed || []).length > 0, `MCP tools actually invoked (${(cc.mcpToolsUsed || []).slice(0, 3).join(", ")})`],
    [(cc.skills || 0) + (cc.commands || 0) >= 3, `${cc.skills || 0} custom skills + ${cc.commands || 0} slash commands authored/installed`],
    [(cc.hooks || []).length > 0, `lifecycle hooks configured (${(cc.hooks || []).join(", ")})`],
    [(cc.delegations || 0) + (cc.sidechainSessions || 0) >= 5, `${(cc.delegations || 0) + (cc.sidechainSessions || 0)} subagent delegations`],
    [(cc.agents || 0) > 0 || (cc.plugins || 0) > 0, `custom agents/plugins installed`],
    [(cx.mcpBlocks || 0) > 0 || (cx.profiles || 0) > 0 || (cx.configLines || 0) > 8, `Codex config customized (${cx.configLines || 0} lines)`],
    [(cx.originators || []).length >= 2, `Codex used from ${(cx.originators || []).length} surfaces (${(cx.originators || []).join(", ")})`],
    [((cc.toolCounts || {})["Workflow"] || 0) > 0, "orchestrates multi-agent workflows"],
    [(cu.composers || 0) >= 10, `${cu.composers} Cursor agent/composer sessions`],
    [(cp.editingSessions || 0) >= 5, `${cp.editingSessions} Copilot agent-edit sessions`],
    [(ag.agentConversations || 0) >= 5, `${ag.agentConversations} Antigravity agent conversations`],
    [Object.keys(cc.models || {}).length + (cp.modelIds || []).length >= 3, "works across 3+ models"],
  ];
  const hit = depthSignals.filter(([b]) => b);
  const depth = clamp(hit.length * 12);
  const axDepth: Axis = {
    key: "depth",
    label: "Power-user depth",
    score: depth,
    evidence: hit.length
      ? hit.slice(0, 3).map(([, s]) => s).join("; ") + "."
      : "No advanced-feature traces (MCP, hooks, custom skills, agent modes).",
  };

  // ---------- axis 3: consistency ----------
  const d90 = activeDays(allDaily, 90);
  const d180 = activeDays(allDaily, 180);
  const streak = longestStreak(allDays);
  const lastTs = allDays.length ? new Date(allDays[allDays.length - 1] + "T12:00:00").getTime() : 0;
  const staleDays = lastTs ? Math.max(0, Math.floor((Date.now() - lastTs) / 86400000)) : 999;
  let consistency = clamp((d90 / 60) * 70 + (Math.min(streak, 14) / 14) * 30);
  if (staleDays > 14) consistency = clamp(consistency - (staleDays - 14) * 2);
  const axConsistency: Axis = {
    key: "consistency",
    label: "Consistency",
    score: consistency,
    evidence: allDays.length
      ? `${d90} active days in the last 90 (${d180} in 180); longest streak ${streak} days; last activity ${staleDays === 0 ? "today" : staleDays + "d ago"}.`
      : "No dated activity found.",
  };

  // ---------- axis 4: technical knowledge ----------
  const totalPrompts =
    (cc.userPrompts || 0) + (cx.userMsgs || 0) + (cu.prompts || 0) + (cp.chatRequests || 0) + (ag.chatSessions || 0) * 4;
  const EXT_LANG: Record<string, string> = {
    ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript",
    py: "Python", go: "Go", rs: "Rust", java: "Java", rb: "Ruby", php: "PHP", c: "C", h: "C",
    cpp: "C++", cs: "C#", swift: "Swift", kt: "Kotlin", sh: "Shell", sql: "SQL",
    html: "HTML/CSS", css: "HTML/CSS", scss: "HTML/CSS", vue: "Vue", svelte: "Svelte",
    dart: "Dart", ipynb: "Notebooks",
  };
  const langTotals: Record<string, number> = {};
  for (const [ext, n] of Object.entries<number>(cc.editedExts || {})) {
    const lang = EXT_LANG[ext];
    if (lang) langTotals[lang] = (langTotals[lang] || 0) + n;
  }
  const langs = Object.entries(langTotals).sort((a, b) => b[1] - a[1]);
  const domainTotals: Record<string, number> = {};
  for (const src of [cc.cmdDomains, cx.cmdDomains])
    for (const [d, n] of Object.entries<number>(src || {})) domainTotals[d] = (domainTotals[d] || 0) + n;
  const domains = Object.entries(domainTotals).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
  const vocab = new Set<string>([...(cc.techTerms || []), ...(cx.techTerms || []), ...(cu.techTerms || [])]);
  const tech = clamp(
    Math.min(langs.length / 7, 1) * 35 + Math.min(domains.length / 7, 1) * 35 + Math.min(vocab.size / 30, 1) * 30,
  );
  const axTech: Axis = {
    key: "tech",
    label: "Technical knowledge",
    score: tech,
    evidence:
      langs.length + domains.length + vocab.size > 0
        ? `Edits ${langs.length} languages through agents (top: ${langs.slice(0, 3).map(([l]) => l).join(", ") || "—"}); ` +
          `drives ${domains.length} toolchain domains (${domains.slice(0, 5).map(([d]) => d).join(", ") || "—"}); ` +
          `${vocab.size} distinct technical concepts discussed in prompts.`
        : "No language, toolchain, or vocabulary traces to assess.",
  };

  // ---------- axis 5: agentic leverage ----------
  const agentic =
    (cc.userPrompts || 0) + (cx.userMsgs || 0) + (cu.composers || 0) * 3 + (cp.editingSessions || 0) * 3 + (ag.agentConversations || 0) * 3;
  const chatty = (cu.prompts || 0) + (cp.chatRequests || 0) + (cu.chatBubbles || 0) / 2;
  const mix = agentic + chatty > 0 ? agentic / (agentic + chatty) : 0;
  const delegation = cc.avgToolsPerPrompt || 0; // tool calls the agent runs per user prompt
  // orchestration: running fleets, not just single agents
  const tc = cc.toolCounts || {};
  const workflowRuns = tc["Workflow"] || 0;
  const scheduled = (tc["CronCreate"] || 0) + (tc["ScheduleWakeup"] || 0);
  const monitors = tc["Monitor"] || 0;
  const subagentRuns = (cc.delegations || 0) + (cc.sidechainSessions || 0);
  const orchSignals: [boolean, string][] = [
    [workflowRuns > 0, `${workflowRuns} multi-agent workflow runs`],
    [scheduled > 0, `${scheduled} scheduled/recurring agents`],
    [monitors > 0, "watch/monitor loops"],
    [subagentRuns >= 5, `${subagentRuns} subagent delegations`],
    [!!cc.hasUsedBackgroundTask, "background tasks"],
    [(cx.originators || []).includes("codex_exec"), "scripted headless Codex (codex_exec)"],
  ];
  const orchHit = orchSignals.filter(([b]) => b);
  const orchestration = Math.min(1, orchHit.length / 4);
  const agenticScore = clamp(mix * 50 + Math.min(delegation / 8, 1) * 30 + orchestration * 20);
  const axAgentic: Axis = {
    key: "agentic",
    label: "Agentic leverage",
    score: agenticScore,
    evidence:
      agentic + chatty > 0
        ? `${Math.round(mix * 100)}% of usage is agentic (delegated multi-step work)` +
          (delegation ? `; agents execute ~${delegation.toFixed(1)} tool actions per prompt` : "") +
          (orchHit.length ? `; orchestrates: ${orchHit.map(([, s]) => s).join(", ")}.` : "; no orchestration traces (workflows, scheduled agents, background tasks).")
        : "Not enough data to separate agentic from chat usage.",
  };

  // ---------- axis 6: prompt craft (depth, not length) ----------
  const dParts = [cc.depth, cx.depth, cu.depth].filter((d) => d && d.n > 0);
  const ds = dParts.reduce(
    (a, d) => ({
      n: a.n + d.n, d0: a.d0 + d.d0, d1: a.d1 + d.d1, d2: a.d2 + d.d2, d3: a.d3 + d.d3,
      churn: a.churn + d.churn,
      withContext: a.withContext + d.withContext, sumScore: a.sumScore + d.sumScore,
    }),
    { n: 0, d0: 0, d1: 0, d2: 0, d3: 0, churn: 0, withContext: 0, sumScore: 0 },
  );
  const pct = (x: number) => Math.round(x * 100);
  // craft v2 = steering efficiency: measured by what happens AFTER each prompt,
  // not by the shape of the prompt text alone.
  let craft = 0;
  let craftEvidence = "No prompt data available to assess.";
  let avgDepth = 0, structuredShare = 0, richShare = 0, shallowShare = 0, churnRatio = 0, interruptRate = 0;
  const codified = Math.min(20, ((cc.skills || 0) + (cc.commands || 0)) * 0.5 + (cc.hooks || []).length * 2 + (cc.mcpServersConfigured || []).length);
  // yield: how far the agent runs on each brief (weighted across CC + Codex)
  const ys = [cc.yieldStats, cx.yieldStats].filter((y) => y && y.n > 0);
  const yn = ys.reduce((s, y) => s + y.n, 0);
  const wavg = (k: string) => (yn ? ys.reduce((s, y) => s + (y[k] || 0) * y.n, 0) / yn : 0);
  const p75 = wavg("p75"), highShare = wavg("highShare"), firstMed = wavg("firstMedian");
  const interrupts = (cc.interrupts || 0) + (cx.interrupts || 0);
  interruptRate = totalPrompts ? interrupts / totalPrompts : 0;
  const planUses = (tc["EnterPlanMode"] || 0) + (tc["ExitPlanMode"] || 0);
  const skillUses = tc["Skill"] || 0;
  if (ds.n) {
    avgDepth = ds.sumScore / ds.n;
    shallowShare = ds.d0 / ds.n;
    structuredShare = (ds.d2 + ds.d3) / ds.n;
    richShare = ds.d3 / ds.n;
    churnRatio = ds.churn / ds.n;
    // components (max 100): autonomy 35, clean steering 30, deliberate framing 10,
    // structural depth 15, codified context 10
    const autonomy = Math.min(p75 / 12, 1) * 20 + Math.min(highShare / 0.12, 1) * 15;
    const steering = (1 - Math.min(churnRatio * 8, 1)) * 20 + (1 - Math.min(interruptRate * 8, 1)) * 10;
    const deliberate = Math.min((planUses + skillUses / 8) / 15, 1) * 10;
    const structure = ((ds.d1 / ds.n) * 25 + (ds.d2 / ds.n) * 60 + richShare * 100) / 100 * 15;
    craft = clamp(autonomy + steering + deliberate + structure + codified / 2);
    craftEvidence =
      `Briefs carry the agent ${Math.round(p75)} actions at p75 (${pct(highShare)}% unlock 10+ autonomous actions, ` +
      `median first-brief run ${Math.round(firstMed)}); interruptions ${pct(interruptRate)}%, correction churn ${pct(churnRatio)}%; ` +
      `${planUses ? planUses + " plan-mode framings, " : ""}${skillUses ? skillUses + " skill invocations; " : ""}` +
      `${pct(structuredShare)}% structurally rich prompts` +
      (codified >= 8 ? `; +${Math.round(codified / 2)} codified context (skills/hooks/MCP).` : ".");
  }
  const axCraft: Axis = {
    key: "craft",
    label: "Prompt craft",
    score: craft,
    evidence: craftEvidence,
  };

  const axes = [axBreadth, axDepth, axConsistency, axTech, axAgentic, axCraft];

  // ---------- overall + verdict ----------
  const weights: Record<string, number> = {
    breadth: 0.1,
    depth: 0.22,
    consistency: 0.18,
    tech: 0.15,
    agentic: 0.22,
    craft: 0.13,
  };
  const overall = clamp(axes.reduce((s, a) => s + a.score * weights[a.key], 0));
  const band =
    overall >= 80
      ? "Exceptional leverage"
      : overall >= 65
        ? "Strong leverage"
        : overall >= 45
          ? "Developing leverage"
          : overall >= 25
            ? "Limited leverage"
            : "Minimal signal";
  const verdict: Verdict = {
    band,
    summary:
      overall >= 80
        ? "Works the way senior AI-native engineers work: delegates real tasks to agents, customizes the toolchain, and shows sustained daily throughput."
        : overall >= 65
          ? "Genuinely fluent with AI tooling — real agentic workflows and steady usage, with room to deepen customization or consistency."
          : overall >= 45
            ? "Uses AI tools for real work but leans on default workflows; depth and delegation habits are still forming."
            : overall >= 25
              ? "Light or shallow usage — AI tools are occasional helpers, not part of the working method."
              : "Too little local trace to profile — verify whether they work on another machine or account before concluding.",
  };

  // ---------- personas: top-4 role affinities from the telemetry ----------
  const ext: Record<string, number> = cc.editedExts || {};
  const dom = domainTotals;
  const vocabHas = (...terms: string[]) => terms.filter((t) => vocab.has(t)).length;
  const ARCH_V = vocabHas("microservice", "monolith", "queue", "kafka", "grpc", "graphql", "endpoint", "middleware", "cache", "latency", "throughput", "load balancer", "rate limit", "event loop");
  const DATA_V = vocabHas("database", "migration", "schema", "index", "transaction", "orm", "postgres", "mysql", "mongodb", "sqlite", "redis");
  const INFRA_V = vocabHas("docker", "kubernetes", "container", "terraform", "serverless", "lambda", "s3", "nginx", "proxy", "dns", "ssl", "tls", "vpn", "firewall", "port", "subnet", "deploy", "deployment", "rollback", "pipeline", "backup", "snapshot");
  const SEC_V = vocabHas("oauth", "jwt", "encryption", "hash", "csrf", "xss", "sql injection", "secret", "api key", "authentication", "authorization", "prompt injection");
  const TEST_V = vocabHas("unit test", "integration test", "e2e", "mock", "regression");
  const AI_V = vocabHas("llm", "embedding", "vector", "prompt injection");
  const codeEdits = Object.entries(ext).filter(([e]) => e !== "md" && e !== "json" && e !== "txt").reduce((s, [, n]) => s + (n as number), 0);
  const feEdits = ["tsx", "jsx", "html", "css", "scss", "vue", "svelte"].reduce((s, e) => s + (ext[e] || 0), 0);
  const beEdits = ["py", "go", "java", "rb", "php", "rs", "c", "cpp", "cs", "kt"].reduce((s, e) => s + (ext[e] || 0), 0);
  const feShare = codeEdits ? feEdits / codeEdits : 0;
  const beShare = codeEdits ? beEdits / codeEdits : 0;
  const mdEdits = ext["md"] || 0;
  const allEdits = Object.values(ext).reduce((s, n) => s + (n as number), 0);
  const projects = (cc.projectCount || 0) + (cx.projectCount || 0);
  const modelDiversity = Object.keys(cc.models || {}).length + (cp.modelIds || []).length;
  const infraOps = (dom["containers"] || 0) + (dom["cloud/iac"] || 0) + (dom["system"] || 0);
  const cap1 = (n: number) => Math.min(1, n);

  // evidence taglines skip zero-valued parts
  const seg = (arr: (string | false | null | undefined | "" | 0)[]) => arr.filter(Boolean).join(", ") || "signal from combined traces";
  const logProj = cap1(Math.log10(projects + 1) / 2.2);
  const mdShare = allEdits ? mdEdits / allEdits : 0;
  const mcpUsed = (cc.mcpToolsUsed || []).length;
  const mcpConf = (cc.mcpServersConfigured || []).length;
  const skillsCmds = (cc.skills || 0) + (cc.commands || 0);
  const hooksN = (cc.hooks || []).length;
  const readsShare = (cc.toolCalls || 0) ? (((tc["Read"] || 0) + (tc["Grep"] || 0) + (tc["Glob"] || 0)) / cc.toolCalls) : 0;
  const contextShare2 = ds.n ? ds.withContext / ds.n : 0;
  const dbOps = dom["databases"] || 0;
  const netOps = dom["networking"] || 0;
  const testOps = dom["testing"] || 0;
  const gitOps = dom["git"] || 0;
  const mobileEdits = (ext["swift"] || 0) + (ext["kt"] || 0) + (ext["dart"] || 0);
  const sysEdits = (ext["c"] || 0) + (ext["cpp"] || 0) + (ext["h"] || 0) + (ext["rs"] || 0) + (ext["go"] || 0);
  const nbEdits = ext["ipynb"] || 0;
  const sqlEdits = ext["sql"] || 0;
  const shEdits = ext["sh"] || 0;
  const V = vocabHas;
  const R = (name: string, score: number, tagline: string): Persona & { score: number } =>
    ({ facet: "", name, score: cap1(score), tagline });

  const r1 = (x: number, target: number) => Math.min(x / target, 1);
  const roles: (Persona & { score: number })[] = [
    R("The Orchestrator", r1(workflowRuns, 40) * 0.5 + r1(scheduled, 10) * 0.15 + r1(subagentRuns, 120) * 0.25 + r1(monitors, 20) * 0.05 + (cc.hasUsedBackgroundTask ? 0.05 : 0),
      seg([workflowRuns && `${workflowRuns} workflow runs`, scheduled && `${scheduled} scheduled agents`, subagentRuns && `${subagentRuns} subagent delegations`])),
    R("The Architect", r1(Object.keys(dom).length, 10) * 0.3 + logProj * 0.25 + r1(ARCH_V, 12) * 0.3 + (planUses > 0 ? 0.15 : 0),
      seg([`${Object.keys(dom).length} toolchain domains`, projects && `${projects} projects`, ARCH_V && `${ARCH_V} systems concepts`, planUses && `${planUses} plan-mode designs`])),
    R("The Platform Engineer", r1(infraOps, 2500) * 0.65 + r1(INFRA_V, 14) * 0.35,
      seg([infraOps && `${infraOps.toLocaleString()} container/cloud/system ops`, INFRA_V && `${INFRA_V} infra concepts`])),
    R("The DevOps Engineer", r1(gitOps, 2000) * 0.35 + r1(V("deploy", "deployment", "rollback", "pipeline"), 4) * 0.4 + r1(dom["containers"] || 0, 1500) * 0.25,
      seg([gitOps && `${gitOps.toLocaleString()} git ops`, (dom["containers"] || 0) && `${dom["containers"]} container ops`, "release vocabulary"])),
    R("The SRE", r1(dom["system"] || 0, 300) * 0.3 + r1(V("backup", "snapshot", "latency", "throughput", "firewall"), 5) * 0.4 + r1(monitors, 10) * 0.15 + r1(netOps, 4000) * 0.15,
      seg([(dom["system"] || 0) && `${dom["system"]} system-service ops`, monitors && `${monitors} watch loops`, "reliability vocabulary"])),
    R("The Data Engineer", r1(dbOps, 300) * 0.45 + r1(sqlEdits + nbEdits, 40) * 0.2 + r1(DATA_V, 9) * 0.35,
      seg([dbOps && `${dbOps} database-CLI ops`, sqlEdits && `${sqlEdits} SQL edits`, nbEdits && `${nbEdits} notebook edits`, DATA_V && `${DATA_V} data concepts`])),
    R("The Database Admin", r1(dbOps, 600) * 0.7 + r1(V("backup", "snapshot", "transaction", "index"), 4) * 0.3,
      seg([dbOps && `${dbOps} db-CLI ops`, "backup/transaction vocabulary"])),
    R("The ML Engineer", r1(nbEdits, 15) * 0.4 + r1(V("embedding", "vector"), 2) * 0.35 + r1(V("llm"), 1) * 0.25,
      seg([nbEdits && `${nbEdits} notebook edits`, "embedding/vector/LLM work in prompts"])),
    R("The AI Engineer", r1(AI_V, 4) * 0.4 + r1(mcpConf, 6) * 0.35 + r1(modelDiversity, 6) * 0.25,
      seg([AI_V && `LLM/embedding vocabulary`, mcpConf && `${mcpConf} MCP integrations`, modelDiversity && `${modelDiversity} models in rotation`])),
    R("The Prompt Engineer", r1(richShare, 0.35) * 0.4 + r1(skillsCmds, 20) * 0.35 + r1(AI_V, 3) * 0.25,
      seg([richShare > 0.05 && `${Math.round(richShare * 100)}% rich spec briefs`, skillsCmds && `${skillsCmds} authored skills/commands`])),
    R("The Frontend Engineer", codeEdits >= 40 ? r1(feShare, 0.85) : 0,
      seg([feEdits && `${Math.round(feShare * 100)}% of agent edits in UI code (${feEdits} files)`])),
    R("The Backend Engineer", codeEdits >= 40 ? r1(beShare, 0.9) * 0.85 + r1(DATA_V, 12) * 0.15 : 0,
      seg([beEdits && `${Math.round(beShare * 100)}% of agent edits server-side (${beEdits} files)`, DATA_V && "data-layer vocabulary"])),
    R("The Full-Stack Engineer", feShare >= 0.22 && beShare >= 0.22 ? (feShare + beShare) / 1.2 : 0,
      seg([`${Math.round(feShare * 100)}% UI / ${Math.round(beShare * 100)}% server edit split`])),
    R("The Mobile Engineer", r1(mobileEdits, 60) * 0.9,
      seg([mobileEdits && `${mobileEdits} Swift/Kotlin/Dart edits via agents`])),
    R("The Systems Programmer", r1(sysEdits, 80) * 0.9,
      seg([sysEdits && `${sysEdits} C/C++/Rust/Go edits via agents`])),
    R("The Automation Scripter", r1(shEdits, 150) * 0.4 + r1(dom["scripting"] || 0, 4000) * 0.35 + r1(scheduled, 5) * 0.25,
      seg([shEdits && `${shEdits} shell-script edits`, (dom["scripting"] || 0) && `${dom["scripting"]} script executions`, scheduled && "scheduled jobs"])),
    R("The QA Engineer", r1(testOps, 400) * 0.5 + r1(TEST_V, 5) * 0.45,
      seg([testOps && `${testOps} test-runner invocations`, TEST_V && `${TEST_V} testing concepts`])),
    R("The Security Engineer", r1(SEC_V, 12) * 0.62 + r1(netOps, 5000) * 0.13,
      seg([SEC_V && `${SEC_V} security concepts (auth, crypto, injection classes)`])),
    R("The Network Engineer", r1(netOps, 3000) * 0.6 + r1(V("dns", "vpn", "subnet", "port", "proxy"), 5) * 0.35,
      seg([netOps && `${netOps.toLocaleString()} network ops (ssh/curl/dns)`, "network vocabulary"])),
    R("The Toolsmith", r1(skillsCmds, 40) * 0.55 + r1(hooksN, 4) * 0.2 + r1(cc.plugins || 0, 6) * 0.25,
      seg([skillsCmds && `${skillsCmds} custom skills/commands`, hooksN && `${hooksN} lifecycle hooks`, (cc.plugins || 0) && `${cc.plugins} plugins`])),
    R("The Integrator", r1(mcpUsed, 8) * 0.55 + r1(V("webhook", "rest api", "graphql", "grpc"), 4) * 0.45,
      seg([mcpUsed && `${mcpUsed} MCP integrations actually invoked`, "API/webhook vocabulary"])),
    R("The Product Owner", logProj * 0.3 + r1(mdShare, 0.25) * 0.25 + r1(delegation, 12) * 0.25 + r1(richShare, 0.3) * 0.2,
      seg([projects && `steers ${projects} projects by delegation`, mdEdits && `${mdEdits} spec/doc edits`])),
    R("The Tech Lead", r1(subagentRuns, 120) * 0.3 + logProj * 0.3 + r1(mdEdits, 300) * 0.2 + (planUses > 0 ? 0.2 : 0),
      seg([subagentRuns && `${subagentRuns} delegated runs`, projects && `${projects} projects`, planUses && "plan-first framing"])),
    R("The Documentarian", r1(mdShare, 0.35) * 0.9,
      seg([mdEdits && `${mdEdits} markdown/doc edits (${Math.round(mdShare * 100)}% of all edits)`])),
    R("The Debugger", r1(contextShare2, 0.2) * 0.55 + r1(V("memory leak", "race condition", "deadlock", "stack trace"), 3) * 0.45,
      seg([contextShare2 > 0.02 && `${Math.round(contextShare2 * 100)}% of prompts open with errors/logs`, "failure-mode vocabulary"])),
    R("The Refactorer", V("refactor") * 0.4 + r1((tc["Edit"] || 0) / ((tc["Write"] || 0) + 1), 6) * 0.6,
      seg([(tc["Edit"] || 0) && `${tc["Edit"]} in-place edits vs ${tc["Write"] || 0} rewrites`, vocab.has("refactor") && "refactoring vocabulary"])),
    R("The Code Auditor", r1(readsShare, 0.3) * 0.7 + r1(V("regression", "unit test"), 2) * 0.3,
      seg([readsShare > 0.03 && `${Math.round(readsShare * 100)}% of agent actions are read/search (review-style)`])),
    R("The Polyglot", r1(langs.length, 10) * 0.9,
      seg([langs.length && `${langs.length} languages edited via agents (${langs.slice(0, 4).map(([l]) => l).join(", ")})`])),
    R("The Early Adopter", r1(breadth, 100) * 0.55 + r1(modelDiversity, 8) * 0.45,
      seg([breadthBits.length && `${breadthBits.length} assistants in active rotation`, modelDiversity && `${modelDiversity} models tried`])),
  ];

  let personas: Persona[];
  if (overall < 20 && totalPrompts < 50) {
    personas = [{ facet: "profile", name: "The Ghost", tagline: "little on-disk evidence — probe before judging" }];
  } else {
    const top6 = roles.filter((r) => r.score >= 0.1).sort((a, b) => b.score - a.score).slice(0, 6);
    personas = top6.length
      ? top6.map((r) => ({ facet: Math.round(r.score * 100) + "% match", name: r.name, tagline: r.tagline }))
      : [{ facet: "profile", name: "The Generalist", tagline: "no dominant role signal in the traces" }];
  }
  const archetype: Archetype = { name: personas[0].name, tagline: personas[0].tagline };

  // ---------- findings ----------
  const strengths: string[] = [];
  const risks: string[] = [];
  const questions: string[] = [];

  if (subagentRuns >= 10)
    strengths.push(`Delegates and parallelizes: ${subagentRuns} subagent runs in Claude Code — a genuinely advanced workflow.`);
  if (workflowRuns + scheduled >= 3)
    strengths.push(`Orchestrates beyond single agents: ${workflowRuns} workflow runs and ${scheduled} scheduled/recurring agents — treats agents as infrastructure.`);
  if ((cc.mcpServersConfigured || []).length >= 3)
    strengths.push(`Extends the toolchain: ${(cc.mcpServersConfigured || []).length} MCP servers configured (${(cc.mcpServersConfigured || []).slice(0, 4).join(", ")}…).`);
  if ((cc.skills || 0) + (cc.commands || 0) >= 5)
    strengths.push(`Invests in automation: ${(cc.skills || 0) + (cc.commands || 0)} custom skills/commands — treats the AI setup as a product.`);
  if (d90 >= 45) strengths.push(`Sustained habit: active ${d90} of the last 90 days — AI usage is routine, not episodic.`);
  if (richShare >= 0.12)
    strengths.push(`Writes real briefs: ${pct(richShare)}% of prompts are rich specs combining context, file references, and constraints.`);
  if (highShare >= 0.15)
    strengths.push(`Briefs unlock autonomy: ${pct(highShare)}% of prompts trigger 10+ agent actions before the next human turn.`);
  if (langs.length >= 6)
    strengths.push(`Polyglot in practice: agents edit ${langs.length} languages under their direction (top: ${langs.slice(0, 4).map(([l]) => l).join(", ")}).`);
  if ((cx.originators || []).length >= 2)
    strengths.push(`Meets tools where they are: uses Codex from ${(cx.originators || []).join(" and ")}.`);
  if (breadthBits.length >= 3)
    strengths.push(`Genuinely multi-tool: ${breadthBits.length} assistants in active rotation — can adapt to any team's stack.`);

  if (staleDays > 30 && allDays.length)
    risks.push(`Activity stopped ${staleDays} days ago — confirm whether work moved to another machine or the habit lapsed.`);
  if (ds.n > 50 && shallowShare > 0.5)
    risks.push(`${pct(shallowShare)}% of prompts are bare commands with no context, files, or constraints — may under-specify and iterate wastefully.`);
  if (ds.n > 50 && churnRatio > 0.08)
    risks.push(`Correction churn is ${pct(churnRatio)}% ("no", "wrong", "again" follow-ups) — signs of trial-and-error steering instead of upfront briefing.`);
  if (totalPrompts > 200 && interruptRate > 0.05)
    risks.push(`Interrupts the agent in ${pct(interruptRate)}% of turns — briefs often fail to steer on the first attempt.`);
  if (totalPrompts > 200 && Object.keys(cc.editedExts || {}).length > 0 && langs.length <= 2)
    risks.push(`Narrow technical surface: agent-driven edits concentrate in ${langs.map(([l]) => l).join(" and ") || "one stack"} only.`);
  if (agenticScore < 35 && totalPrompts > 100)
    risks.push("Usage is heavily chat-shaped: asks questions but rarely delegates end-to-end tasks to an agent.");
  if (depth < 25 && totalPrompts > 200)
    risks.push("High volume on stock defaults — no MCP, hooks, skills, or config customization anywhere.");
  if ((cc.lateNightShare || 0) > 0.35)
    risks.push(`${Math.round((cc.lateNightShare || 0) * 100)}% of Claude Code activity is between midnight and 6am — worth a conversation about sustainability.`);
  if (!risks.length && overall >= 45) risks.push("No material red flags in local traces; verify quality of output in a live pairing session.");

  questions.push("Walk me through the last task you fully delegated to an agent. What did you check before trusting the result?");
  if ((cc.mcpServersConfigured || []).length === 0 && totalPrompts > 100)
    questions.push("You run stock configurations everywhere — have you ever extended an assistant with MCP, hooks, or custom commands? Why not?");
  if (agenticScore >= 60)
    questions.push("Describe a time an agent confidently did the wrong thing. How did you catch it, and what guardrail did you add?");
  if (ds.n > 50 && avgDepth < 1.2)
    questions.push("Your prompts are mostly bare commands. Show me how you'd brief an agent on a multi-file refactor — what context and constraints would you provide?");
  if (agenticScore >= 50 && orchHit.length === 0)
    questions.push("You delegate single tasks but show no orchestration traces — have you ever run parallel agents, workflows, or scheduled/background runs? What stopped you?");
  if (breadthBits.length >= 3)
    questions.push(`You actively run ${breadthBits.length} different assistants — what does each one get used for, and why keep all of them?`);
  questions.push("What in your AI workflow would break if your provider changed tomorrow? What's portable?");

  if (vocab.size < 10 && totalPrompts > 200)
    questions.push("Your prompts rarely touch infrastructure or systems concepts — where does that work happen, and who handles it?");

  return {
    axes,
    overall,
    verdict,
    archetype,
    personas,
    findings: { strengths, risks, questions },
    totals: {
      prompts: totalPrompts,
      activeDays: allDays.length,
      d90,
      streak,
      staleDays,
      tokens: cc.outputTokens || 0,
      toolsActive: breadthBits.length,
    },
  };
}
