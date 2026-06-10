/**
 * Day 59 — derived scheduling-analytics math. Pure (no `server-only`) so it stays
 * unit-testable and importable by client islands. The SQL RPCs
 * (scheduling_analytics_overview / _by_employee) return raw aggregated counts;
 * this module turns them into the percentages + scores the dashboard shows —
 * mirroring the usage-math.ts ↔ ai_usage_summary split.
 *
 * Every metric is null-safe: a window with no data yields 0 totals and a `null`
 * rate (rendered as "—"), never NaN or a divide-by-zero.
 */

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** A rate in [0,1], or null when the denominator is 0 (nothing to measure). */
export function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return round(numerator / denominator, 4);
}

/** Format a 0..1 ratio (or null) as a percent string: 0.8123 → "81%", null → "—". */
export function formatPercent(rate: number | null, dp = 0): string {
  if (rate === null) return "—";
  return `${round(rate * 100, dp)}%`;
}

/* ------------------------------ Org overview ------------------------------ */

/** Raw overview row from `scheduling_analytics_overview` (snake_case, bigints as numbers). */
export type OverviewRaw = {
  assigned_shifts: number;
  open_shifts: number;
  assigned_hours: number;
  open_hours: number;
  sick_calls: number;
  offers: number;
  offers_accepted: number;
  swaps: number;
  time_off: number;
};

export type OrgAnalytics = {
  assignedShifts: number;
  openShifts: number;
  totalShifts: number;
  assignedHours: number;
  openHours: number;
  /** Filled hours ÷ total scheduled hours — how much of the demand is staffed. */
  laborUtilization: number | null;
  /** Filled shifts ÷ total shifts — the schedule's coverage completeness. */
  scheduleEfficiency: number | null;
  /** Replacement offers accepted ÷ offers sent. */
  acceptanceRate: number | null;
  sickCalls: number;
  swaps: number;
  timeOff: number;
  /** Unfilled demand: open shift count + open hours. */
  staffingGap: { openShifts: number; openHours: number };
};

/** Coerce a possibly-string numeric (PostgREST returns `numeric` as a string). */
function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

export function deriveOrgAnalytics(raw: OverviewRaw): OrgAnalytics {
  const assignedShifts = num(raw.assigned_shifts);
  const openShifts = num(raw.open_shifts);
  const assignedHours = round(num(raw.assigned_hours));
  const openHours = round(num(raw.open_hours));
  const totalShifts = assignedShifts + openShifts;
  const totalHours = assignedHours + openHours;

  return {
    assignedShifts,
    openShifts,
    totalShifts,
    assignedHours,
    openHours,
    laborUtilization: ratio(assignedHours, totalHours),
    scheduleEfficiency: ratio(assignedShifts, totalShifts),
    acceptanceRate: ratio(num(raw.offers_accepted), num(raw.offers)),
    sickCalls: num(raw.sick_calls),
    swaps: num(raw.swaps),
    timeOff: num(raw.time_off),
    staffingGap: { openShifts, openHours },
  };
}

/* --------------------------- Per-employee rollup --------------------------- */

export type EmployeeRaw = {
  employee_id: string;
  name: string;
  assigned_shifts: number;
  assigned_hours: number;
  sick_calls: number;
  offers: number;
  offers_accepted: number;
  swaps: number;
  time_off: number;
};

export type EmployeeAnalytics = {
  employeeId: string;
  name: string;
  assignedShifts: number;
  assignedHours: number;
  sickCalls: number;
  swaps: number;
  timeOff: number;
  /** Offers accepted ÷ offers received (null if never offered a replacement). */
  acceptanceRate: number | null;
  /**
   * Attendance reliability in [0,1]: worked shifts ÷ (worked shifts + call-outs).
   * A worker with no scheduled shifts and no call-outs has nothing to score → null.
   */
  reliability: number | null;
};

/** Worked ÷ (worked + sick calls). Null when there's nothing to measure. */
export function attendanceReliability(assignedShifts: number, sickCalls: number): number | null {
  const denom = assignedShifts + sickCalls;
  if (denom <= 0) return null;
  return round(assignedShifts / denom, 4);
}

export function deriveEmployeeAnalytics(raw: EmployeeRaw): EmployeeAnalytics {
  const assignedShifts = num(raw.assigned_shifts);
  const sickCalls = num(raw.sick_calls);
  return {
    employeeId: raw.employee_id,
    name: raw.name,
    assignedShifts,
    assignedHours: round(num(raw.assigned_hours)),
    sickCalls,
    swaps: num(raw.swaps),
    timeOff: num(raw.time_off),
    acceptanceRate: ratio(num(raw.offers_accepted), num(raw.offers)),
    reliability: attendanceReliability(assignedShifts, sickCalls),
  };
}

/** A coarse band for a reliability score, for badge tone. */
export function reliabilityBand(rate: number | null): "good" | "watch" | "poor" | "none" {
  if (rate === null) return "none";
  if (rate >= 0.9) return "good";
  if (rate >= 0.75) return "watch";
  return "poor";
}

/** A shift row as the daily-hours helper needs it (snake_case, straight off the table). */
export type ShiftHoursRow = {
  starts_at: string;
  ends_at: string;
  employee_id: string | null;
  break_minutes: number | null;
};

export type DailyHours = { date: string; hours: number };

/**
 * Net staffed hours per calendar day over a trailing window ending today
 * (UTC date math, matching the schedule's local-as-UTC convention). A shift
 * counts on the day it starts; break minutes come off its net hours; open
 * (unassigned) shifts don't count as staffed. Pure, null-safe.
 */
export function dailyAssignedHours(
  rows: ShiftHoursRow[],
  windowEndDate: string,
  days: number,
): DailyHours[] {
  const end = Date.parse(`${windowEndDate}T00:00:00Z`);
  if (!Number.isFinite(end) || days <= 0) return [];

  const byDate = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    byDate.set(new Date(end - i * 86_400_000).toISOString().slice(0, 10), 0);
  }

  for (const row of rows) {
    if (!row.employee_id) continue;
    const start = Date.parse(row.starts_at);
    const finish = Date.parse(row.ends_at);
    if (!Number.isFinite(start) || !Number.isFinite(finish) || finish <= start) continue;
    const date = row.starts_at.slice(0, 10);
    if (!byDate.has(date)) continue;
    const net = Math.max(0, (finish - start) / 3_600_000 - (row.break_minutes ?? 0) / 60);
    byDate.set(date, (byDate.get(date) ?? 0) + net);
  }

  return [...byDate.entries()].map(([date, hours]) => ({ date, hours: round(hours, 2) }));
}
