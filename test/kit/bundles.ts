// Bundle fixtures: the plan's V7 vector and signed persona bundles. The persona exports are synthetic, shaped like
// Plan 2 Task 14's aiprof/2 payload and generated here from a seed; no value comes from a real machine.
// TODO(1b): build the persona exports with personaScan + analyze + exportPayload through test/kit/core.ts.
import { Buffer } from "node:buffer";
import type { ExportedPayload } from "../../src/payload/exported";
import { assemble, bundleBytes, signBundle, type SignedBundle, type UnsignedBundle } from "../../src/trust/bundle";
import { mintInvite, type Invite } from "../../src/trust/invite";
import { jcs } from "../../src/trust/jcs";
import type { Rand, XKey } from "../../src/trust/keys";
import { sealBundle, sealedBytes, type SealedBundle } from "../../src/trust/seal";
import type { Signer } from "../../src/trust/signer";
import { testCompany, testSigner, VEC } from "./keys";

export type Persona = "novice" | "intermediate" | "expert";

const hex = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "hex"));

/** A Rand that hands out these values in order, each of the length asked for. */
export function queueRand(...values: Uint8Array[]): Rand {
  return (n) => {
    const next = values.shift();
    if (!next || next.length !== n) throw new Error("the queue rand ran dry");
    return next;
  };
}

/** The plan's V6 invite: company VEC.t1 "Example Co", role backend, fields exhibits + fingerprints, sealed to VEC.bob. */
export function v6Invite(): Invite {
  return mintInvite(testCompany("Example Co"), {
    role: "backend",
    roleHash: "0".repeat(64),
    now: Date.UTC(2026, 10, 17, 10, 0, 0),
    expiresS: 14 * 86400,
    fields: ["exhibits", "fingerprints"],
    seal: true,
    rand: queueRand(hex("a1b2c3d4e5f60718293a4b5c"), hex("000102030405060708090a0b0c0d0e0f")),
  });
}

/** V7's bundle without its signature, exactly as the plan pins it. */
export function vectorUnsigned(): UnsignedBundle {
  return {
    format: "aiprof/2",
    meta: { profiler: "2.0.0-dev", core: "1.0.0", coreSha: "0".repeat(40), createdAt: "2026-11-18T10:42:07Z", keyId: "test-39f713d0", build: "release" },
    invite: v6Invite().token,
    subject: { name: null },
    payload: { schema: "aiprof/2", core: "1.0.0", reference: "v0" },
    exhibits: null,
    integrity: { band: "consistent", serverBacked: 0.5, anchorable: ["claude-code"], notAnchorable: [], checks: [] },
    fingerprints: [{ fp: "c1f6af6c44d0ef639be976ee2e3f111d", day: "2026-11-02", tool: "claude-code", size: "L" }],
    exclusions: { tools: 0, projects: 0, sessions: 0 },
    timestamp: null,
    sealed: null,
  };
}

/** V7: the vector bundle signed by VEC.t2 under test-39f713d0. */
export function vectorBundle(): SignedBundle {
  return signBundle(vectorUnsigned(), testSigner());
}

