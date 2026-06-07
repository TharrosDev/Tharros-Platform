"use server";

/**
 * Day 50 — manager edits to a draft schedule from the calendar.
 *
 * Owner/admin only (checked explicitly, like the Day-48/49 actions). Writes to
 * `schedules`/`shifts` go through the user-session client so the Day-41
 * manager-write RLS is the real gate; the `scheduling_audit_log` trail is written
 * via the service-role admin client (that table is service-role-write only).
 *
 * Every edit that changes assignments or times is re-validated server-side with
 * the same {@link validateEdits} the UI runs live: the change is applied
 * in-memory over the schedule's current shifts and rejected if it introduces a
 * NEW hard violation (pre-existing problems don't block an unrelated fix).
 */

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/org/queries";
import { getAuthUser } from "@/lib/auth/current-user";
import { logger } from "@/lib/observability/logger";

import { getScheduleShifts, getScheduleValidationContext, type CalendarShift } from "./queries";
import { validateEdits, type EditShift, type ValidationContext } from "./validation";

export type CalendarActionResult = { ok: true } | { ok: false; message: string };

const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const CALENDAR_PATH = "/scheduling/calendar";

/** Resolve + authorize the manager. Returns the org/user or an error result. */
async function requireManager(): Promise<
  { ok: true; orgId: string; userId: string } | { ok: false; message: string }
> {
  const [user, { activeOrg }] = await Promise.all([getAuthUser(), getOrgContext()]);
  if (!user || !activeOrg) return { ok: false, message: "Not authenticated." };
  if (activeOrg.role !== "owner" && activeOrg.role !== "admin") {
    return { ok: false, message: "Only an owner or admin can edit a schedule." };
  }
  return { ok: true, orgId: activeOrg.id, userId: user.id };
}

/** A CalendarShift as the validator sees it. */
function toEditShift(s: CalendarShift): EditShift {
  return {
    id: s.id,
    employeeId: s.employeeId,
    roleId: s.roleId,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    breakMinutes: s.breakMinutes,
  };
}

/** The schedule a shift belongs to + that schedule's current shifts + ctx. */
async function loadSchedule(
  scheduleId: string,
  orgId: string,
): Promise<{ periodStart: string; periodEnd: string; shifts: CalendarShift[]; ctx: ValidationContext } | null> {
  const supabase = await createClient();
  const { data: sched } = await supabase
    .from("schedules")
    .select("period_start, period_end")
    .eq("id", scheduleId)
    .maybeSingle();
  if (!sched) return null;
  const periodStart = sched.period_start as string;
  const periodEnd = sched.period_end as string;
  const [shifts, ctx] = await Promise.all([
    getScheduleShifts(scheduleId),
    getScheduleValidationContext(orgId, periodStart, periodEnd),
  ]);
  return { periodStart, periodEnd, shifts, ctx };
}

/**
 * Reject if applying `next` (the edited set) introduces a hard violation that
 * wasn't already present in `current`. Returns the first new violation message.
 */
function checkNoNewHardViolation(
  current: CalendarShift[],
  next: EditShift[],
  ctx: ValidationContext,
): string | null {
  const beforeHard = validateEdits(current.map(toEditShift), ctx).filter((v) => v.severity === "hard");
  const afterHard = validateEdits(next, ctx).filter((v) => v.severity === "hard");
  if (afterHard.length > beforeHard.length) {
    // Surface a violation that's new this edit (best-effort: first beyond the prior count).
    const known = new Set(beforeHard.map((v) => `${v.rule}:${v.shiftId ?? ""}:${v.employeeId ?? ""}`));
    const fresh =
      afterHard.find((v) => !known.has(`${v.rule}:${v.shiftId ?? ""}:${v.employeeId ?? ""}`)) ??
      afterHard[afterHard.length - 1];
    return fresh.message;
  }
  return null;
}

