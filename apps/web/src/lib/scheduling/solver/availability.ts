/**
 * Day 46 — pure availability resolution (the Day-44 whitelist model).
 *
 * Whitelist semantics: an employee can work a slot only if a permanent weekly
 * row OR a dated temporary override grants it. An unmarked weekday = unavailable.
 *
 * Precedence: a temporary override covering the slot's date wins over the
 * permanent grid for that date. Within temporaries, an *unavailable* override
 * that overlaps the slot blocks it (safer to leave off than to over-schedule);
 * otherwise an *available* override whose time window contains the slot grants it.
 * If temporary overrides exist for the date but none grants this slot, the day is
 * treated as off (the employee declared a specific availability that excludes it).
 *
 * Time windows: a null start/end means the whole day. A window `[s, e)` requires
 * the slot to fall entirely inside it. Times are compared as minutes-since-
 * midnight using UTC accessors, matching the local-as-UTC timestamp convention.
 */

import type { CoverageSlot, SolverEmployee } from "./types";
import type { PermanentRow, TemporaryRow } from "../queries";

const MINUTES_PER_DAY = 24 * 60;

/** Calendar weekday (0=Sun..6=Sat) of a YYYY-MM-DD date, read in UTC. */
function dayOfWeek(date: string): number {
  return new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay();
}

/** "HH:MM[:SS]" → minutes since midnight; null → the supplied fallback. */
function timeToMinutes(t: string | null, fallback: number): number {
  if (!t) return fallback;
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

/** Slot start/end as minutes since midnight of the slot's date (end may exceed 1440 if overnight). */
function slotWindow(slot: CoverageSlot): { start: number; end: number } {
  const start = new Date(Date.parse(slot.startsAt));
  const end = new Date(Date.parse(slot.endsAt));
  const startMin = start.getUTCHours() * 60 + start.getUTCMinutes();
  let endMin = end.getUTCHours() * 60 + end.getUTCMinutes();
  // Overnight: the end timestamp lands on a later calendar day.
  if (slot.endsAt.slice(0, 10) > slot.date) endMin += MINUTES_PER_DAY;
  if (endMin <= startMin) endMin += MINUTES_PER_DAY;
  return { start: startMin, end: endMin };
}

/** Does row's [start,end) window fully contain the slot window? */
function windowContains(start: string | null, end: string | null, win: { start: number; end: number }): boolean {
  const ws = timeToMinutes(start, 0);
  const we = timeToMinutes(end, MINUTES_PER_DAY);
  return win.start >= ws && win.end <= we;
}

/** Does row's [start,end) window overlap the slot window at all? */
function windowOverlaps(start: string | null, end: string | null, win: { start: number; end: number }): boolean {
  const ws = timeToMinutes(start, 0);
  const we = timeToMinutes(end, MINUTES_PER_DAY);
  return win.start < we && win.end > ws;
}

/** Does a temporary override's date range include the given date? */
function temporaryCoversDate(row: TemporaryRow, date: string): boolean {
  const end = row.end_date ?? row.effective_date;
  return date >= row.effective_date && date <= end;
}

/**
 * Whether `employee` can work `slot` under the whitelist model. Pure + total.
 */
export function isAvailable(employee: SolverEmployee, slot: CoverageSlot): boolean {
  const win = slotWindow(slot);

  const covering = employee.temporary.filter((t) => temporaryCoversDate(t, slot.date));
  if (covering.length > 0) {
    // An unavailable override overlapping the slot blocks it outright.
    if (covering.some((t) => !t.is_available && windowOverlaps(t.start_time, t.end_time, win))) {
      return false;
    }
    // An available override containing the slot grants it.
    if (covering.some((t) => t.is_available && windowContains(t.start_time, t.end_time, win))) {
      return true;
    }
    // A declared availability exists for this date but excludes this window → off.
    if (covering.some((t) => t.is_available)) return false;
    // Only non-overlapping unavailable rows remain → fall through to the permanent grid.
  }

  const perm: PermanentRow | undefined = employee.permanent.find(
    (p) => p.day_of_week === dayOfWeek(slot.date) && p.is_available,
  );
  return perm ? windowContains(perm.start_time, perm.end_time, win) : false;
}
