/**
 * Day 48 — Agent orchestrator + optimize-loop: domain types.
 *
 * Pure types only (no `server-only`) so the loop, the remedy ladder, and their
 * fixture tests import freely. The orchestrator wraps the Day-46 solver in an
 * iterate-until-covered-or-escalate loop: it solves, reads the gap report, applies
 * a deterministic, conservative remedy ladder, re-solves, and — when autonomous
 * remedies run out — emits structured {@link Escalation}s for a human. Days 50–54
 * deliver those escalations; Day 49 persists the resulting draft.
 *
 * The loop's control flow + termination are 100% deterministic (same inputs +
 * stubbed advisor → identical {@link OptimizeTrace}). The LLM only drafts
 * human-readable copy and interprets non-solver-expressible directives — neither
 * can change WHETHER coverage is met, only how a gap is explained.
 */

import type { Assignment, GapReportEntry, SolverInput } from "../solver/types";
import type { ShiftInput } from "../types";
import type { IntentTranslation } from "../intent";

/**
 * The Day-47 agent outputs the orchestrator consumes as solver *inputs*. A subset
 * of {@link IntentTranslation}: weight tweaks + per-employee hour adjustments the
 * solver enforces directly, plus directives it can't enforce yet (interpreted by
 * the advisor at baseline assembly, never inside the loop).
 */
export type AgentInputs = Pick<IntentTranslation, "weights" | "employeeAdjustments" | "directives">;

/**
 * The loop's working state: the (copy-on-write) solver inputs plus provenance the
 * remedy ladder needs — which employees' hour caps the MANAGER pinned (so the
 * ladder never auto-overrides a deliberate cap).
 */
export type OptimizeInput = {
  solverInput: SolverInput;
  /** Employee ids whose hour caps came from a manager adjustment — never auto-raised. */
  pinnedEmployeeIds: string[];
};

/** The autonomous, conservative moves the loop may make before escalating, in order. */
export type RemedyKind =
  /** Drop the soft overtime/consecutive-day penalty so the solver may use legal soft OT. */
  | "disable_labor_soft"
  /** Lift unpinned per-employee soft hour caps toward the legal labor ceiling. */
  | "raise_unpinned_max_hours";

export type Remedy = {
  kind: RemedyKind;
  /** Plain-language description of the move, for the audit trail. */
  note: string;
};

/** One solve in the loop — the baseline (remedy null) or a post-remedy re-solve. */
export type RemedyStep = {
  /** 0 = baseline solve; 1..N = after the Nth remedy. */
  round: number;
  /** The remedy applied immediately before this solve (null for the baseline). */
  remedy: Remedy | null;
  /** Solver soft-objective score after this solve (lower = better). */
  score: number;
  /** Total unfilled required heads after this solve (sum of gapReport[].missing). */
  totalMissing: number;
};

export type OptimizeTrace = RemedyStep[];

/** What kind of human help a residual gap needs. Derived from the gap's reason. */
export type EscalationKind =
  /** Staff exist + are available but only legal-overtime-beyond-cap could fill it. */
  | "propose_overtime"
  /** Qualified staff exist but none are available — ask them to add availability. */
  | "request_availability"
  /** Structurally infeasible — no employee holds the required role. */
  | "manager_decision";

export type Escalation = {
  kind: EscalationKind;
  slotId: string;
  date: string;
  roleId: string | null;
  missing: number;
  /** The solver's gap reason that classified this escalation. */
  reason: string;
  /** Relevant employees: OT candidates / who to ask for availability ([] for manager_decision). */
  employeeIds: string[];
  /** Human-readable copy (advisor-drafted, or a deterministic template). */
  draftMessage: string;
};

/** The preview returned to the manager and consumed by Day 49 for persistence. */
export type OptimizeResult = {
  /** The `schedule_opt` thread the run was audit-logged to (null if thread creation failed). */
  threadId: string | null;
  /** The final solve. Day 49 persists these as a draft + versions. */
  schedule: { assignments: Assignment[]; shifts: ShiftInput[] };
  /** Residual per-slot coverage after the loop. */
  gapReport: GapReportEntry[];
  /** True when no slot is short-staffed. */
  covered: boolean;
  /** Ordered solve→remedy→solve history with score + gap deltas. */
  trace: OptimizeTrace;
  /** Structured escalations for the residual gaps (empty when covered). */
  escalations: Escalation[];
  /** Plain-language recap shown to the manager. */
  summary: string;
};
