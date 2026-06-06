/**
 * Day 42 — Labor-rules engine (pure, deterministic).
 *
 * Stateless constraint checks over a set of shifts + a {@link LaborRules} ruleset.
 * No I/O, no `server-only` — fully unit-testable and reused wholesale by the
 * Day-46 solver and by shift-swap / replacement-eligibility checks.
 *
 * **NOT a jurisdiction-compliance engine** — it enforces whatever configurable
 * constraints the ruleset carries (see `presets.ts` for the disclaimer).
 *
 * ## Time semantics
 * Timestamps are treated as instants. Calendar-day grouping and time-of-day
 * comparisons (minor window) use **UTC** accessors, so callers should express
 * shift times in the business's wall clock (i.e. local-time-as-UTC) to get
 * local-day semantics. A shift is attributed to the calendar day of its *start*.
 */

import type { EmployeeContext, LaborRules, ShiftInput, Violation } from "./types";

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

function parseInstant(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid timestamp: ${iso}`);
  }
  return ms;
}

/** Net worked hours: elapsed time minus the unpaid break. */
export function shiftHours(shift: ShiftInput): number {
  const elapsed = (parseInstant(shift.endsAt) - parseInstant(shift.startsAt)) / MS_PER_HOUR;
  return elapsed - shift.breakMinutes / 60;
}

/** Whole-day number (days since epoch, UTC) used for adjacency + grouping. */
function dayNumber(iso: string): number {
  return Math.floor(parseInstant(iso) / MS_PER_DAY);
}

/** Minutes since midnight (UTC) — for the minor start/end window. */
function minutesOfDay(iso: string): number {
  const d = new Date(parseInstant(iso));
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** "HH:MM[:SS]" → minutes since midnight. */
function timeStringToMinutes(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

/** ISO-week key ("YYYY-Www") for an instant, for weekly aggregation. */
function isoWeekKey(iso: string): string {
  // Shift to the Thursday of the current week, then count weeks from year start.
  const d = new Date(parseInstant(iso));
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayOfWeek = date.getUTCDay() || 7; // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Assigned shifts only (open shifts have no employee), grouped by employee id. */
function groupByEmployee(shifts: ShiftInput[]): Map<string, ShiftInput[]> {
  const byEmployee = new Map<string, ShiftInput[]>();
  for (const shift of shifts) {
    if (shift.employeeId === null) continue;
    const list = byEmployee.get(shift.employeeId);
    if (list) list.push(shift);
    else byEmployee.set(shift.employeeId, [shift]);
  }
  return byEmployee;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Sum net hours per (employee, calendar day). */
function dailyHours(shifts: ShiftInput[]): Map<number, number> {
  const totals = new Map<number, number>();
  for (const shift of shifts) {
    const day = dayNumber(shift.startsAt);
    totals.set(day, (totals.get(day) ?? 0) + shiftHours(shift));
  }
  return totals;
}

/** Sum net hours per (employee, ISO week). */
function weeklyHours(shifts: ShiftInput[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const shift of shifts) {
    const week = isoWeekKey(shift.startsAt);
    totals.set(week, (totals.get(week) ?? 0) + shiftHours(shift));
  }
  return totals;
}

/** Hard: per-day worked hours exceed the daily cap. */
export function validateMaxDailyHours(shifts: ShiftInput[], rules: LaborRules): Violation[] {
  const violations: Violation[] = [];
  for (const [employeeId, list] of groupByEmployee(shifts)) {
    for (const [, hours] of dailyHours(list)) {
      if (round2(hours) > rules.max_daily_hours) {
        violations.push({
          rule: "max_daily_hours",
          severity: "hard",
          employeeId,
          message: `Scheduled ${round2(hours)}h in a day, over the ${rules.max_daily_hours}h daily maximum.`,
          details: { hours: round2(hours), max: rules.max_daily_hours },
        });
      }
    }
  }
  return violations;
}

/** Hard: per-week worked hours exceed the weekly cap. */
export function validateMaxWeeklyHours(shifts: ShiftInput[], rules: LaborRules): Violation[] {
  const violations: Violation[] = [];
  for (const [employeeId, list] of groupByEmployee(shifts)) {
    for (const [week, hours] of weeklyHours(list)) {
      if (round2(hours) > rules.max_weekly_hours) {
        violations.push({
          rule: "max_weekly_hours",
          severity: "hard",
          employeeId,
          message: `Scheduled ${round2(hours)}h in week ${week}, over the ${rules.max_weekly_hours}h weekly maximum.`,
          details: { week, hours: round2(hours), max: rules.max_weekly_hours },
        });
      }
    }
  }
  return violations;
}

/** Soft: per-week worked hours cross the overtime threshold (a flag, not a cap). */
export function validateOvertimeThreshold(shifts: ShiftInput[], rules: LaborRules): Violation[] {
  const violations: Violation[] = [];
  for (const [employeeId, list] of groupByEmployee(shifts)) {
    for (const [week, hours] of weeklyHours(list)) {
      if (round2(hours) > rules.overtime_threshold_weekly) {
        violations.push({
          rule: "overtime_threshold",
          severity: "soft",
          employeeId,
          message: `${round2(hours)}h in week ${week} exceeds the ${rules.overtime_threshold_weekly}h overtime threshold.`,
          details: { week, hours: round2(hours), threshold: rules.overtime_threshold_weekly },
        });
      }
    }
  }
  return violations;
}

/** Hard: gap between an employee's consecutive shifts is under the rest minimum. */
export function validateMinRest(shifts: ShiftInput[], rules: LaborRules): Violation[] {
  const violations: Violation[] = [];
  for (const [employeeId, list] of groupByEmployee(shifts)) {
    const sorted = [...list].sort((a, b) => parseInstant(a.startsAt) - parseInstant(b.startsAt));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const gap = (parseInstant(curr.startsAt) - parseInstant(prev.endsAt)) / MS_PER_HOUR;
      if (round2(gap) < rules.min_rest_hours_between_shifts) {
        violations.push({
          rule: "min_rest_between_shifts",
          severity: "hard",
          employeeId,
          shiftId: curr.id,
          message: `Only ${round2(gap)}h rest before the next shift; ${rules.min_rest_hours_between_shifts}h required.`,
          details: { restHours: round2(gap), min: rules.min_rest_hours_between_shifts },
        });
      }
    }
  }
  return violations;
}

/** Soft: an employee works more consecutive calendar days than allowed. */
export function validateMaxConsecutiveDays(shifts: ShiftInput[], rules: LaborRules): Violation[] {
  const violations: Violation[] = [];
  for (const [employeeId, list] of groupByEmployee(shifts)) {
    const days = [...new Set(list.map((s) => dayNumber(s.startsAt)))].sort((a, b) => a - b);
    let run = days.length > 0 ? 1 : 0;
    let longest = run;
    for (let i = 1; i < days.length; i++) {
      run = days[i] === days[i - 1] + 1 ? run + 1 : 1;
      if (run > longest) longest = run;
    }
    if (longest > rules.max_consecutive_days) {
      violations.push({
        rule: "max_consecutive_days",
        severity: "soft",
        employeeId,
        message: `Works ${longest} consecutive days, over the ${rules.max_consecutive_days}-day maximum.`,
        details: { consecutiveDays: longest, max: rules.max_consecutive_days },
      });
    }
  }
  return violations;
}

/** Hard: minor-specific daily-hour cap + start/end time window. */
export function validateMinorRestrictions(
  shifts: ShiftInput[],
  rules: LaborRules,
  employeesById: Map<string, EmployeeContext>,
): Violation[] {
  const violations: Violation[] = [];
  for (const [employeeId, list] of groupByEmployee(shifts)) {
    if (!employeesById.get(employeeId)?.isMinor) continue;

    if (rules.minor_max_daily_hours !== null) {
      for (const [, hours] of dailyHours(list)) {
        if (round2(hours) > rules.minor_max_daily_hours) {
          violations.push({
            rule: "minor_max_daily_hours",
            severity: "hard",
            employeeId,
            message: `Minor scheduled ${round2(hours)}h in a day, over the ${rules.minor_max_daily_hours}h minor daily maximum.`,
            details: { hours: round2(hours), max: rules.minor_max_daily_hours },
          });
        }
      }
    }

    const earliest = rules.minor_earliest_start
      ? timeStringToMinutes(rules.minor_earliest_start)
      : null;
    const latest = rules.minor_latest_end ? timeStringToMinutes(rules.minor_latest_end) : null;
    if (earliest === null && latest === null) continue;

    for (const shift of list) {
      const startMin = minutesOfDay(shift.startsAt);
      const endMin = minutesOfDay(shift.endsAt);
      const crossesMidnight = dayNumber(shift.endsAt) !== dayNumber(shift.startsAt);
      const tooEarly = earliest !== null && startMin < earliest;
      const tooLate = latest !== null && (crossesMidnight || endMin > latest);
      if (tooEarly || tooLate) {
        violations.push({
          rule: "minor_hours_window",
          severity: "hard",
          employeeId,
          shiftId: shift.id,
          message: `Minor shift falls outside the permitted ${rules.minor_earliest_start ?? "—"}–${rules.minor_latest_end ?? "—"} window.`,
          details: {
            earliest: rules.minor_earliest_start,
            latest: rules.minor_latest_end,
            tooEarly,
            tooLate,
          },
        });
      }
    }
  }
  return violations;
}

/**
 * Run every check and aggregate the violations. The single entry point the
 * solver / swap / replacement layers call. `employees` only needs to cover the
 * minors; non-minors are validated by the general rules regardless.
 */
export function validateLaborRules(
  shifts: ShiftInput[],
  rules: LaborRules,
  employees: EmployeeContext[] = [],
): Violation[] {
  const employeesById = new Map(employees.map((e) => [e.id, e]));
  return [
    ...validateMaxDailyHours(shifts, rules),
    ...validateMaxWeeklyHours(shifts, rules),
    ...validateOvertimeThreshold(shifts, rules),
    ...validateMinRest(shifts, rules),
    ...validateMaxConsecutiveDays(shifts, rules),
    ...validateMinorRestrictions(shifts, rules, employeesById),
  ];
}
