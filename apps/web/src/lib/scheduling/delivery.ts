/**
 * Day 53 — pure planning helpers for schedule delivery + shift reminders.
 *
 * No I/O, no `server-only` — the publish action (which has request auth) uses
 * these to decide what to enqueue into the Day-38 job runtime, and they're
 * unit-tested directly. Shift times are local-wall-clock-as-UTC ISO strings.
 */

/** Reminder lead time before a shift starts (24h). */
export const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;

/** Minimal shift shape these planners need. */
export type DeliveryShift = {
  id: string;
  employeeId: string | null;
  startsAt: string;
};

/** Distinct employee ids that have at least one assigned shift (skips open shifts). */
export function assignedEmployeeIds(shifts: DeliveryShift[]): string[] {
  const seen = new Set<string>();
  for (const s of shifts) {
    if (s.employeeId) seen.add(s.employeeId);
  }
  return [...seen];
}

export type ReminderPlan = {
  shiftId: string;
  employeeId: string;
  /** ISO instant the reminder should fire (shift start − lead). */
  runAt: string;
};

/**
 * One reminder per assigned, still-upcoming shift, firing `leadMs` before it
 * starts. Skips open shifts and any shift whose reminder time is already past
 * (`nowMs`) — no point emailing a reminder for a shift starting within the lead.
 */
export function planReminders(
  shifts: DeliveryShift[],
  nowMs: number,
  leadMs: number = REMINDER_LEAD_MS,
): ReminderPlan[] {
  const plans: ReminderPlan[] = [];
  for (const s of shifts) {
    if (!s.employeeId) continue;
    const startMs = Date.parse(s.startsAt);
    if (Number.isNaN(startMs)) continue;
    const fireMs = startMs - leadMs;
    if (fireMs <= nowMs) continue; // too soon / already past
    plans.push({
      shiftId: s.id,
      employeeId: s.employeeId,
      runAt: new Date(fireMs).toISOString(),
    });
  }
  return plans;
}
