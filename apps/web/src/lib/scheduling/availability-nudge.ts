import { createElement } from "react";

import type { Job, JobHandler } from "@/lib/jobs/types";
import { logger } from "@/lib/observability/logger";

/**
 * Day 45 — the `availability-nudge` job handler. Emails an employee a portal
 * link asking them to set their availability, and schedules follow-ups until they
 * do. Registered in lib/jobs/handlers; driven by the Day-38 runtime (retries +
 * at-least-once handled there — this handler throws on a transient failure).
 *
 * The manager action (`requestAvailabilityNudge`) mints the portal token (proving
 * owner/admin role — the system can't) and enqueues the first run; this handler
 * runs as a system actor on the admin client and READS the live token to build
 * the link (tokens are stored raw, validated by `validate_portal_token`).
 *
 * Idempotent + self-terminating: it no-ops the moment the employee has permanent
 * availability, so a re-run after a crash won't double-send and the follow-up
 * chain stops on its own. Statically imported by the handler registry (which the
 * Vitest jobs harness loads), so server-only deps are loaded via dynamic
 * `import()` in the body, never at module eval.
 */

/** Days between follow-up nudges. */
const FOLLOWUP_DAYS = 3;
/** Total nudge emails before giving up (attempt 0 = first, then two follow-ups). */
const MAX_ATTEMPTS = 3;

export const availabilityNudgeHandler: JobHandler = async (job: Job) => {
  const employeeId = typeof job.payload.employeeId === "string" ? job.payload.employeeId : null;
  const orgId = typeof job.payload.orgId === "string" ? job.payload.orgId : null;
  const attempt = typeof job.payload.attempt === "number" ? job.payload.attempt : 0;
  if (!employeeId || !orgId) {
    throw new Error("availability-nudge: missing employeeId/orgId in payload");
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  // The employee must still exist + be active.
  const { data: empRow, error: empErr } = await admin
    .from("employees")
    .select("name, email, active, org_id")
    .eq("id", employeeId)
    .maybeSingle();
  if (empErr) throw empErr;
  const employee = empRow as {
    name: string;
    email: string;
    active: boolean;
    org_id: string;
  } | null;
  if (!employee || !employee.active) return; // removed/deactivated — stop the chain.

  // Stop condition + idempotency: availability already set → nothing to chase.
  const { count, error: cntErr } = await admin
    .from("availability")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", employeeId)
    .eq("kind", "permanent");
  if (cntErr) throw cntErr;
  if ((count ?? 0) > 0) {
    logger.info("availability-nudge.satisfied", { employeeId, attempt });
    return;
  }

  // Build the portal link from the employee's live token (newest un-revoked one).
  const { data: tokRow } = await admin
    .from("employee_portal_tokens")
    .select("token")
    .eq("employee_id", employeeId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const token = (tokRow as { token: string } | null)?.token ?? null;
  if (!token) {
    // No live link to send — the manager must (re)issue one. Don't burn retries.
    logger.warn("availability-nudge.no_live_token", { employeeId });
    return;
  }

  const { data: orgRow } = await admin
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .maybeSingle();
  const orgName = (orgRow as { name: string } | null)?.name ?? "your team";

  const [{ sendEmail }, { getURL }, { AvailabilityRequestEmail }] = await Promise.all([
    import("@/lib/email/send"),
    import("@/lib/site-url"),
    import("@/lib/email/templates/availability-request"),
  ]);

  const portalUrl = `${getURL()}/portal/enter?token=${encodeURIComponent(
    token,
  )}&next=${encodeURIComponent("/portal/availability")}`;

  const sent = await sendEmail({
    to: employee.email,
    subject: `Set your ${orgName} availability`,
    react: createElement(AvailabilityRequestEmail, {
      employeeName: employee.name,
      orgName,
      portalUrl,
    }),
    idempotencyKey: `availability-nudge/${job.id}`,
  });
  // Throw so the runtime retries a transient email failure (at-least-once).
  if (!sent.ok) throw new Error(`availability-nudge: email failed (${sent.error})`);

  // Schedule the next nudge unless we've hit the cap. The next run re-checks the
  // stop condition above, so it self-cancels once availability is set.
  if (attempt + 1 < MAX_ATTEMPTS) {
    const { enqueueJob } = await import("@/lib/jobs/enqueue");
    const runAt = new Date(Date.now() + FOLLOWUP_DAYS * 24 * 60 * 60 * 1000);
    await enqueueJob(admin, {
      type: "availability-nudge",
      payload: { employeeId, orgId, attempt: attempt + 1 },
      orgId,
      runAt,
    });
  }
};
