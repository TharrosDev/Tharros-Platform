import "server-only";

/**
 * Day 48 — server-only wiring for the optimize-loop.
 *
 * Wires the real side effects into the pure `runOptimizeLoop`: the deterministic
 * solver (`buildSolverInput` + `solveSchedule`), the Day-39 audit trail
 * (`createThread` on a `kind='schedule_opt'` thread + `recordAuditEvent`), and the
 * DeepSeek advisor (escalation copy + summary + directive nudges), metered into
 * `ai_usage_events`.
 *
 * The orchestrator is a SYSTEM actor, so thread + audit writes use the service-role
 * admin client (no user session in a system run); the solver READS go through the
 * RLS user-session client. Tenancy is enforced in code by scoping to `orgId`.
 *
 * No draft is persisted here — this returns a PREVIEW `OptimizeResult`; Day 49
 * persists the draft + versions.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { recordUsage } from "@/lib/billing/usage";
import { chatCompletion } from "@/lib/deepseek/client";
import { SCHEDULING_MODEL_PRO } from "@/lib/deepseek/models";
import { mapDeepSeekUsage } from "@/lib/deepseek/usage";

import { createThread, touchThread } from "@/lib/agents/threads";
import { recordAuditEvent } from "@/lib/agents/audit";

import { buildSolverInput } from "../solver/build-input";
import { solveSchedule } from "../solver";
import { DEFAULT_SOLVER_WEIGHTS, type SolverInput } from "../solver/types";
import { runOptimizeLoop, type OptimizeIO } from "./orchestrate";
import {
  adviseDirectiveNudges,
  defaultEscalationMessage,
  defaultSummary,
  draftEscalationMessage,
  summarizeOptimization,
  type AdvisorDeps,
} from "./advisor";
import type { AgentInputs, OptimizeInput, OptimizeResult } from "./types";

export type OptimizeScheduleInput = {
  orgId: string;
  userId?: string | null;
  /** Inclusive scheduling period (YYYY-MM-DD). */
  periodStart: string;
  periodEnd: string;
  /** Day-47 agent outputs (intent weights/adjustments/directives) to seed the solve. */
  agentInputs?: AgentInputs;
  /** Skip every LLM call and use deterministic copy (tests / no-AI runs). Default true. */
  useLlm?: boolean;
  maxRounds?: number;
};

/**
 * Apply the Day-47 agent inputs to the freshly-built solver input: merge global
 * weight tweaks, apply per-employee hour adjustments, and record which employees
 * the manager pinned (their caps are deliberate — the remedy ladder won't raise
 * them). Directives are handled separately (advisor nudges).
 */
function applyEmployeeInputs(
  base: SolverInput,
  agent: AgentInputs | undefined,
): { input: SolverInput; pinnedEmployeeIds: string[] } {
  const weights = { ...DEFAULT_SOLVER_WEIGHTS, ...(base.weights ?? {}), ...(agent?.weights ?? {}) };
  const adjustments = agent?.employeeAdjustments ?? [];
  const byId = new Map(adjustments.map((a) => [a.employeeId, a]));

  const employees = base.employees.map((e) => {
    const a = byId.get(e.id);
    if (!a) return e;
    return {
      ...e,
      ...(a.targetHoursWeekly !== undefined ? { targetHoursWeekly: a.targetHoursWeekly } : {}),
      ...(a.minHoursWeekly !== undefined ? { minHoursWeekly: a.minHoursWeekly } : {}),
      ...(a.maxHoursWeekly !== undefined ? { maxHoursWeekly: a.maxHoursWeekly } : {}),
    };
  });

  // A manager who set a max-hours cap meant it — pin those employees.
  const pinnedEmployeeIds = adjustments
    .filter((a) => a.maxHoursWeekly !== undefined)
    .map((a) => a.employeeId);

  return { input: { ...base, weights, employees }, pinnedEmployeeIds };
}

export async function optimizeSchedule(input: OptimizeScheduleInput): Promise<OptimizeResult> {
  const useLlm = input.useLlm ?? true;
  const admin = createAdminClient();
  const supabase = await createClient();

  const advisorDeps: AdvisorDeps = {
    chat: chatCompletion,
    model: SCHEDULING_MODEL_PRO,
    onUsage: (model, usage) =>
      recordUsage(input.orgId, input.userId ?? null, model, mapDeepSeekUsage(usage)),
  };

  // 1. Build the baseline solver input (RLS-scoped reads) + apply agent inputs.
  const base = await buildSolverInput(input.orgId, input.periodStart, input.periodEnd, supabase);
  const { input: seeded, pinnedEmployeeIds } = applyEmployeeInputs(base, input.agentInputs);

  // 2. Interpret non-solver-expressible directives into global weight nudges.
  const directives = input.agentInputs?.directives ?? [];
  let solverInput = seeded;
  if (useLlm && directives.length > 0) {
    const nudge = await adviseDirectiveNudges(
      { directives, currentWeights: seeded.weights },
      advisorDeps,
    );
    if (nudge.weights) {
      const merged = { ...DEFAULT_SOLVER_WEIGHTS, ...seeded.weights, ...nudge.weights };
      // Coverage must stay dominant — never let a nudge weaken it.
      merged.coverageGapPenalty = Math.max(
        merged.coverageGapPenalty,
        DEFAULT_SOLVER_WEIGHTS.coverageGapPenalty,
      );
      solverInput = { ...seeded, weights: merged };
    }
  }

  const optimizeInput: OptimizeInput = { solverInput, pinnedEmployeeIds };

  // 3. Open the audit thread (system-created → no created_by).
  const threadId = await createThread(admin, {
    orgId: input.orgId,
    createdBy: input.userId ?? null,
    kind: "schedule_opt",
    title: `Schedule optimization ${input.periodStart} → ${input.periodEnd}`,
  });

  // 4. Wire the IO seam and run the loop.
  const io: OptimizeIO = {
    solve: (si) => solveSchedule(si),
    audit: (event) =>
      recordAuditEvent(admin, {
        orgId: input.orgId,
        threadId,
        actor: event.actor ?? "system",
        action: event.action,
        detail: event.detail,
      }),
    draftEscalationMessage: (esc) =>
      useLlm ? draftEscalationMessage(esc, advisorDeps) : defaultEscalationMessage(esc),
    summarize: (args) => (useLlm ? summarizeOptimization(args, advisorDeps) : defaultSummary(args)),
  };

  const result = await runOptimizeLoop({
    input: optimizeInput,
    io,
    threadId,
    maxRounds: input.maxRounds,
  });

  if (threadId) await touchThread(admin, threadId);
  return result;
}
