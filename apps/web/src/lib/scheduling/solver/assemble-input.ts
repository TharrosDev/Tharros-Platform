/**
 * Day 46 — pure assembly of raw scheduling rows into a {@link SolverInput}.
 *
 * Kept free of `server-only` and any I/O so it's unit-testable: ./build-input
 * fetches the rows (RLS-scoped) and hands them here. The two jobs that need real
 * logic — and so are tested — live here:
 *   1. **Slot expansion**: recurring (`day_of_week`) and dated (`specific_date`)
 *      staffing requirements are expanded into concrete {@link CoverageSlot}s for
 *      every operating date in the period, skipping closed days.
 *   2. **Cert-expiry filtering**: a role/cert assignment counts only if it has no
 *      expiry or stays valid through the whole period.
 *
 * Times are emitted as local-wall-clock-as-UTC ISO strings (see solver/types).
 */

import type { LaborRules } from "../types";
import type { PermanentRow, TemporaryRow } from "../queries";
import type {
  CoverageSlot,
  EmploymentType,
  SolverEmployee,
  SolverInput,
  SolverWeights,
} from "./types";

export type RawEmployee = {
  id: string;
  is_minor: boolean;
  employment_type: EmploymentType;
  seniority_rank: number | string | null;
  target_hours_weekly: number | string | null;
  min_hours_weekly: number | string | null;
  max_hours_weekly: number | string | null;
  performance_score: number | string | null;
};

export type RawRoleAssignment = {
  employee_id: string;
  role_certification_id: string;
  expires_at: string | null;
};

export type RawAvailability = {
  employee_id: string;
  kind: "permanent" | "temporary";
  day_of_week: number | null;
  effective_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_available: boolean;
};

export type RawBusinessHours = {
  day_of_week: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
};

export type RawStaffing = {
  id: string;
  role_certification_id: string | null;
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
  min_staff: number;
};

export type AssembleSolverInputArgs = {
  /** Inclusive YYYY-MM-DD period bounds. */
  periodStart: string;
  periodEnd: string;
  employees: RawEmployee[];
  roleAssignments: RawRoleAssignment[];
  availability: RawAvailability[];
  businessHours: RawBusinessHours[];
  staffing: RawStaffing[];
  laborRules: LaborRules;
  weights?: SolverWeights;
};

const num = (v: number | string | null): number | null =>
  v === null ? null : typeof v === "string" ? Number(v) : v;

/** Every YYYY-MM-DD from start to end inclusive (UTC date math). */
function datesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const MS_PER_DAY = 86_400_000;
  let cursor = Date.parse(`${start}T00:00:00Z`);
  const last = Date.parse(`${end}T00:00:00Z`);
  while (cursor <= last) {
    out.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += MS_PER_DAY;
  }
  return out;
}

function dayOfWeek(date: string): number {
  return new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay();
}

/** The calendar day after `date` (YYYY-MM-DD, UTC). */
function nextDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/** Normalize a `time` value ("HH:MM" or "HH:MM:SS") to "HH:MM:SS". */
function normalizeTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

/** A timestamp ISO string for `date` at wall-clock `time`, expressed as UTC. */
function localIso(date: string, time: string): string {
  return `${date}T${normalizeTime(time)}Z`;
}

/** Weekdays the org is closed (a closed row and no open row for that weekday). */
function closedWeekdays(hours: RawBusinessHours[]): Set<number> {
  const open = new Set<number>();
  const closed = new Set<number>();
  for (const h of hours) {
    if (h.is_closed) closed.add(h.day_of_week);
    else if (h.opens_at && h.closes_at) open.add(h.day_of_week);
  }
  for (const d of open) closed.delete(d);
  return closed;
}

export function assembleSolverInput(args: AssembleSolverInputArgs): SolverInput {
  // --- employees + resolved availability + valid roles ---------------------
  const rolesByEmployee = new Map<string, string[]>();
  for (const r of args.roleAssignments) {
    // Valid if no expiry, or it does not lapse before the period ends.
    if (r.expires_at !== null && r.expires_at < args.periodEnd) continue;
    const list = rolesByEmployee.get(r.employee_id);
    if (list) list.push(r.role_certification_id);
    else rolesByEmployee.set(r.employee_id, [r.role_certification_id]);
  }

  const permByEmployee = new Map<string, PermanentRow[]>();
  const tempByEmployee = new Map<string, TemporaryRow[]>();
  for (const a of args.availability) {
    if (a.kind === "permanent" && a.day_of_week !== null) {
      const row: PermanentRow = {
        id: "",
        day_of_week: a.day_of_week,
        is_available: a.is_available,
        start_time: a.start_time,
        end_time: a.end_time,
      };
      const list = permByEmployee.get(a.employee_id);
      if (list) list.push(row);
      else permByEmployee.set(a.employee_id, [row]);
    } else if (a.kind === "temporary" && a.effective_date !== null) {
      const row: TemporaryRow = {
        id: "",
        effective_date: a.effective_date,
        end_date: a.end_date,
        is_available: a.is_available,
        start_time: a.start_time,
        end_time: a.end_time,
        notes: null,
      };
      const list = tempByEmployee.get(a.employee_id);
      if (list) list.push(row);
      else tempByEmployee.set(a.employee_id, [row]);
    }
  }

  const employees: SolverEmployee[] = args.employees.map((e) => ({
    id: e.id,
    isMinor: e.is_minor,
    employmentType: e.employment_type,
    seniorityRank: num(e.seniority_rank),
    targetHoursWeekly: num(e.target_hours_weekly),
    minHoursWeekly: num(e.min_hours_weekly),
    maxHoursWeekly: num(e.max_hours_weekly),
    performanceScore: num(e.performance_score),
    roleIds: rolesByEmployee.get(e.id) ?? [],
    permanent: permByEmployee.get(e.id) ?? [],
    temporary: tempByEmployee.get(e.id) ?? [],
  }));

  // --- slot expansion ------------------------------------------------------
  const closed = closedWeekdays(args.businessHours);
  const slots: CoverageSlot[] = [];
  for (const date of datesInRange(args.periodStart, args.periodEnd)) {
    if (closed.has(dayOfWeek(date))) continue;
    for (const req of args.staffing) {
      const matches =
        req.specific_date === date ||
        (req.specific_date === null && req.day_of_week === dayOfWeek(date));
      if (!matches) continue;
      const startsAt = localIso(date, req.start_time);
      // Overnight window (end <= start) rolls into the next calendar day.
      const endDate = req.end_time <= req.start_time ? nextDate(date) : date;
      const endsAt = localIso(endDate, req.end_time);
      slots.push({
        id: `${req.id}@${date}`,
        date,
        startsAt,
        endsAt,
        roleId: req.role_certification_id,
        requiredStaff: req.min_staff,
        breakMinutes: 0,
      });
    }
  }

  return {
    employees,
    slots,
    laborRules: args.laborRules,
    weights: args.weights,
  };
}