/** Audit a calendar mutation (service-role; the log is write-restricted). */
async function audit(
  orgId: string,
  userId: string,
  action: string,
  entityId: string,
  detail: Record<string, unknown>,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("scheduling_audit_log").insert({
      org_id: orgId,
      actor_type: "manager",
      actor_id: userId,
      action,
      entity_type: "shift",
      entity_id: entityId,
      detail,
    });
  } catch (err) {
    logger.error("calendar audit failed", { err, action, entityId });
  }
}

/** Assign a shift to an employee, or clear it (employeeId null → open shift). */
export async function assignShift(args: {
  shiftId: string;
  employeeId: string | null;
}): Promise<CalendarActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  if (!args.shiftId) return { ok: false, message: "Missing shift." };

  const supabase = await createClient();
  const { data: shiftRow } = await supabase
    .from("shifts")
    .select("id, schedule_id, locked")
    .eq("id", args.shiftId)
    .maybeSingle();
  if (!shiftRow) return { ok: false, message: "That shift no longer exists." };
  if (shiftRow.locked) return { ok: false, message: "Unlock the shift before changing it." };

  const loaded = await loadSchedule(shiftRow.schedule_id as string, auth.orgId);
  if (!loaded) return { ok: false, message: "That schedule no longer exists." };

  const next = loaded.shifts.map((s) =>
    s.id === args.shiftId ? { ...toEditShift(s), employeeId: args.employeeId } : toEditShift(s),
  );
  const blocked = checkNoNewHardViolation(loaded.shifts, next, loaded.ctx);
  if (blocked) return { ok: false, message: blocked };

  const { error } = await supabase
    .from("shifts")
    .update({ employee_id: args.employeeId, status: args.employeeId ? "draft" : "open" })
    .eq("id", args.shiftId);
  if (error) {
    logger.error("assignShift: update failed", { err: error, shiftId: args.shiftId });
    return { ok: false, message: "Couldn't save the change. Please try again." };
  }

  await audit(auth.orgId, auth.userId, "shift.assigned", args.shiftId, {
    employee_id: args.employeeId,
  });
  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}

/** Change a shift's start/end/break. */
export async function updateShiftTimes(args: {
  shiftId: string;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
}): Promise<CalendarActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  if (!args.shiftId) return { ok: false, message: "Missing shift." };
  if (!ISO_INSTANT_RE.test(args.startsAt) || !ISO_INSTANT_RE.test(args.endsAt)) {
    return { ok: false, message: "Provide valid shift times." };
  }
  if (args.endsAt <= args.startsAt) {
    return { ok: false, message: "The end time must be after the start time." };
  }
  const breakMinutes = Math.trunc(args.breakMinutes);
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
    return { ok: false, message: "Break minutes can't be negative." };
  }

  const supabase = await createClient();
  const { data: shiftRow } = await supabase
    .from("shifts")
    .select("id, schedule_id, locked")
    .eq("id", args.shiftId)
    .maybeSingle();
  if (!shiftRow) return { ok: false, message: "That shift no longer exists." };
  if (shiftRow.locked) return { ok: false, message: "Unlock the shift before changing it." };

  const loaded = await loadSchedule(shiftRow.schedule_id as string, auth.orgId);
  if (!loaded) return { ok: false, message: "That schedule no longer exists." };

  const next = loaded.shifts.map((s) =>
    s.id === args.shiftId
      ? { ...toEditShift(s), startsAt: args.startsAt, endsAt: args.endsAt, breakMinutes }
      : toEditShift(s),
  );
  const blocked = checkNoNewHardViolation(loaded.shifts, next, loaded.ctx);
  if (blocked) return { ok: false, message: blocked };

  const { error } = await supabase
    .from("shifts")
    .update({ starts_at: args.startsAt, ends_at: args.endsAt, break_minutes: breakMinutes })
    .eq("id", args.shiftId);
  if (error) {
    logger.error("updateShiftTimes: update failed", { err: error, shiftId: args.shiftId });
    return { ok: false, message: "Couldn't save the change. Please try again." };
  }

  await audit(auth.orgId, auth.userId, "shift.retimed", args.shiftId, {
    starts_at: args.startsAt,
    ends_at: args.endsAt,
    break_minutes: breakMinutes,
  });
  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}

