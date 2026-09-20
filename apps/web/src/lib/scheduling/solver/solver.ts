/**
 * Day 46 — the deterministic scheduling solver (the reliable engine).
 *
 * A two-phase heuristic: greedy construction (most-constrained head first, best
 * marginal soft-score employee) followed by deterministic best-improvement local
 * search (reassign + pairwise swap) until no move helps. No randomness — the same
 * input always yields the same output.
 *
 * Correct by construction: an employee is only assigned to a head when doing so
 * keeps every HARD constraint — role/cert match, availability (whitelist), no
 * double-booking, and no hard labor-rule violation. Coverage is the dominant SOFT
 * objective: if no legal employee exists the head is left open and surfaced in the
 * gap report rather than forcing an illegal assignment. Soft labor flags
 * (overtime, consecutive days) are weighed, not forbidden.
 *
 * Exposed as the `solve_schedule` agent tool (see ./tool); Day 47 feeds it inputs
 * and Day 48 orchestrates it against the gap report.
 */

import { validateLaborRules } from "../labor-rules";
import type { EmployeeContext, ShiftInput, Violation } from "../types";
import { isAvailable } from "./availability";
import { allShifts, filledShifts, scoreSolution, toAssignments } from "./score";
import type {
  CoverageSlot,
  GapReportEntry,
  RequiredHead,
  SolverEmployee,
  SolverInput,
  SolverResult,
} from "./types";

/** Safety cap on local-search rounds — convergence is normally far quicker. */
const MAX_LOCAL_SEARCH_ROUNDS = 200;

/** Expand each slot's `requiredStaff` into individual heads (the unit of assignment). */
export function expandHeads(slots: CoverageSlot[]): RequiredHead[] {
  const heads: RequiredHead[] = [];
  for (const slot of slots) {
    for (let i = 0; i < slot.requiredStaff; i++) {
      heads.push({ key: `${slot.id}#${i}`, slotId: slot.id, headIndex: i, slot });
    }
  }
  return heads;
}

/** Role/cert gate: a null slot role means anyone qualifies. */
function roleMatch(slot: CoverageSlot, employee: SolverEmployee): boolean {
  return slot.roleId === null || employee.roleIds.includes(slot.roleId);
}

/** Employees who could *ever* take a head (role + availability), in input order. */
function eligibleFor(head: RequiredHead, employees: SolverEmployee[]): SolverEmployee[] {
  return employees.filter((e) => roleMatch(head.slot, e) && isAvailable(e, head.slot));
}

/** Per-head eligibility lists, parallel to `heads`. Exposed for direct testing. */
export function buildEligibility(
  employees: SolverEmployee[],
  heads: RequiredHead[],
): SolverEmployee[][] {
  return heads.map((h) => eligibleFor(h, employees));
}

/** Per-employee overlap (double-booking) check over a set of shifts. */
function overlapViolations(shifts: ShiftInput[]): Violation[] {
  const byEmployee = new Map<string, ShiftInput[]>();
  for (const s of shifts) {
    if (s.employeeId === null) continue;
    const list = byEmployee.get(s.employeeId);
    if (list) list.push(s);
    else byEmployee.set(s.employeeId, [s]);
  }
  const violations: Violation[] = [];
  for (const [employeeId, list] of byEmployee) {
    const sorted = [...list].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    for (let i = 1; i < sorted.length; i++) {
      if (Date.parse(sorted[i].startsAt) < Date.parse(sorted[i - 1].endsAt)) {
        violations.push({
          rule: "max_daily_hours", // nearest existing key; double-booking is structural
          severity: "hard",
          employeeId,
          shiftId: sorted[i].id,
          message: "Employee is double-booked across overlapping shifts.",
          details: { kind: "double_booking" },
        });
      }
    }
  }
  return violations;
}

/** Every hard violation in the current (filled) assignment, incl. locked shifts. */
function hardViolationsOf(
  input: SolverInput,
  heads: RequiredHead[],
  assignment: (string | null)[],
): Violation[] {
  const shifts = [...(input.lockedShifts ?? []), ...filledShifts(heads, assignment)];
  const empCtx: EmployeeContext[] = input.employees.map((e) => ({ id: e.id, isMinor: e.isMinor }));
  const labor = validateLaborRules(shifts, input.laborRules, empCtx).filter(
    (v) => v.severity === "hard",
  );
  return [...labor, ...overlapViolations(shifts)];
}

/** Is the current assignment free of hard violations? */
function isLegal(
  input: SolverInput,
  heads: RequiredHead[],
  assignment: (string | null)[],
): boolean {
  return hardViolationsOf(input, heads, assignment).length === 0;
}

/**
 * Deterministic ordering for greedy construction: fewest eligible employees first
 * (most-constrained), then earliest start, then a stable id tiebreak.
 */
function constructionOrder(heads: RequiredHead[], eligible: SolverEmployee[][]): number[] {
  return heads
    .map((_, i) => i)
    .sort((a, b) => {
      const byEligible = eligible[a].length - eligible[b].length;
      if (byEligible !== 0) return byEligible;
      const byStart = Date.parse(heads[a].slot.startsAt) - Date.parse(heads[b].slot.startsAt);
      if (byStart !== 0) return byStart;
      return heads[a].key < heads[b].key ? -1 : heads[a].key > heads[b].key ? 1 : 0;
    });
}

