import { createElement } from "react";

import type { Job, JobHandler } from "@/lib/jobs/types";
import { logger } from "@/lib/observability/logger";

/**
 * Day 55 — replacement engine job handlers (Phase 3G).
 *
 *   replacement-offer-notify  — emails the portal magic-link to every employee an
 *                               open shift was just offered to (fan-out nudge; the
 *                               in-portal "Open shifts" card is the source of truth).
 *   replacement-offer-timeout — fires at the offers' expiry; if the shift is still
 *                               open, escalates to the managers (via the shared
 *                               `escalateReplacement`). Idempotent: no-ops if filled.
 *
 * Both run as a system actor on the admin client. Server-only deps are dynamically
 * imported in the body so the jobs registry stays Vitest-importable (mirrors the
 * Day-53 delivery handlers). Handlers must be idempotent — delivery is at-least-once.
 */

const PORTAL_NEXT = "/portal/schedule";

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

export const replacementOfferNotifyHandler: JobHandler = async (job: Job) => {
  const shiftId = typeof job.payload.shiftId === "string" ? job.payload.shiftId : null;
  const orgId = typeof job.payload.orgId === "string" ? job.payload.orgId : null;
  if (!shiftId || !orgId) {
    throw new Error("replacement-offer-notify: missing shiftId/orgId in payload");
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  // The shift must still be open; if it's already filled, drop the nudge.
  const { data: shiftRow, error: shiftErr } = await admin
    .from("shifts")
    .select("starts_at, ends_at, status, employee_id")
    .eq("id", shiftId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (shiftErr) throw shiftErr;
  const shift = shiftRow as {
    starts_at: string;
    ends_at: string;
    status: string;
    employee_id: string | null;
  } | null;
  if (!shift || shift.status !== "open" || shift.employee_id !== null) return;

  // Employees with a still-outstanding offer for this shift.
  const { data: offerRows, error: offerErr } = await admin
    .from("replacement_pool_events")
    .select("employee_id")
    .eq("shift_id", shiftId)
    .eq("status", "offered");
  if (offerErr) throw offerErr;
  const employeeIds = ((offerRows ?? []) as Array<{ employee_id: string }>).map(
    (r) => r.employee_id,
  );
  if (employeeIds.length === 0) return;

  const { data: empRows, error: empErr } = await admin
    .from("employees")
    .select("id, name, email, active")
    .in("id", employeeIds);
  if (empErr) throw empErr;
  const employees = (empRows ?? []) as Array<{
    id: string;
    name: string;
    email: string;
    active: boolean;
  }>;

  const { data: orgRow } = await admin
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .maybeSingle();
  const orgName = (orgRow as { name: string } | null)?.name ?? "your team";
  const label = shiftLabel(shift.starts_at, shift.ends_at);

  const [{ sendEmail }, { getURL }, { ReplacementOfferEmail }] = await Promise.all([
    import("@/lib/email/send"),
    import("@/lib/site-url"),
    import("@/lib/email/templates/replacement-offer"),
  ]);

  for (const employee of employees) {
    if (!employee.active) continue;
    const portalUrl = await livePortalUrl(admin, employee.id, getURL);
    if (!portalUrl) {
      logger.warn("replacement-offer-notify.no_live_token", { employeeId: employee.id });
      continue;
    }
    const sent = await sendEmail({
      to: employee.email,
      subject: `A ${orgName} shift is available`,
      react: createElement(ReplacementOfferEmail, {
        employeeName: employee.name,
        orgName,
        portalUrl,
        shiftLabel: label,
      }),
      idempotencyKey: `replacement-offer/${job.id}/${employee.id}`,
    });
    if (!sent.ok) {
      // One bad address shouldn't fail the whole fan-out; log and continue.
      logger.warn("replacement-offer-notify.email_failed", {
        employeeId: employee.id,
        error: sent.error,
      });
    }
  }
};

export const replacementTimeoutHandler: JobHandler = async (job: Job) => {
  const shiftId = typeof job.payload.shiftId === "string" ? job.payload.shiftId : null;
  const orgId = typeof job.payload.orgId === "string" ? job.payload.orgId : null;
  const sickCallId = typeof job.payload.sickCallId === "string" ? job.payload.sickCallId : null;
  if (!shiftId || !orgId) {
    throw new Error("replacement-offer-timeout: missing shiftId/orgId in payload");
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { escalateReplacement } = await import("@/lib/scheduling/replacement");
  const admin = createAdminClient();

  // Idempotent: escalateReplacement no-ops if the shift is no longer open.
  await escalateReplacement(admin, { shiftId, orgId, sickCallId, reason: "timeout" });
};

/** Read the employee's live portal magic-link, or null if none. */
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
