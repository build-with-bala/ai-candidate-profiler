// The core's export, as A consumes it. A has no core dependency yet, so these are local structural stand-ins.
// TODO(1b): replace both with re-exports of B's types from ai-practice-report/core (ExportResult, Plan 2 Task 14,
// and ToolId), and add a both-ways assignability check to test/contract/plan2.test.ts.

/** Exactly the shape of B's ExportResult: `value` is the aiprof/2 payload, `json` its JSON text, `bytes` its size. */
export interface ExportedPayload { schema: "aiprof/2"; value: unknown; json: string; bytes: number }

/** A tool id such as "claude-code". TODO(1b): B's ToolId. */
export type ToolId = string;
