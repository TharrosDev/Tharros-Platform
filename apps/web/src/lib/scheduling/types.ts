/**
 * Day 42 — Labor-rules engine domain types.
 *
 * Pure types only (no `server-only`) so the engine and its tests can import them
 * freely. `LaborRules` mirrors the Day-41 `labor_rules` row; the engine reads a
 * ruleset plus minimal shift/employee context and emits {@link Violation}s reused
 * by the Day-46 solver, shift-swap, and replacement-eligibility checks.
 */

/** Preset identifiers — match the `labor_rules.preset` CHECK constraint. */
export type LaborRulePreset = "ontario" | "canada_federal" | "custom";

/**
 * One ruleset per org. Numeric columns are `number` here; PostgREST may hand
 * `numeric` back as a string, so {@link normalizeLaborRules} coerces on read.
 * `time` columns are `"HH:MM"` / `"HH:MM:SS"` strings (or null when unset).
 */
export type LaborRules = {
  org_id: string;
  preset: LaborRulePreset;
  max_daily_hours: number;
  max_weekly_hours: number;
  min_rest_hours_between_shifts: number;
  overtime_threshold_weekly: number;
  max_consecutive_days: number;
  minor_max_daily_hours: number | null;
  minor_earliest_start: string | null;
  minor_latest_end: string | null;
  params: Record<string, unknown>;
  updated_at: string;
};

/** The tunable subset of a ruleset — what a preset defines (no identity/metadata). */
export type LaborRuleParams = Omit<LaborRules, "org_id" | "preset" | "params" | "updated_at">;

/**
 * Minimal shift the engine needs. `employeeId` null = open (unassigned) shift,
 * which the engine skips for per-employee rules. Timestamps are ISO strings
 * (timestamptz from the `shifts` table); `breakMinutes` is unpaid break subtracted
 * from worked hours.
 */
export type ShiftInput = {
  /** Optional — used to attribute violations back to a specific shift. */
  id?: string;
  employeeId: string | null;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
};

/** Only the employee fields the rules depend on. Extend as later rules need more. */
export type EmployeeContext = {
  id: string;
  isMinor: boolean;
};

/** Identifies which rule produced a violation. */
export type LaborRuleKey =
  | "max_daily_hours"
  | "max_weekly_hours"
  | "min_rest_between_shifts"
  | "overtime_threshold"
  | "max_consecutive_days"
  | "minor_max_daily_hours"
  | "minor_hours_window";

/**
 * `hard` = a constraint a valid schedule must not break (solver rejects).
 * `soft` = a flag/warning the solver may weigh but need not avoid.
 */
export type ViolationSeverity = "hard" | "soft";

export type Violation = {
  rule: LaborRuleKey;
  severity: ViolationSeverity;
  message: string;
  employeeId?: string;
  shiftId?: string;
  details?: Record<string, unknown>;
};
