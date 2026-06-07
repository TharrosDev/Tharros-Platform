import "server-only";

/**
 * Day 46 — `solve_schedule` agent tool: the solver exposed to the agent layer.
 *
 * The orchestrator (Day 48) supplies a period; this loads the org's scheduling
 * data (RLS-scoped via `ctx.supabase`), runs the deterministic solver, and
 * returns the assignments, gap report, and score as JSON. It computes only — it
 * does NOT persist shifts (draft persistence is Day 49). Registered via
 * {@link createSchedulingToolRegistry}; intentionally NOT added to the default
 * RAG/assistant registry.
 */

import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

import type { AgentTool } from "../../agents/tools";
import { createToolRegistry } from "../../agents/tools";
import { buildSolverInput } from "./build-input";
import { solveSchedule } from "./solver";
import { DEFAULT_SOLVER_WEIGHTS } from "./types";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Use a YYYY-MM-DD date." });

const weightsSchema = z
  .object({
    hourTarget: z.number(),
    fairness: z.number(),
    seniority: z.number(),
    performance: z.number(),
    coverageGapPenalty: z.number(),
    laborSoft: z.number(),
  })
  .partial();

export const solveScheduleInputSchema = z.object({
  periodStart: dateString,
  periodEnd: dateString,
  weights: weightsSchema.optional(),
});

export type SolveScheduleInput = z.infer<typeof solveScheduleInputSchema>;

export const SOLVE_SCHEDULE_TOOL: AgentTool<SolveScheduleInput> = {
  definition: {
    name: "solve_schedule",
    description:
      "Run the deterministic scheduling solver over an org's roster, availability, " +
      "coverage requirements, and labor rules for a date period. Returns shift " +
      "assignments, a per-slot gap report (unfilled coverage + why), and a soft-" +
      "objective score. Read-only: it proposes a schedule but does not save it.",
    input_schema: z.toJSONSchema(solveScheduleInputSchema) as Tool["input_schema"],
  },
  handler: async (ctx, input) => {
    const parsed = solveScheduleInputSchema.safeParse(input);
    if (!parsed.success) {
      return { content: `Invalid solve_schedule input: ${z.prettifyError(parsed.error)}`, isError: true };
    }
    if (parsed.data.periodEnd < parsed.data.periodStart) {
      return { content: "periodEnd must be on or after periodStart.", isError: true };
    }

    const weights = parsed.data.weights
      ? { ...DEFAULT_SOLVER_WEIGHTS, ...parsed.data.weights }
      : undefined;
    const solverInput = await buildSolverInput(
      ctx.orgId,
      parsed.data.periodStart,
      parsed.data.periodEnd,
      ctx.supabase,
      weights,
    );
    const result = solveSchedule(solverInput);

    return {
      content: JSON.stringify({
        assignments: result.assignments,
        gapReport: result.gapReport,
        score: result.score,
      }),
    };
  },
};

/** A tool registry seeded with the scheduling tools (Day 48 wires this in). */
export function createSchedulingToolRegistry() {
  return createToolRegistry([SOLVE_SCHEDULE_TOOL]);
}
