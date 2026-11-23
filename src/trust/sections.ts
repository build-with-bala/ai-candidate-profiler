// Builder's call 4: which payload keys a bundle carries. The required keys always ship; each optional section ships
// only when the invite requests it, and an unbound run ships every section. `forensics` never ships in the payload:
// the bundle carries it as `integrity`.
import type { InviteField } from "./invite";

export const REQUIRED_KEYS: readonly string[] = ["schema", "core", "reference", "coverage", "overall", "dimensions", "exclusions"];

/**
 * The payload keys of each optional section. `exhibits` and `fingerprints` are bundle fields, not payload keys.
 * TODO(1b): Task 1 records whether Plan 2 put `otherProjects` at the top level. It is listed under `projects` either
 * way, which changes nothing when the export nests it, since only keys the export has are copied.
 */
export const SECTION_KEYS: Readonly<Record<Exclude<InviteField, "exhibits" | "fingerprints">, readonly string[]>> = {
  config: ["config"],
  exposure: ["exposure"],
  identity: ["identity"],
  personas: ["personas"],
  projects: ["projects", "otherProjects"],
  risk: ["risk"],
  signals: ["signals"],
  stack: ["stack"],
};

const sectionKeys = (f: InviteField): readonly string[] => (f === "exhibits" || f === "fingerprints" ? [] : SECTION_KEYS[f]);

/**
 * REQUIRED_KEYS ∪ the keys of the requested sections, copied from `value`: never `forensics`, nothing undeclared.
 * A required key the export lacks is an Error; a section key it lacks is simply absent.
 */
export function filterPayload(value: Readonly<Record<string, unknown>>, fields: readonly InviteField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of REQUIRED_KEYS) {
    if (!Object.hasOwn(value, key)) throw new Error(`the export has no ${key}`);
    out[key] = value[key];
  }
  for (const f of fields) {
    for (const key of sectionKeys(f)) if (Object.hasOwn(value, key)) out[key] = value[key];
  }
  return out;
}
