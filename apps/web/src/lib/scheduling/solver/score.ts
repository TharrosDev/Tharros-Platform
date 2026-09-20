/**
 * Day 46 — pure soft-objective scoring for the solver.
 *
 * Lower total cost = better. The score is recomputed in full for each candidate
 * solution (schedules for a small business are small, so a clean full recompute
 * beats error-prone marginal deltas and keeps the search deterministic).
 *
 * Components (each weighted by {@link SolverWeights}):
 *  - coverage gap   — dominant penalty per unfilled required head
 *  - hour target    — deviation from each employee's target + soft min/max breaches
 *  - fairness       — variance of assigned hours across the roster
 *  - seniority      — favors assigning more-senior (lower-rank) employees
 *  - performance    — favors assigning higher-performing employees
 *  - labor soft     — count of soft labor-rule flags (overtime, consecutive days)
 */

import { shiftHours, validateLaborRules } from "../labor-rules";
import type { EmployeeContext, ShiftInput } from "../types";
import type {
  Assignment,
  RequiredHead,
  ScoreBreakdown,
  SolverEmployee,
  SolverInput,
} from "./types";
import { DEFAULT_SOLVER_WEIGHTS } from "./types";

/** Unranked employees sort as fairly junior; tuned low so it never beats coverage. */
const NEUTRAL_RANK = 100;
/** Performance is on an open numeric scale; neutral baseline for unscored staff. */
const PERF_NEUTRAL = 0;

/** Build the labor-engine shift for one head assigned to `employeeId` (null = open). */
export function headToShift(head: RequiredHead, employeeId: string | null): ShiftInput {
  return {
    id: head.key,
    employeeId,
    startsAt: head.slot.startsAt,
    endsAt: head.slot.endsAt,
    breakMinutes: head.slot.breakMinutes,
  };
}

/** Filled shifts for the current assignment (open heads omitted). */
export function filledShifts(heads: RequiredHead[], assignment: (string | null)[]): ShiftInput[] {
  const shifts: ShiftInput[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (assignment[i] !== null) shifts.push(headToShift(heads[i], assignment[i]));
  }
  return shifts;
}

/** All heads as shifts, including open ones (employeeId null) — the solver output. */
export function allShifts(heads: RequiredHead[], assignment: (string | null)[]): ShiftInput[] {
  return heads.map((h, i) => headToShift(h, assignment[i]));
}

/** The Assignment[] view of the current state. */
export function toAssignments(heads: RequiredHead[], assignment: (string | null)[]): Assignment[] {
  return heads.map((h, i) => ({
    key: h.key,
    slotId: h.slotId,
    headIndex: h.headIndex,
    employeeId: assignment[i],
    startsAt: h.slot.startsAt,
    endsAt: h.slot.endsAt,
    roleId: h.slot.roleId,
    breakMinutes: h.slot.breakMinutes,
  }));
}

function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
}

/**
 * Score a full assignment. `heads`/`assignment` are parallel arrays; entry i is
 * the employee id assigned to head i (or null for an open head).
 */
export function scoreSolution(
  input: SolverInput,
  heads: RequiredHead[],
  assignment: (string | null)[],
): ScoreBreakdown {
  const weights = input.weights ?? DEFAULT_SOLVER_WEIGHTS;
  const byId = new Map<string, SolverEmployee>(input.employees.map((e) => [e.id, e]));

  // Hours per employee (assigned heads + any locked shifts they already hold).
  const hours = new Map<string, number>();
  for (const e of input.employees) hours.set(e.id, 0);
  for (const s of input.lockedShifts ?? []) {
    if (s.employeeId !== null)
      hours.set(s.employeeId, (hours.get(s.employeeId) ?? 0) + shiftHours(s));
  }
  let gapCount = 0;
  for (let i = 0; i < heads.length; i++) {
    const empId = assignment[i];
    if (empId === null) {
      gapCount++;
      continue;
    }
    hours.set(empId, (hours.get(empId) ?? 0) + shiftHours(headToShift(heads[i], empId)));
  }

  const gap = gapCount * weights.coverageGapPenalty;

  let hourTarget = 0;
  for (const e of input.employees) {
    const h = hours.get(e.id) ?? 0;
    if (e.targetHoursWeekly !== null) hourTarget += Math.abs(h - e.targetHoursWeekly);
    if (e.minHoursWeekly !== null && h < e.minHoursWeekly) hourTarget += e.minHoursWeekly - h;
    if (e.maxHoursWeekly !== null && h > e.maxHoursWeekly) hourTarget += h - e.maxHoursWeekly;
  }
  hourTarget *= weights.hourTarget;

  const fairness = variance(input.employees.map((e) => hours.get(e.id) ?? 0)) * weights.fairness;

  let seniority = 0;
  let performance = 0;
  for (let i = 0; i < heads.length; i++) {
    const empId = assignment[i];
    if (empId === null) continue;
    const e = byId.get(empId);
    seniority += e?.seniorityRank ?? NEUTRAL_RANK;
    performance += -(e?.performanceScore ?? PERF_NEUTRAL);
  }
  seniority *= weights.seniority;
  performance *= weights.performance;

  const empCtx: EmployeeContext[] = input.employees.map((e) => ({ id: e.id, isMinor: e.isMinor }));
  const shifts = [...(input.lockedShifts ?? []), ...filledShifts(heads, assignment)];
  const softCount = validateLaborRules(shifts, input.laborRules, empCtx).filter(
    (v) => v.severity === "soft",
  ).length;
  const laborSoft = softCount * weights.laborSoft;

  const total = gap + hourTarget + fairness + seniority + performance + laborSoft;
  return {
    total,
    breakdown: { gap, hourTarget, fairness, seniority, performance, laborSoft },
  };
}
