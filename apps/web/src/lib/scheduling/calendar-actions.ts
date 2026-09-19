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
import { requireSchedulingAccess } from "@/lib/scheduling/access";
import { logger } from "@/lib/observability/logger";

import {
  getPublishedVersionCount,
  getScheduleShifts,
  getScheduleValidationContext,
  type CalendarShift,
} from "./queries";
import { validateEdits, type EditShift, type ValidationContext } from "./validation";
import { publishGate } from "./publish";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { assignedEmployeeIds, planReminders } from "./delivery";

export type CalendarActionResult = { ok: true } | { ok: false; message: string };

const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const CALENDAR_PATH = "/scheduling/calendar";

/** Resolve + authorize the manager. Returns the org/user or an error result. */
async function requireManager(): Promise<
  { ok: true; orgId: string; userId: string } | { ok: false; message: string }
> {
  const access = await requireSchedulingAccess();
  if (!access.ok) return access;
  if (access.activeOrg.role !== "owner" && access.activeOrg.role !== "admin") {
    return { ok: false, message: "Only an owner or admin can edit a schedule." };
  }
  return { ok: true, orgId: access.activeOrg.id, userId: access.user.id };
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

type LoadedSchedule = {
  status: string;
  periodStart: string;
  periodEnd: string;
  shifts: CalendarShift[];
  ctx: ValidationContext;
};

/** The schedule a shift belongs to + its status + current shifts + ctx. */
async function loadSchedule(scheduleId: string, orgId: string): Promise<LoadedSchedule | null> {
  const supabase = await createClient();
  const { data: sched } = await supabase
    .from("schedules")
    .select("status, period_start, period_end")
    .eq("id", scheduleId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!sched) return null;
  const periodStart = sched.period_start as string;
  const periodEnd = sched.period_end as string;
  const [shifts, ctx] = await Promise.all([
    getScheduleShifts(scheduleId),
    getScheduleValidationContext(orgId, periodStart, periodEnd),
  ]);
  return { status: sched.status as string, periodStart, periodEnd, shifts, ctx };
}

const REOPEN_TO_EDIT = "Reopen the schedule before editing it.";

/** A schedule's status, or null if it no longer exists. */
async function scheduleStatusOf(scheduleId: string, orgId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("schedules")
    .select("status")
    .eq("id", scheduleId)
    .eq("org_id", orgId)
    .maybeSingle();
  return (data?.status as string | undefined) ?? null;
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

/**
 * Audit a calendar mutation (service-role; the log is write-restricted). Always
 * stamps `schedule_id` into `detail` so the Day-51 history reader can gather every
 * event for a schedule (including its shifts) via `detail->>schedule_id`.
 */
async function audit(
  orgId: string,
  userId: string,
  action: string,
  opts: {
    entityType: "schedule" | "shift";
    entityId: string;
    scheduleId: string;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("scheduling_audit_log").insert({
      org_id: orgId,
      actor_type: "manager",
      actor_id: userId,
      action,
      entity_type: opts.entityType,
      entity_id: opts.entityId,
      detail: { schedule_id: opts.scheduleId, ...(opts.detail ?? {}) },
    });
  } catch (err) {
    logger.error("calendar audit failed", { err, action, entityId: opts.entityId });
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
    .eq("org_id", auth.orgId)
    .maybeSingle();
  if (!shiftRow) return { ok: false, message: "That shift no longer exists." };
  if (shiftRow.locked) return { ok: false, message: "Unlock the shift before changing it." };

  const loaded = await loadSchedule(shiftRow.schedule_id as string, auth.orgId);
  if (!loaded) return { ok: false, message: "That schedule no longer exists." };
  if (loaded.status !== "draft") return { ok: false, message: REOPEN_TO_EDIT };

  const next = loaded.shifts.map((s) =>
    s.id === args.shiftId ? { ...toEditShift(s), employeeId: args.employeeId } : toEditShift(s),
  );
  const blocked = checkNoNewHardViolation(loaded.shifts, next, loaded.ctx);
  if (blocked) return { ok: false, message: blocked };

  const { error } = await supabase
    .from("shifts")
    .update({ employee_id: args.employeeId, status: args.employeeId ? "draft" : "open" })
    .eq("id", args.shiftId)
    .eq("org_id", auth.orgId);
  if (error) {
    logger.error("assignShift: update failed", { err: error, shiftId: args.shiftId });
    return { ok: false, message: "Couldn't save the change. Please try again." };
  }

  // The shift is no longer open → expire any outstanding replacement offers so
  // they can't linger as 'offered' (e.g. a manager reopened a published schedule
  // and assigned a shift while a replacement was mid-flight). The atomic claim +
  // escalation paths already expire offers; this covers the manual-assign path.
  // Best-effort: a transient failure here must not fail the assignment itself.
  if (args.employeeId) {
    const admin = createAdminClient();
    const { error: expErr } = await admin
      .from("replacement_pool_events")
      .update({ status: "expired", responded_at: new Date().toISOString() })
      .eq("shift_id", args.shiftId)
      .eq("org_id", auth.orgId)
      .eq("status", "offered");
    if (expErr) logger.warn("assignShift: expire stale offers failed", { err: expErr, shiftId: args.shiftId });
  }

  await audit(auth.orgId, auth.userId, "shift.assigned", {
    entityType: "shift",
    entityId: args.shiftId,
    scheduleId: shiftRow.schedule_id as string,
    detail: { employee_id: args.employeeId },
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
    .eq("org_id", auth.orgId)
    .maybeSingle();
  if (!shiftRow) return { ok: false, message: "That shift no longer exists." };
  if (shiftRow.locked) return { ok: false, message: "Unlock the shift before changing it." };

  const loaded = await loadSchedule(shiftRow.schedule_id as string, auth.orgId);
  if (!loaded) return { ok: false, message: "That schedule no longer exists." };
  if (loaded.status !== "draft") return { ok: false, message: REOPEN_TO_EDIT };

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
    .eq("id", args.shiftId)
    .eq("org_id", auth.orgId);
  if (error) {
    logger.error("updateShiftTimes: update failed", { err: error, shiftId: args.shiftId });
    return { ok: false, message: "Couldn't save the change. Please try again." };
  }

  await audit(auth.orgId, auth.userId, "shift.retimed", {
    entityType: "shift",
    entityId: args.shiftId,
    scheduleId: shiftRow.schedule_id as string,
    detail: { starts_at: args.startsAt, ends_at: args.endsAt, break_minutes: breakMinutes },
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
  if (loaded.status !== "draft") return { ok: false, message: REOPEN_TO_EDIT };

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

  await audit(auth.orgId, auth.userId, "shift.added", {
    entityType: "shift",
    entityId: inserted.id as string,
    scheduleId: args.scheduleId,
    detail: { employee_id: args.employeeId },
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
    .select("id, schedule_id, locked")
    .eq("id", args.shiftId)
    .eq("org_id", auth.orgId)
    .maybeSingle();
  if (!shiftRow) return { ok: true }; // already gone
  if (shiftRow.locked) return { ok: false, message: "Unlock the shift before deleting it." };
  if ((await scheduleStatusOf(shiftRow.schedule_id as string, auth.orgId)) !== "draft") {
    return { ok: false, message: REOPEN_TO_EDIT };
  }

  const { error } = await supabase.from("shifts").delete().eq("id", args.shiftId);
  if (error) {
    logger.error("deleteShift: delete failed", { err: error, shiftId: args.shiftId });
    return { ok: false, message: "Couldn't delete the shift. Please try again." };
  }

  await audit(auth.orgId, auth.userId, "shift.deleted", {
    entityType: "shift",
    entityId: args.shiftId,
    scheduleId: shiftRow.schedule_id as string,
  });
  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}

/**
 * Clear every unlocked shift from a draft schedule in one action (the
 * calendar's "Clear schedule" button, behind an are-you-sure dialog). Locked
 * shifts are pinned on purpose and survive the sweep, consistent with the
 * single-shift delete refusing locked shifts. Draft-only, like every edit.
 */
export async function clearSchedule(args: { scheduleId: string }): Promise<CalendarActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  if (!args.scheduleId) return { ok: false, message: "Missing schedule." };
  if ((await scheduleStatusOf(args.scheduleId, auth.orgId)) !== "draft") {
    return { ok: false, message: REOPEN_TO_EDIT };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shifts")
    .delete()
    .eq("schedule_id", args.scheduleId)
    .eq("org_id", auth.orgId)
    .eq("locked", false)
    .select("id");
  if (error) {
    logger.error("clearSchedule: delete failed", { err: error, scheduleId: args.scheduleId });
    return { ok: false, message: "Couldn't clear the schedule. Please try again." };
  }

  await audit(auth.orgId, auth.userId, "schedule.cleared", {
    entityType: "schedule",
    entityId: args.scheduleId,
    scheduleId: args.scheduleId,
    detail: { removedShifts: (data ?? []).length },
  });
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
  const { data: shiftRow } = await supabase
    .from("shifts")
    .select("id, schedule_id")
    .eq("id", args.shiftId)
    .eq("org_id", auth.orgId)
    .maybeSingle();
  if (!shiftRow) return { ok: false, message: "That shift no longer exists." };
  if ((await scheduleStatusOf(shiftRow.schedule_id as string, auth.orgId)) !== "draft") {
    return { ok: false, message: REOPEN_TO_EDIT };
  }

  const { error } = await supabase
    .from("shifts")
    .update({ locked: args.locked })
    .eq("id", args.shiftId)
    .eq("org_id", auth.orgId);
  if (error) {
    logger.error("toggleShiftLock: update failed", { err: error, shiftId: args.shiftId });
    return { ok: false, message: "Couldn't update the lock. Please try again." };
  }

  await audit(auth.orgId, auth.userId, args.locked ? "shift.locked" : "shift.unlocked", {
    entityType: "shift",
    entityId: args.shiftId,
    scheduleId: shiftRow.schedule_id as string,
  });
  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}

/**
 * Day 55 — manually kick off the replacement engine for an open shift (e.g. a
 * published shift left uncovered, or one a manager just opened). Broadcasts the
 * open shift to every eligible employee; first-accept-wins via the atomic RPC.
 * Same engine the Day-54 sick-call auto-fires.
 */
export async function findReplacement(args: { shiftId: string }): Promise<CalendarActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  if (!args.shiftId) return { ok: false, message: "Missing shift." };

  const supabase = await createClient();
  const { data: shiftRow } = await supabase
    .from("shifts")
    .select("id, status, employee_id, schedule_id")
    .eq("id", args.shiftId)
    .eq("org_id", auth.orgId)
    .maybeSingle();
  if (!shiftRow) return { ok: false, message: "That shift no longer exists." };
  if (shiftRow.status !== "open" || shiftRow.employee_id !== null) {
    return { ok: false, message: "Only an open, unfilled shift can be sent out for replacement." };
  }

  const { openReplacement } = await import("./replacement");
  const admin = createAdminClient();
  const result = await openReplacement(admin, { shiftId: args.shiftId, orgId: auth.orgId });
  if (!result.ok) return { ok: false, message: result.message };

  await audit(auth.orgId, auth.userId, "replacement.requested", {
    entityType: "shift",
    entityId: args.shiftId,
    scheduleId: shiftRow.schedule_id as string,
    detail: { offered: result.offered, outcome: result.status },
  });
  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}

/** Day 56 — manager approves an escalated shift swap (applies it atomically). */
export async function approveSwap(args: { requestId: string }): Promise<CalendarActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  if (!args.requestId) return { ok: false, message: "Missing swap." };

  const { approveSwap: approveSwapEngine } = await import("./swaps");
  const admin = createAdminClient();
  const result = await approveSwapEngine(admin, {
    orgId: auth.orgId,
    requestId: args.requestId,
    reviewerUserId: auth.userId,
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}

/** Day 56 — manager denies an escalated (or pending) shift swap. */
export async function denySwap(args: { requestId: string }): Promise<CalendarActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  if (!args.requestId) return { ok: false, message: "Missing swap." };

  const { denySwap: denySwapEngine } = await import("./swaps");
  const admin = createAdminClient();
  const result = await denySwapEngine(admin, {
    orgId: auth.orgId,
    requestId: args.requestId,
    reviewerUserId: auth.userId,
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}

/** Day 57 — manager approves a pending time-off request. */
export async function approveTimeOff(args: { requestId: string }): Promise<CalendarActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  if (!args.requestId) return { ok: false, message: "Missing request." };

  const { approveTimeOff: approveEngine } = await import("./time-off");
  const result = await approveEngine(createAdminClient(), {
    orgId: auth.orgId,
    requestId: args.requestId,
    reviewerUserId: auth.userId,
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}

/** Day 57 — manager denies a pending time-off request. */
export async function denyTimeOff(args: { requestId: string }): Promise<CalendarActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  if (!args.requestId) return { ok: false, message: "Missing request." };

  const { denyTimeOff: denyEngine } = await import("./time-off");
  const result = await denyEngine(createAdminClient(), {
    orgId: auth.orgId,
    requestId: args.requestId,
    reviewerUserId: auth.userId,
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}

/** Day 57 — manager reverses an already-approved (incl. auto-approved) time-off request. */
export async function reverseTimeOff(args: { requestId: string }): Promise<CalendarActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  if (!args.requestId) return { ok: false, message: "Missing request." };

  const { reverseTimeOff: reverseEngine } = await import("./time-off");
  const result = await reverseEngine(createAdminClient(), {
    orgId: auth.orgId,
    requestId: args.requestId,
    reviewerUserId: auth.userId,
  });
  if (!result.ok) return { ok: false, message: result.message };
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

/**
 * Publish a draft schedule: gate on constraints, snapshot the shift set as a
 * `published` version, flip the schedule + its shifts to published, and audit it.
 * Hard violations always block; open shifts / soft warnings need `override`.
 */
export async function publishSchedule(args: {
  scheduleId: string;
  override?: boolean;
  note?: string;
}): Promise<CalendarActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  if (!args.scheduleId) return { ok: false, message: "Missing schedule." };

  const loaded = await loadSchedule(args.scheduleId, auth.orgId);
  if (!loaded) return { ok: false, message: "That schedule no longer exists." };
  if (loaded.status === "published") return { ok: false, message: "This schedule is already published." };

  const violations = validateEdits(loaded.shifts.map(toEditShift), loaded.ctx);
  const openShiftCount = loaded.shifts.filter((s) => s.employeeId === null).length;
  const gate = publishGate(violations, openShiftCount, args.override === true);
  if (!gate.allowed) return { ok: false, message: gate.blockReason ?? "Can't publish yet." };

  const supabase = await createClient();
  const publishedAt = new Date().toISOString();

  // 1. Flip the schedule to published.
  const { error: schedErr } = await supabase
    .from("schedules")
    .update({ status: "published", published_at: publishedAt, updated_at: publishedAt })
    .eq("id", args.scheduleId)
    .eq("org_id", auth.orgId);
  if (schedErr) {
    logger.error("publishSchedule: schedule update failed", { err: schedErr, scheduleId: args.scheduleId });
    return { ok: false, message: "Couldn't publish the schedule. Please try again." };
  }

  // 2. Flip assigned draft shifts to published (open shifts stay open).
  const { error: shiftErr } = await supabase
    .from("shifts")
    .update({ status: "published" })
    .eq("schedule_id", args.scheduleId)
    .eq("org_id", auth.orgId)
    .eq("status", "draft");
  if (shiftErr) {
    logger.error("publishSchedule: shifts update failed", { err: shiftErr, scheduleId: args.scheduleId });
  }

  // 3. Immutable snapshot of the published shift set as a version.
  const versionNumber = (await getPublishedVersionCount(args.scheduleId)) + 1;
  const label = `published-v${versionNumber}`;
  const assignments = loaded.shifts.map((s) => ({
    employeeId: s.employeeId,
    roleId: s.roleId,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    breakMinutes: s.breakMinutes,
    locked: s.locked,
  }));
  const { error: versionErr } = await supabase.from("schedule_versions").insert({
    org_id: auth.orgId,
    schedule_id: args.scheduleId,
    source: "published",
    label,
    assignments,
    covered: openShiftCount === 0,
    total_missing: openShiftCount,
    note: args.note && args.note.trim().length > 0 ? args.note.trim() : null,
  });
  if (versionErr) {
    logger.error("publishSchedule: version insert failed", { err: versionErr, scheduleId: args.scheduleId });
  }

  await audit(auth.orgId, auth.userId, "schedule.published", {
    entityType: "schedule",
    entityId: args.scheduleId,
    scheduleId: args.scheduleId,
    detail: { version: label, override: args.override === true, open_shifts: openShiftCount },
  });

  // 4. Deliver (best-effort — never block the publish): ensure each assigned
  //    employee has a live portal token (reuse if present, else mint via the
  //    owner/admin-gated RPC), clear this schedule's stale pending jobs, then
  //    enqueue a delivery email now + a reminder 24h before each upcoming shift.
  try {
    const admin = createAdminClient();
    const employeeIds = assignedEmployeeIds(loaded.shifts);

    for (const employeeId of employeeIds) {
      const { data: tok } = await supabase
        .from("employee_portal_tokens")
        .select("id")
        .eq("employee_id", employeeId)
        .is("revoked_at", null)
        .limit(1)
        .maybeSingle();
      if (!tok) {
        await supabase.rpc("issue_portal_token", { p_employee_id: employeeId });
      }
    }

    await admin
      .from("jobs")
      .delete()
      .in("type", ["schedule-delivery", "shift-reminder"])
      .eq("status", "pending")
      .eq("org_id", auth.orgId)
      .eq("payload->>scheduleId", args.scheduleId);

    for (const employeeId of employeeIds) {
      await enqueueJob(admin, {
        type: "schedule-delivery",
        payload: { employeeId, orgId: auth.orgId, scheduleId: args.scheduleId },
        orgId: auth.orgId,
      });
    }
    for (const r of planReminders(loaded.shifts, Date.now())) {
      await enqueueJob(admin, {
        type: "shift-reminder",
        payload: {
          shiftId: r.shiftId,
          employeeId: r.employeeId,
          orgId: auth.orgId,
          scheduleId: args.scheduleId,
        },
        orgId: auth.orgId,
        runAt: r.runAt,
      });
    }

    await audit(auth.orgId, auth.userId, "schedule.delivered", {
      entityType: "schedule",
      entityId: args.scheduleId,
      scheduleId: args.scheduleId,
      detail: { employees: employeeIds.length },
    });
  } catch (err) {
    logger.error("publishSchedule: delivery enqueue failed", { err, scheduleId: args.scheduleId });
  }

  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}

/** Reopen a published schedule for edits (published → draft). */
export async function reopenSchedule(args: { scheduleId: string }): Promise<CalendarActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  if (!args.scheduleId) return { ok: false, message: "Missing schedule." };

  const supabase = await createClient();
  const { data: sched } = await supabase
    .from("schedules")
    .select("status")
    .eq("id", args.scheduleId)
    .eq("org_id", auth.orgId)
    .maybeSingle();
  if (!sched) return { ok: false, message: "That schedule no longer exists." };
  if (sched.status !== "published") return { ok: false, message: "Only a published schedule can be reopened." };

  const { error } = await supabase
    .from("schedules")
    .update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("id", args.scheduleId)
    .eq("org_id", auth.orgId);
  if (error) {
    logger.error("reopenSchedule: update failed", { err: error, scheduleId: args.scheduleId });
    return { ok: false, message: "Couldn't reopen the schedule. Please try again." };
  }

  await audit(auth.orgId, auth.userId, "schedule.reopened", {
    entityType: "schedule",
    entityId: args.scheduleId,
    scheduleId: args.scheduleId,
  });
  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}
