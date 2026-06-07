/**
 * Day 48 — the pure hybrid optimize-loop.
 *
 * No `server-only`: every side effect (the solve, audit writes, the LLM advisor
 * copy) is injected via {@link OptimizeIO}, mirroring `agents/turn-loop.ts`'s
 * `TurnLoopIO`. The server-only `orchestrate-handler` wires the real solver, the
 * Day-39 audit trail, and DeepSeek; the fixture tests inject fakes.
 *
 * Control flow is fully deterministic: solve → if covered, done → else take the
 * next conservative remedy from the ladder, re-solve, repeat until coverage is met,
 * the ladder is exhausted, or {@link DEFAULT_MAX_ROUNDS} is hit (a runaway
 * backstop, mirroring the turn-loop's step cap). The advisor only drafts copy for
 * escalations + the summary — it cannot change whether coverage is met.
 */

import type { SolverInput, SolverResult } from "../solver/types";
import { applyRemedy, nextRemedy, selectEscalations, totalMissing } from "./remedies";
import type {
  Escalation,
  OptimizeInput,
  OptimizeResult,
  OptimizeTrace,
  RemedyKind,
  RemedyStep,
} from "./types";

/** Runaway backstop on remedy rounds — the ladder is short, so this is rarely hit. */
export const DEFAULT_MAX_ROUNDS = 6;

export type OptimizeAuditAction =
  | "optimize_started"
  | "solve_attempt"
  | "remedy_applied"
  | "escalation_emitted"
  | "optimize_completed";

export type OptimizeAuditEvent = {
  action: OptimizeAuditAction;
  actor?: "system" | "ai";
  detail?: Record<string, unknown>;
};

/** The injected effects the loop needs. Real impls in the handler; fakes in tests. */
export type OptimizeIO = {
  /** Run the deterministic solver over the current inputs. */
  solve(input: SolverInput): Promise<SolverResult> | SolverResult;
  /** Append one step to the audit trail (best-effort; must never throw). */
  audit(event: OptimizeAuditEvent): Promise<void> | void;
  /** Plain-language copy for an escalation (advisor-backed or a template). */
  draftEscalationMessage(escalation: Escalation): Promise<string> | string;
  /** Plain-language recap of the whole run. */
  summarize(args: {
    covered: boolean;
    trace: OptimizeTrace;
    escalations: Escalation[];
  }): Promise<string> | string;
};

export type RunOptimizeLoopArgs = {
  input: OptimizeInput;
  io: OptimizeIO;
  /** The thread the run is audit-logged to (carried through to the result). */
  threadId?: string | null;
  maxRounds?: number;
};

export async function runOptimizeLoop(args: RunOptimizeLoopArgs): Promise<OptimizeResult> {
  const { io } = args;
  const maxRounds = args.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const threadId = args.threadId ?? null;

  await io.audit({ action: "optimize_started", actor: "system", detail: { maxRounds } });

  let opt = args.input;
  const applied: RemedyKind[] = [];
  const trace: RemedyStep[] = [];

  // Baseline solve.
  let result = await io.solve(opt.solverInput);
  let missing = totalMissing(result.gapReport);
  trace.push({ round: 0, remedy: null, score: result.score.total, totalMissing: missing });
  await io.audit({
    action: "solve_attempt",
    actor: "system",
    detail: { round: 0, score: result.score.total, totalMissing: missing },
  });

  // Remedy rounds.
  let round = 0;
  while (missing > 0 && round < maxRounds) {
    const remedy = nextRemedy(applied, opt);
    if (!remedy) break; // ladder exhausted → escalate
    round += 1;
    const gapsBefore = missing;
    opt = applyRemedy(opt, remedy);
    applied.push(remedy.kind);
    await io.audit({
      action: "remedy_applied",
      actor: "system",
      detail: { round, remedy: remedy.kind, note: remedy.note, gapsBefore },
    });

    result = await io.solve(opt.solverInput);
    missing = totalMissing(result.gapReport);
    trace.push({ round, remedy, score: result.score.total, totalMissing: missing });
    await io.audit({
      action: "solve_attempt",
      actor: "system",
      detail: { round, score: result.score.total, totalMissing: missing, gapsAfter: missing },
    });
  }

  const covered = missing === 0;
  const escalations = covered ? [] : selectEscalations(result.gapReport, opt);
  for (const esc of escalations) {
    esc.draftMessage = await io.draftEscalationMessage(esc);
    await io.audit({
      action: "escalation_emitted",
      actor: "system",
      detail: { kind: esc.kind, slotId: esc.slotId, missing: esc.missing, employees: esc.employeeIds.length },
    });
  }

  const summary = await io.summarize({ covered, trace, escalations });
  await io.audit({
    action: "optimize_completed",
    actor: "system",
    detail: { covered, rounds: round, escalations: escalations.length },
  });

  return {
    threadId,
    schedule: { assignments: result.assignments, shifts: result.shifts },
    gapReport: result.gapReport,
    covered,
    trace,
    escalations,
    summary,
  };
}
