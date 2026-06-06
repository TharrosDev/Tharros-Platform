/**
 * Day 46 — Deterministic scheduling solver: domain types.
 *
 * Pure types only (no `server-only`) so the engine, its tests, and the
 * input-assembly layer can import them freely. The solver consumes a
 * {@link SolverInput} (employees + concrete coverage slots + the Day-42 ruleset)
 * and emits a {@link SolverResult}: shift assignments, a gap report the agent
 * layer iterates on (Day 48), a soft-objective score, and a hard-violation
 * self-check (expected empty — the engine is correct by construction).
 *
 * ## Time convention (load-bearing)
 * All timestamps are ISO strings expressed as **local wall-clock as if UTC**
 * (e.g. local 09:00 → `2026-06-08T09:00:00Z`), matching the Day-42 labor engine,
 * which groups by calendar day / time-of-day with UTC accessors. The solver feeds
 * its shifts straight into {@link validateLaborRules}, so it MUST follow the same
 * convention.
 */

import type { LaborRules, ShiftInput, Violation } from "../types";
import type { PermanentRow, TemporaryRow } from "../queries";

export type EmploymentType = "full_time" | "part_time" | "casual" | "contract";

/** An employee as the solver sees them — roster attributes + resolved availability. */
export type SolverEmployee = {
  id: string;
  isMinor: boolean;
  employmentType: EmploymentType;
  /** Lower = more senior; null = unranked (treated as junior for the soft objective). */
  seniorityRank: number | null;
  /** Soft hour objectives (per scheduling period in v1, not strictly per ISO week). */
  targetHoursWeekly: number | null;
  minHoursWeekly: number | null;
  maxHoursWeekly: number | null;
  /** Higher = better; null = unscored (treated as neutral). */
  performanceScore: number | null;
  /** Role/certification ids the employee holds and that are valid for the period. */
  roleIds: string[];
  /** Whitelist availability (Day-44 model): permanent weekly grid + dated overrides. */
  permanent: PermanentRow[];
  temporary: TemporaryRow[];
};

/**
 * One concrete coverage need — a single staffing requirement instance on a real
 * calendar date. `requiredStaff` heads must each be filled by a distinct employee.
 */
export type CoverageSlot = {
  id: string;
  /** Calendar day (YYYY-MM-DD) the slot belongs to. */
  date: string;
  /** ISO local-as-UTC start/end of the window to cover. */
  startsAt: string;
  endsAt: string;
  /** Required role/certification id, or null = any employee qualifies. */
  roleId: string | null;
  requiredStaff: number;
  /** Unpaid break subtracted from worked hours for each shift on this slot. */
  breakMinutes: number;
};

/** Tunable soft-objective weights. Higher = the solver tries harder on that axis. */
export type SolverWeights = {
  hourTarget: number;
  fairness: number;
  seniority: number;
  performance: number;
  /** Dominant penalty per unfilled required head — keeps coverage the priority. */
  coverageGapPenalty: number;
  /** Penalty per soft labor-rule flag (overtime threshold, consecutive days). */
  laborSoft: number;
};

export const DEFAULT_SOLVER_WEIGHTS: SolverWeights = {
  hourTarget: 1,
  fairness: 0.5,
  seniority: 0.25,
  performance: 0.25,
  coverageGapPenalty: 1000,
  laborSoft: 50,
};

export type SolverInput = {
  employees: SolverEmployee[];
  /** Concrete coverage slots over the scheduling period (already date-expanded). */
  slots: CoverageSlot[];
  laborRules: LaborRules;
  /** Optional override; falls back to {@link DEFAULT_SOLVER_WEIGHTS}. */
  weights?: SolverWeights;
  /** Pre-existing fixed shifts (e.g. already-published) the solver works around. */
  lockedShifts?: ShiftInput[];
};

/**
 * One required head — the atomic unit the solver assigns. A slot needing N staff
 * expands into N heads. Exposed so the scorer and tests share the representation.
 */
export type RequiredHead = {
  /** Stable key `${slotId}#${headIndex}` — used as the shift id. */
  key: string;
  slotId: string;
  headIndex: number;
  slot: CoverageSlot;
};

/** A solved (or unfilled) head. `employeeId` null = an open shift / coverage gap. */
export type Assignment = {
  key: string;
  slotId: string;
  headIndex: number;
  employeeId: string | null;
  startsAt: string;
  endsAt: string;
  roleId: string | null;
  breakMinutes: number;
};

/** Per-slot coverage outcome — what the agent orchestrator reads to iterate. */
export type GapReportEntry = {
  slotId: string;
  date: string;
  roleId: string | null;
  required: number;
  filled: number;
  missing: number;
  /** Plain-language why a gap remains (no qualified / none available / blocked). */
  reason: string;
};

export type ScoreBreakdown = {
  total: number;
  breakdown: Record<string, number>;
};

export type SolverResult = {
  /** Every head as a shift (employeeId null = open shift). Day-49 persists these. */
  shifts: ShiftInput[];
  assignments: Assignment[];
  gapReport: GapReportEntry[];
  score: ScoreBreakdown;
  /** Self-check: hard violations in the final solution. Expected empty. */
  hardViolations: Violation[];
};
