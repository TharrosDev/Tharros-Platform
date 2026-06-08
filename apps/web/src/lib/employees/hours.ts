/**
 * Day 52 — pure hours-worked aggregation for the employee profile.
 *
 * "Hours worked" = the net hours of an employee's PUBLISHED shifts over a window
 * (there's no clock-in data yet — the published schedule is the source of truth).
 * Pure + no `server-only` so the read layer assembles the rows and this stays
 * unit-testable. Time convention is the project-wide local-wall-clock-as-UTC.
 */

import { shiftHours } from "@/lib/scheduling/labor-rules";

/** Minimal shift shape this needs — a subset of the `shifts` row. */
export type HoursShift = {
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
};

export type HoursSummary = {
  totalHours: number;
  /** Per ISO-week net hours, oldest first. */
  weeks: { week: string; hours: number }[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** ISO-week key ("YYYY-Www") for an instant, read in UTC (local-as-UTC). */
function isoWeekKey(iso: string): string {
  const ms = Date.parse(iso);
  const d = new Date(ms);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayOfWeek = date.getUTCDay() || 7; // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Total + per-week net worked hours across the given shifts. */
export function summarizeHours(shifts: HoursShift[]): HoursSummary {
  const byWeek = new Map<string, number>();
  let total = 0;
  for (const s of shifts) {
    const h = shiftHours({ employeeId: null, ...s });
    total += h;
    const week = isoWeekKey(s.startsAt);
    byWeek.set(week, (byWeek.get(week) ?? 0) + h);
  }
  const weeks = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, hours]) => ({ week, hours: round2(hours) }));
  return { totalHours: round2(total), weeks };
}