/** Add a new shift to a schedule (assigned or left open). */
export async function addShift(args: {
  scheduleId: string;
  startsAt: string;
  endsAt: string;
  roleId: string | null;
  employeeId: string | null;
  breakMinutes?: number;
}): Promise<CalendarActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  if (!args.scheduleId) return { ok: false, message: "Missing schedule." };
  if (!ISO_INSTANT_RE.test(args.startsAt) || !ISO_INSTANT_RE.test(args.endsAt)) {
    return { ok: false, message: "Provide valid shift times." };
  }
  if (args.endsAt <= args.startsAt) {
    return { ok: false, message: "The end time must be after the start time." };
  }
  const breakMinutes = Math.max(0, Math.trunc(args.breakMinutes ?? 0));

  const loaded = await loadSchedule(args.scheduleId, auth.orgId);
  if (!loaded) return { ok: false, message: "That schedule no longer exists." };

  const draft: EditShift = {
    id: "new",
    employeeId: args.employeeId,
    roleId: args.roleId,
    startsAt: args.startsAt,
    endsAt: args.endsAt,
    breakMinutes,
  };
  const next = [...loaded.shifts.map(toEditShift), draft];
  const blocked = checkNoNewHardViolation(loaded.shifts, next, loaded.ctx);
  if (blocked) return { ok: false, message: blocked };

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("shifts")
    .insert({
      org_id: auth.orgId,
      schedule_id: args.scheduleId,
      employee_id: args.employeeId,
      role_certification_id: args.roleId,
      starts_at: args.startsAt,
      ends_at: args.endsAt,
      break_minutes: breakMinutes,
      status: args.employeeId ? "draft" : "open",
    })
    .select("id")
    .single();
  if (error || !inserted) {
    logger.error("addShift: insert failed", { err: error, scheduleId: args.scheduleId });
    return { ok: false, message: "Couldn't add the shift. Please try again." };
  }

  await audit(auth.orgId, auth.userId, "shift.added", inserted.id as string, {
    schedule_id: args.scheduleId,
    employee_id: args.employeeId,
  });
  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}

/** Delete a shift. (Removing coverage can't introduce a hard violation.) */
export async function deleteShift(args: { shiftId: string }): Promise<CalendarActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  if (!args.shiftId) return { ok: false, message: "Missing shift." };

  const supabase = await createClient();
  const { data: shiftRow } = await supabase
    .from("shifts")
    .select("id, locked")
    .eq("id", args.shiftId)
    .maybeSingle();
  if (!shiftRow) return { ok: true }; // already gone
  if (shiftRow.locked) return { ok: false, message: "Unlock the shift before deleting it." };

  const { error } = await supabase.from("shifts").delete().eq("id", args.shiftId);
  if (error) {
    logger.error("deleteShift: delete failed", { err: error, shiftId: args.shiftId });
    return { ok: false, message: "Couldn't delete the shift. Please try again." };
  }

  await audit(auth.orgId, auth.userId, "shift.deleted", args.shiftId, {});
  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}

/** Lock or unlock a shift (pins it against edits + future re-solves). */
export async function toggleShiftLock(args: {
  shiftId: string;
  locked: boolean;
}): Promise<CalendarActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  if (!args.shiftId) return { ok: false, message: "Missing shift." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("shifts")
    .update({ locked: args.locked })
    .eq("id", args.shiftId);
  if (error) {
    logger.error("toggleShiftLock: update failed", { err: error, shiftId: args.shiftId });
    return { ok: false, message: "Couldn't update the lock. Please try again." };
  }

  await audit(auth.orgId, auth.userId, args.locked ? "shift.locked" : "shift.unlocked", args.shiftId, {});
  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}

/** Generate a fresh draft for a period — delegates to the Day-49 panel. */
export async function generateDraftSchedule(args: {
  periodStart: string;
  periodEnd: string;
}): Promise<CalendarActionResult> {
  const { runSchedulePanel } = await import("./panel/panel-actions");
  const res = await runSchedulePanel({ periodStart: args.periodStart, periodEnd: args.periodEnd });
  if (!res.ok) return { ok: false, message: res.message };
  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}