/** A small seeded PRNG (mulberry32), so every fixture is the same on every run. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SCALE: Record<Persona, { seed: number; tools: number; projects: number; weeks: number; level: number }> = {
  novice: { seed: 11, tools: 1, projects: 3, weeks: 6, level: 0.25 },
  intermediate: { seed: 22, tools: 3, projects: 14, weeks: 26, level: 0.55 },
  expert: { seed: 33, tools: 6, projects: 100, weeks: 52, level: 0.85 },
};
const TOOLS = ["claude-code", "codex", "gemini-cli", "copilot", "cursor", "antigravity"];
const DIMENSIONS: Record<string, string[]> = {
  leverage: ["lev.sticky", "lev.run"],
  orchestration: ["orc.parallel", "orc.fanout", "orc.headless", "orc.background"],
  steering: ["ste.correction", "ste.interrupts", "ste.turnsPerWork"],
  verification: ["ver.vae", "ver.closure", "ver.guardrails"],
  delivery: ["del.landed", "del.rework", "del.prs"],
  context: ["ctx.instructions", "ctx.artifacts", "ctx.hygiene", "ctx.briefs"],
  judgment: ["jud.switches", "jud.rho", "jud.cost"],
};
const SIGNALS = [
  "stickyMean", "p90Run", "parallelShare", "fanoutPerEpisode", "headlessPerWeek", "backgroundShare", "vae", "closure", "guardrails",
  "correctionRate", "healthyInterruptShare", "turnsPerWork", "maintainedShare", "artifacts", "hygiene", "briefScore", "switchesPerWeek",
  "rho", "tokensPerLanded", "landedShare", "reworkShare", "prsPerWeek",
];

/** A synthetic aiprof/2 export for a persona, with all of Plan 2 Task 14's top-level keys. */
export function personaExport(kind: Persona): ExportedPayload {
  const s = SCALE[kind];
  const r = seeded(s.seed);
  const round = (x: number, d = 4): number => Math.round(x * 10 ** d) / 10 ** d;
  const level = (): number => round(Math.min(1, Math.max(0, s.level + (r() - 0.5) * 0.3)));
  const tools = TOOLS.slice(0, s.tools);
  const week = (i: number): string => `2026-W${String((i % 52) + 1).padStart(2, "0")}`;
  const label = (): string => `P-${Math.floor(r() * 0x10000).toString(16).toUpperCase().padStart(4, "0")}`;
  const dimensions = Object.entries(DIMENSIONS).map(([id, comps]) => {
    const score = Math.round(level() * 100);
    return {
      id, status: "scored", score, interval: [Math.max(0, score - 9), Math.min(100, score + 8)], openTail: score > 95,
      confidence: s.level > 0.5 ? "medium" : "low", n: Math.round(40 + r() * 400), needs: null, window: "detail",
      components: comps.map((c) => ({ id: c, status: "ok", x: level(), z: round((r() - 0.5) * 3), n: Math.round(10 + r() * 300), weight: round(1 / comps.length) })),
    };
  });
  const value = {
    schema: "aiprof/2",
    core: "1.0.0",
    reference: "v0",
    coverage: tools.map((tool) => ({
      tool, window: "detail", status: "ok", beta: false, from: "2026-01", to: "2026-11", sessions: Math.round(20 + r() * 800),
      prompts: Math.round(100 + r() * 9000), formatChanged: false,
    })),
    overall: { status: "scored", score: Math.round(s.level * 100), interval: [Math.round(s.level * 90), Math.round(s.level * 100) + 6], band: "consistent", coverage: null },
    dimensions,
    personas: s.level > 0.5 ? ["orchestrator", "verifier"] : ["explorer"],
    signals: Object.fromEntries(SIGNALS.map((m) => [m, { value: level(), n: Math.round(10 + r() * 500), window: "detail", from: "2026-01", to: "2026-11" }])),
    exposure: {
      tenureWeeks: s.weeks, activeWeeks: { detail: Math.round(s.weeks * 0.8), lifetime: s.weeks },
      weekly: Array.from({ length: s.weeks }, (_, i) => ({ week: week(i), sessions: Math.round(r() * 60), prompts: Math.round(r() * 600) })),
      tools: tools.map((tool) => ({ tool, window: "detail", sessions: Math.round(r() * 900), prompts: Math.round(r() * 9000), months: Math.round(1 + r() * 11) })),
      rotation: round(r()), arcs: Math.round(r() * 9), firstSeen: week(0),
      models: Object.fromEntries(["claude-opus", "gpt-5", "gemini-pro", "other"].slice(0, 1 + s.tools % 4).map((m) => [m, Math.round(r() * 3000)])),
    },
    stack: {
      languages: Object.fromEntries(["typescript", "python", "go", "rust", "sql"].slice(0, 2 + s.tools % 4).map((l) => [l, Math.round(r() * 400)])),
      toolchains: Object.fromEntries(["bun", "npm", "pip", "cargo"].slice(0, 1 + s.tools % 4).map((t) => [t, Math.round(r() * 200)])),
      techCategories: Object.fromEntries(["web", "infra", "data", "ml"].slice(0, 1 + s.tools % 4).map((t) => [t, Math.round(r() * 100)])),
    },
    risk: { permission: { default: Math.round(r() * 90), other: Math.round(r() * 9) }, approval: { "on-request": Math.round(r() * 80) }, sandbox: { "workspace-write": Math.round(r() * 70) } },
    config: { byKind: { instructions: Math.round(r() * 9), hook: Math.round(r() * 5), "mcp-server": Math.round(r() * 6) }, hooksDisabled: false, memoryFiles: Math.round(r() * 9), mcpServers: ["github", "custom #1"].slice(0, 1 + (s.tools % 2)) },
    projects: Array.from({ length: s.projects }, (_, i) => ({
      label: label(), sessions: Math.round(1 + r() * 300), activeWeeks: Math.round(1 + r() * s.weeks), tools: tools.slice(0, 1 + (i % s.tools)),
      inRepo: r() > 0.2, lastWeek: week(i),
    })),
    otherProjects: s.projects >= 100 ? 17 : 0,
    forensics: {
      band: "consistent-with-notes", serverBacked: round(s.level), anchorable: tools.slice(0, Math.ceil(s.tools / 2)), notAnchorable: tools.slice(Math.ceil(s.tools / 2)),
      checks: ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"].map((id, i) => ({
        id, status: i === 4 ? "note" : "pass", reason: i === 4 ? "file times cluster on one day" : "consistent",
        values: i === 4 ? { day: "2026-10-04", files: Math.round(r() * 40) } : { checked: Math.round(r() * 500) }, askAbout: i === 4 ? "the bulk import on that day" : null,
      })),
    },
    identity: { accounts: Math.min(3, s.tools), bindings: Array.from({ length: Math.min(3, s.tools) }, () => Math.floor(r() * 2 ** 48).toString(16).padStart(12, "0")) },
    exclusions: { tools: 0, projects: 0, sessions: 0 },
  };
  const json = jcs(value);
  return { schema: "aiprof/2", value, json, bytes: Buffer.byteLength(json) };
}

