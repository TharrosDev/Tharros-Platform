/**
 * Day 48 — the deterministic, conservative remedy ladder + escalation selection.
 *
 * Pure functions (no `server-only`, no I/O, no RNG) so the loop and its fixture
 * tests share them. The ladder only relaxes orchestrator/default soft pressure and
 * never overrides a manager-pinned cap or a hard labor rule, so the solver stays
 * correct-by-construction. When the ladder is exhausted and gaps remain, the gap is
 * genuinely a human decision → {@link selectEscalations} classifies it.
 */

import { isAvailable } from "../solver";
import { DEFAULT_SOLVER_WEIGHTS } from "../solver/types";
import type { CoverageSlot, GapReportEntry, SolverEmployee, SolverWeights } from "../solver/types";
import type { Escalation, EscalationKind, OptimizeInput, Remedy, RemedyKind } from "./types";

/** The ladder, in the order it's tried. Conservative: soft pressure only. */
const LADDER: RemedyKind[] = ["disable_labor_soft", "raise_unpinned_max_hours"];

/** Total unfilled required heads across the gap report. */
export function totalMissing(gapReport: GapReportEntry[]): number {
  return gapReport.reduce((sum, g) => sum + Math.max(0, g.missing), 0);
}

function resolvedWeights(input: OptimizeInput): SolverWeights {
  return { ...DEFAULT_SOLVER_WEIGHTS, ...(input.solverInput.weights ?? {}) };
}

/** Would this remedy actually change the inputs? (Skip no-op rungs.) */
function isApplicable(kind: RemedyKind, input: OptimizeInput): boolean {
  switch (kind) {
    case "disable_labor_soft":
      return resolvedWeights(input).laborSoft > 0;
    case "raise_unpinned_max_hours": {
      const pinned = new Set(input.pinnedEmployeeIds);
      return input.solverInput.employees.some(
        (e) => !pinned.has(e.id) && e.maxHoursWeekly !== null,
      );
    }
  }
}

function noteFor(kind: RemedyKind): string {
  switch (kind) {
    case "disable_labor_soft":
      return "Dropped the soft overtime/consecutive-day penalty so the solver may use legal soft overtime.";
    case "raise_unpinned_max_hours":
      return "Lifted unpinned employees' weekly hour caps toward the legal labor ceiling.";
  }
}

/**
 * The next autonomous remedy to try, or null when the ladder is exhausted (every
 * rung already applied or inapplicable). Caller only invokes this while gaps remain.
 */
export function nextRemedy(applied: RemedyKind[], input: OptimizeInput): Remedy | null {
  const done = new Set(applied);
  for (const kind of LADDER) {
    if (!done.has(kind) && isApplicable(kind, input)) {
      return { kind, note: noteFor(kind) };
    }
  }
  return null;
}

/** Apply a remedy, returning a new {@link OptimizeInput} (copy-on-write; never mutates). */
export function applyRemedy(input: OptimizeInput, remedy: Remedy): OptimizeInput {
  const weights = resolvedWeights(input);

  switch (remedy.kind) {
    case "disable_labor_soft":
      return {
        ...input,
        solverInput: { ...input.solverInput, weights: { ...weights, laborSoft: 0 } },
      };
    case "raise_unpinned_max_hours": {
      const pinned = new Set(input.pinnedEmployeeIds);
      const employees: SolverEmployee[] = input.solverInput.employees.map((e) =>
        pinned.has(e.id) || e.maxHoursWeekly === null ? e : { ...e, maxHoursWeekly: null },
      );
      return { ...input, solverInput: { ...input.solverInput, employees } };
    }
  }
}

const REASON_NO_ROLE = "holds the required role";
const REASON_NO_AVAILABILITY = "available for this window";

/** Classify a residual gap's solver reason into the kind of human help it needs. */
function classify(reason: string): EscalationKind {
  if (reason.includes(REASON_NO_ROLE)) return "manager_decision";
  if (reason.includes(REASON_NO_AVAILABILITY)) return "request_availability";
  // "Qualified, available staff were exhausted or blocked by labor limits."
  return "propose_overtime";
}

/** Employees qualified for a slot (hold the role, or any-staff when roleId is null). */
function qualifiedFor(slot: CoverageSlot, employees: SolverEmployee[]): SolverEmployee[] {
  return employees.filter((e) => slot.roleId === null || e.roleIds.includes(slot.roleId));
}

/**
 * Map each residual gap to a structured escalation with the relevant employee ids.
 * `draftMessage` is left empty here (pure); the loop fills it via the advisor or a
 * deterministic template.
 */
export function selectEscalations(gapReport: GapReportEntry[], input: OptimizeInput): Escalation[] {
  const slotsById = new Map(input.solverInput.slots.map((s) => [s.id, s]));
  const escalations: Escalation[] = [];

  for (const gap of gapReport) {
    if (gap.missing <= 0) continue;
    const kind = classify(gap.reason);
    const slot = slotsById.get(gap.slotId);

    let employeeIds: string[] = [];
    if (slot) {
      const qualified = qualifiedFor(slot, input.solverInput.employees);
      if (kind === "request_availability") {
        // Qualified people who could add availability for this window.
        employeeIds = qualified.map((e) => e.id);
      } else if (kind === "propose_overtime") {
        // Qualified AND available people — the legal OT candidates.
        employeeIds = qualified.filter((e) => isAvailable(e, slot)).map((e) => e.id);
      }
    }

    escalations.push({
      kind,
      slotId: gap.slotId,
      date: gap.date,
      roleId: gap.roleId,
      missing: gap.missing,
      reason: gap.reason,
      employeeIds,
      draftMessage: "",
    });
  }

  return escalations;
}
