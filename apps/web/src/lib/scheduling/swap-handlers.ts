import { createElement } from "react";

import type { Job, JobHandler } from "@/lib/jobs/types";
import { logger } from "@/lib/observability/logger";

/**
 * Day 56 — shift-swap job handlers (Phase 3G).
 *
 *   swap-proposal-notify — emails a coworker the portal magic-link when an employee
 *                          proposes swapping a shift with them (targeted only).
 *   swap-result-notify   — emails the proposing employee once the swap is
 *                          approved/applied or denied.
 *
 * System actor on the admin client; server-only deps dynamically imported in the
 * body so the jobs registry stays Vitest-importable (mirrors the Day-53/55 handlers).
 * Idempotent — at-least-once delivery is fine for a notification email.
 */

const PORTAL_NEXT = "/portal/schedule";

type SwapRequest = {
  shift_id: string;
  requesting_employee_id: string;
  target_employee_id: string | null;
  target_shift_id: string | null;
  org_id: string;
};

type Admin = import("@supabase/supabase-js").SupabaseClient;

/** "Mon Jun 15, 9:00 AM – 5:00 PM" from local-as-UTC ISO strings (UTC accessors). */
function shiftLabel(startsAt: string, endsAt: string): string {
  const fmtDay = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const fmtTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  const s = new Date(Date.parse(startsAt));
  const e = new Date(Date.parse(endsAt));
  return `${fmtDay.format(s)}, ${fmtTime.format(s)} – ${fmtTime.format(e)}`;
}

async function livePortalUrl(admin: Admin, employeeId: string, getURL: () => string): Promise<string | null> {
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

async function loadRequest(admin: Admin, requestId: string, orgId: string): Promise<SwapRequest | null> {
  const { data } = await admin
    .from("shift_swap_requests")
    .select("shift_id, requesting_employee_id, target_employee_id, target_shift_id, org_id")
    .eq("id", requestId)
    .eq("org_id", orgId)
    .maybeSingle();
  return (data as SwapRequest | null) ?? null;
}

async function employee(admin: Admin, id: string): Promise<{ name: string; email: string; active: boolean } | null> {
  const { data } = await admin.from("employees").select("name, email, active").eq("id", id).maybeSingle();
  return (data as { name: string; email: string; active: boolean } | null) ?? null;
}

async function shiftRow(admin: Admin, id: string): Promise<{ starts_at: string; ends_at: string } | null> {
  const { data } = await admin.from("shifts").select("starts_at, ends_at").eq("id", id).maybeSingle();
  return (data as { starts_at: string; ends_at: string } | null) ?? null;
}

async function orgName(admin: Admin, orgId: string): Promise<string> {
  const { data } = await admin.from("organizations").select("name").eq("id", orgId).maybeSingle();
  return (data as { name: string } | null)?.name ?? "your team";
}

export const swapProposalNotifyHandler: JobHandler = async (job: Job) => {
  const requestId = typeof job.payload.requestId === "string" ? job.payload.requestId : null;
  const orgId = typeof job.payload.orgId === "string" ? job.payload.orgId : null;
  if (!requestId || !orgId) throw new Error("swap-proposal-notify: missing requestId/orgId in payload");

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const req = await loadRequest(admin, requestId, orgId);
  if (!req || !req.target_employee_id) return; // open offer or gone — nothing to email.

  const [target, from, xRow] = await Promise.all([
    employee(admin, req.target_employee_id),
    employee(admin, req.requesting_employee_id),
    shiftRow(admin, req.shift_id),
  ]);
  if (!target || !target.active || !xRow) return;

  const tradeFor = req.target_shift_id ? await shiftRow(admin, req.target_shift_id) : null;
  const name = await orgName(admin, orgId);

  const [{ sendEmail }, { getURL }, { SwapProposalEmail }] = await Promise.all([
    import("@/lib/email/send"),
    import("@/lib/site-url"),
    import("@/lib/email/templates/swap-proposal"),
  ]);

  const portalUrl = await livePortalUrl(admin, req.target_employee_id, getURL);
  if (!portalUrl) {
    logger.warn("swap-proposal-notify.no_live_token", { employeeId: req.target_employee_id });
    return;
  }

  const sent = await sendEmail({
    to: target.email,
    subject: `${from?.name ?? "A coworker"} wants to swap a ${name} shift`,
    react: createElement(SwapProposalEmail, {
      employeeName: target.name,
      fromName: from?.name ?? "A coworker",
      orgName: name,
      portalUrl,
      shiftLabel: shiftLabel(xRow.starts_at, xRow.ends_at),
      tradeForLabel: tradeFor ? shiftLabel(tradeFor.starts_at, tradeFor.ends_at) : null,
    }),
    idempotencyKey: `swap-proposal/${job.id}`,
  });
  if (!sent.ok) throw new Error(`swap-proposal-notify: email failed (${sent.error})`);
};

export const swapResultNotifyHandler: JobHandler = async (job: Job) => {
  const requestId = typeof job.payload.requestId === "string" ? job.payload.requestId : null;
  const orgId = typeof job.payload.orgId === "string" ? job.payload.orgId : null;
  const result = job.payload.result === "approved" || job.payload.result === "denied" ? job.payload.result : null;
  if (!requestId || !orgId || !result) throw new Error("swap-result-notify: missing requestId/orgId/result");

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const req = await loadRequest(admin, requestId, orgId);
  if (!req) return;

  const [requester, xRow] = await Promise.all([
    employee(admin, req.requesting_employee_id),
    shiftRow(admin, req.shift_id),
  ]);
  if (!requester || !requester.active || !xRow) return;

  const name = await orgName(admin, orgId);
  const [{ sendEmail }, { getURL }, { SwapResultEmail }] = await Promise.all([
    import("@/lib/email/send"),
    import("@/lib/site-url"),
    import("@/lib/email/templates/swap-result"),
  ]);

  const portalUrl = await livePortalUrl(admin, req.requesting_employee_id, getURL);
  if (!portalUrl) {
    logger.warn("swap-result-notify.no_live_token", { employeeId: req.requesting_employee_id });
    return;
  }

  const sent = await sendEmail({
    to: requester.email,
    subject: `Your ${name} shift swap was ${result === "approved" ? "approved" : "declined"}`,
    react: createElement(SwapResultEmail, {
      employeeName: requester.name,
      orgName: name,
      portalUrl,
      result,
      shiftLabel: shiftLabel(xRow.starts_at, xRow.ends_at),
    }),
    idempotencyKey: `swap-result/${job.id}`,
  });
  if (!sent.ok) throw new Error(`swap-result-notify: email failed (${sent.error})`);
};