/** Synthetic exhibits for a persona: a deny-by-default copy in the real flow, plain numbers here. */
export function personaExhibits(kind: Persona): Record<string, unknown> {
  const r = seeded(SCALE[kind].seed + 1);
  const days = SCALE[kind].weeks;
  return {
    a: { window: "detail", n: days * 3, hours: Array.from({ length: 24 }, () => Math.round(r() * 30)) },
    c: { window: "detail", n: days, loop: Array.from({ length: Math.min(days, 30) }, () => ({ edits: Math.round(r() * 40), checks: Math.round(r() * 20) })) },
    e: { window: "detail", n: days, then: Math.round(r() * 100), now: Math.round(r() * 100) },
  };
}

/** The createdAt every persona bundle carries: 2026-11-18T10:42:07Z. */
export const PERSONA_CREATED_AT = Date.UTC(2026, 10, 18, 10, 42, 7);

/** A persona's export assembled and signed: unbound by default, signed by testSigner(), with no fingerprints until Task 9. */
export function personaBundle(kind: Persona, o: { invite?: Invite | null; name?: string; signer?: Signer } = {}): { bundle: SignedBundle; bytes: Uint8Array } {
  const signer = o.signer ?? testSigner();
  const unsigned = assemble({
    exported: personaExport(kind),
    invite: o.invite ?? null,
    name: o.name ?? null,
    exhibits: personaExhibits(kind),
    fingerprints: [],
    exclusions: { tools: 0, projects: 0, sessions: 0 },
    signer,
    createdAt: PERSONA_CREATED_AT,
  });
  const bundle = signBundle(unsigned, signer);
  return { bundle, bytes: bundleBytes(bundle) };
}

/**
 * A persona bundle bound to an invite and sealed to its sealTo: by default the V6 invite (sealed to VEC.bob, the
 * testCompany X25519 key) and VEC.alice as the ephemeral key, so the bytes are the same on every run.
 */
export function sealedPersonaBundle(
  kind: Persona,
  o: { invite?: Invite; name?: string; signer?: Signer; ephemeral?: XKey } = {},
): { bundle: SignedBundle; sealed: SealedBundle; bytes: Uint8Array } {
  const invite = o.invite ?? v6Invite();
  if (invite.sealTo === null) throw new Error("the invite has no sealTo");
  const { bundle } = personaBundle(kind, { invite, name: o.name, signer: o.signer });
  const sealed = sealBundle(bundle, invite.sealTo, { ephemeral: o.ephemeral ?? VEC.alice });
  return { bundle, sealed, bytes: sealedBytes(sealed) };
}