/** Greedy: fill each head (most-constrained first) with the best legal employee. */
export function greedyAssign(
  input: SolverInput,
  heads: RequiredHead[],
  eligible: SolverEmployee[][],
): (string | null)[] {
  const assignment: (string | null)[] = heads.map(() => null);
  for (const i of constructionOrder(heads, eligible)) {
    let best: string | null = null;
    let bestScore = Infinity;
    for (const e of eligible[i]) {
      assignment[i] = e.id;
      if (!isLegal(input, heads, assignment)) continue;
      const score = scoreSolution(input, heads, assignment).total;
      if (score < bestScore) {
        bestScore = score;
        best = e.id;
      }
    }
    assignment[i] = best;
  }
  return assignment;
}

/**
 * Deterministic best-improvement local search: repeatedly apply the single
 * reassign or pairwise swap that most lowers the score while staying legal, until
 * none does (or the round cap is hit). Exposed for direct testing.
 */
export function localSearch(
  input: SolverInput,
  heads: RequiredHead[],
  eligible: SolverEmployee[][],
  start: (string | null)[],
): (string | null)[] {
  const assignment = [...start];
  for (let round = 0; round < MAX_LOCAL_SEARCH_ROUNDS; round++) {
    let bestScore = scoreSolution(input, heads, assignment).total;
    let move: (() => void) | null = null;

    // Single reassignments (includes filling an open head).
    for (let i = 0; i < heads.length; i++) {
      const current = assignment[i];
      for (const e of eligible[i]) {
        if (e.id === current) continue;
        assignment[i] = e.id;
        if (isLegal(input, heads, assignment)) {
          const score = scoreSolution(input, heads, assignment).total;
          if (score < bestScore) {
            bestScore = score;
            const target = e.id;
            move = () => {
              assignment[i] = target;
            };
          }
        }
        assignment[i] = current;
      }
    }

    // Pairwise swaps between two filled heads.
    for (let i = 0; i < heads.length; i++) {
      const ei = assignment[i];
      if (ei === null) continue;
      for (let j = i + 1; j < heads.length; j++) {
        const ej = assignment[j];
        if (ej === null || ej === ei) continue;
        const iCanTakeEj = eligible[i].some((e) => e.id === ej);
        const jCanTakeEi = eligible[j].some((e) => e.id === ei);
        if (!iCanTakeEj || !jCanTakeEi) continue;
        assignment[i] = ej;
        assignment[j] = ei;
        if (isLegal(input, heads, assignment)) {
          const score = scoreSolution(input, heads, assignment).total;
          if (score < bestScore) {
            bestScore = score;
            move = () => {
              assignment[i] = ej;
              assignment[j] = ei;
            };
          }
        }
        assignment[i] = ei;
        assignment[j] = ej;
      }
    }

    if (!move) break;
    move();
  }
  return assignment;
}

/** Per-slot gap report — what the agent orchestrator (Day 48) iterates on. */
function buildGapReport(
  input: SolverInput,
  slots: CoverageSlot[],
  heads: RequiredHead[],
  assignment: (string | null)[],
): GapReportEntry[] {
  const filledBySlot = new Map<string, number>();
  for (let i = 0; i < heads.length; i++) {
    if (assignment[i] !== null) {
      filledBySlot.set(heads[i].slotId, (filledBySlot.get(heads[i].slotId) ?? 0) + 1);
    }
  }
  return slots.map((slot) => {
    const filled = filledBySlot.get(slot.id) ?? 0;
    const missing = slot.requiredStaff - filled;
    let reason = "Coverage met.";
    if (missing > 0) {
      const qualified = input.employees.filter((e) => roleMatch(slot, e));
      const available = qualified.filter((e) => isAvailable(e, slot));
      if (qualified.length === 0) reason = "No employee holds the required role.";
      else if (available.length === 0)
        reason = "No qualified employee is available for this window.";
      else reason = "Qualified, available staff were exhausted or blocked by labor limits.";
    }
    return {
      slotId: slot.id,
      date: slot.date,
      roleId: slot.roleId,
      required: slot.requiredStaff,
      filled,
      missing,
      reason,
    };
  });
}

/**
 * Solve the schedule. `localSearch` defaults on; tests can disable it to compare
 * the greedy baseline against the improved solution.
 */
export function solveSchedule(
  input: SolverInput,
  opts: { localSearch?: boolean } = {},
): SolverResult {
  const useLocalSearch = opts.localSearch ?? true;
  const heads = expandHeads(input.slots);
  const eligible = heads.map((h) => eligibleFor(h, input.employees));

  let assignment = greedyAssign(input, heads, eligible);
  if (useLocalSearch) assignment = localSearch(input, heads, eligible, assignment);

  return {
    shifts: allShifts(heads, assignment),
    assignments: toAssignments(heads, assignment),
    gapReport: buildGapReport(input, input.slots, heads, assignment),
    score: scoreSolution(input, heads, assignment),
    hardViolations: hardViolationsOf(input, heads, assignment),
  };
}
