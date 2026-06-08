import { createElement } from "react";

import type { Job, JobHandler } from "@/lib/jobs/types";
import { logger } from "@/lib/observability/logger";

/**
 * Day 53 — schedule-delivery + shift-reminder job handlers (Phase 3 / 3F).
 *
 * Both run as a system actor on the admin client and read the employee's live
 * portal token (`employee_portal_tokens`, newest un-revoked) to build the magic
 * link — the publish action guarantees one exists. Idempotent + safe to re-run:
 * the reminder no-ops if the shift was cancelled/reassigned. Server-only deps are
 * dynamically imported in the body so the jobs registry stays Vitest-importable.
 */

const PORTAL_NEXT = "/portal/schedule";

type EmployeeRow = { name: string; email: string; active: boolean; org_id: string };

/** Read the employee's live portal link, or null if none. */
async function livePortalUrl(
  admin: import("@supabase/supabase-js").SupabaseClient,
  employeeId: string,
  getURL: () => string,
): Promise<string | null> {
  const { data } = await admin
    .from("employee_portal_tokens")
    .select("token")
    .eq("employee_id", employeeId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const token = (data as { token: string } | null)?.token ?? null;
  if (!token) return null;
  return `${getURL()}/portal/enter?token=${encodeURIComponent(token)}&next=${encodeURIComponent(PORTAL_NEXT)}`;
}

async function orgName(
  admin: import("@supabase/supabase-js").SupabaseClient,
  orgId: string,
): Promise<string> {
  const { data } = await admin.from("organizations").select("name").eq("id", orgId).maybeSingle();
  return (data as { name: string } | null)?.name ?? "your team";
}

/** "Mon Jun 15, 9:00 AM – 5:00 PM" from local-as-UTC ISO strings (UTC accessors). */
function shiftLabel(startsAt: string, endsAt: string): string {
  const fmtDay = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const fmtTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
  const s = new Date(Date.parse(startsAt));
  const e = new Date(Date.parse(endsAt));
  return `${fmtDay.format(s)}, ${fmtTime.format(s)} – ${fmtTime.format(e)}`;
}

export const scheduleDeliveryHandler: JobHandler = async (job: Job) => {
  const employeeId = typeof job.payload.employeeId === "string" ? job.payload.employeeId : null;
  const orgId = typeof job.payload.orgId === "string" ? job.payload.orgId : null;
  const scheduleId = typeof job.payload.scheduleId === "string" ? job.payload.scheduleId : null;
  if (!employeeId || !orgId || !scheduleId) {
    throw new Error("schedule-delivery: missing employeeId/orgId/scheduleId in payload");
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: empRow, error: empErr } = await admin
    .from("employees")
    .select("name, email, active, org_id")
    .eq("id", employeeId)
    .maybeSingle();
  if (empErr) throw empErr;
  const employee = empRow as EmployeeRow | null;
  if (!employee || !employee.active) return; // removed/deactivated — stop.

  // Count this employee's published shifts on the schedule (for the email copy).
  const { data: shiftRows, error: shiftErr } = await admin
    .from("shifts")
    .select("starts_at, ends_at")
    .eq("schedule_id", scheduleId)
    .eq("employee_id", employeeId)
    .eq("status", "published")
    .order("starts_at", { ascending: true });
  if (shiftErr) throw shiftErr;
  const shifts = (shiftRows ?? []) as Array<{ starts_at: string; ends_at: string }>;
  if (shifts.length === 0) return; // nothing assigned to them on this schedule.

  const { data: schedRow } = await admin
    .from("schedules")
    .select("period_start, period_end")
    .eq("id", scheduleId)
    .maybeSingle();
  const period = schedRow as { period_start: string; period_end: string } | null;
  const periodLabel = period ? `${period.period_start} to ${period.period_end}` : "the next two weeks";

  const [{ sendEmail }, { getURL }, { ScheduleDeliveryEmail }] = await Promise.all([
    import("@/lib/email/send"),
    import("@/lib/site-url"),
    import("@/lib/email/templates/schedule-delivery"),
  ]);

  const portalUrl = await livePortalUrl(admin, employeeId, getURL);
  if (!portalUrl) {
    logger.warn("schedule-delivery.no_live_token", { employeeId });
    return; // the publish action ensures a token; nothing to send if it's gone.
  }

  const name = await orgName(admin, orgId);
  const sent = await sendEmail({
    to: employee.email,
    subject: `Your ${name} schedule is ready`,
    react: createElement(ScheduleDeliveryEmail, {
      employeeName: employee.name,
      orgName: name,
      portalUrl,
      shiftCount: shifts.length,
      periodLabel,
    }),
  });
  if (!sent.ok) throw new Error(`schedule-delivery: email failed (${sent.error})`);
};

export const shiftReminderHandler: JobHandler = async (job: Job) => {
  const shiftId = typeof job.payload.shiftId === "string" ? job.payload.shiftId : null;
  const employeeId = typeof job.payload.employeeId === "string" ? job.payload.employeeId : null;
  const orgId = typeof job.payload.orgId === "string" ? job.payload.orgId : null;
  if (!shiftId || !employeeId || !orgId) {
    throw new Error("shift-reminder: missing shiftId/employeeId/orgId in payload");
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  // Re-validate the shift: must still be published + assigned to this employee
  // (covers cancel / reassign / reopen between enqueue and fire). Otherwise no-op.
  const { data: shiftRow, error: shiftErr } = await admin
    .from("shifts")
    .select("starts_at, ends_at, status, employee_id, role_certification_id")
    .eq("id", shiftId)
    .maybeSingle();
  if (shiftErr) throw shiftErr;
  const shift = shiftRow as {
    starts_at: string;
    ends_at: string;
    status: string;
    employee_id: string | null;
    role_certification_id: string | null;
  } | null;
  if (!shift || shift.status !== "published" || shift.employee_id !== employeeId) {
    return; // stale reminder — silently drop.
  }

  const { data: empRow, error: empErr } = await admin
    .from("employees")
    .select("name, email, active, org_id")
    .eq("id", employeeId)
    .maybeSingle();
  if (empErr) throw empErr;
  const employee = empRow as EmployeeRow | null;
  if (!employee || !employee.active) return;

  const [{ sendEmail }, { getURL }, { ShiftReminderEmail }] = await Promise.all([
    import("@/lib/email/send"),
    import("@/lib/site-url"),
    import("@/lib/email/templates/shift-reminder"),
  ]);

  const portalUrl = await livePortalUrl(admin, employeeId, getURL);
  if (!portalUrl) {
    logger.warn("shift-reminder.no_live_token", { employeeId });
    return;
  }

  const name = await orgName(admin, orgId);
  const sent = await sendEmail({
    to: employee.email,
    subject: `Reminder: your ${name} shift`,
    react: createElement(ShiftReminderEmail, {
      employeeName: employee.name,
      orgName: name,
      portalUrl,
      shiftLabel: shiftLabel(shift.starts_at, shift.ends_at),
    }),
  });
  if (!sent.ok) throw new Error(`shift-reminder: email failed (${sent.error})`);
};
