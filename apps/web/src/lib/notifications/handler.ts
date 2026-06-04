import { createElement } from "react";

import type { Job, JobHandler } from "@/lib/jobs/types";
import { mapNotification, notificationLink, type NotificationRow } from "@/lib/notifications/types";

/**
 * Day 40 — the `notification-send` job handler. Delivers the email channel of a
 * `notification_events` row. Registered in lib/jobs/handlers; driven by the
 * Day-38 runtime, so retries/backoff/at-least-once are handled there — this
 * handler just throws on a transient failure to trigger a retry.
 *
 * NOTE: this module is statically imported by the jobs handler registry, which
 * the Vitest jobs harness imports. So it must NOT pull `server-only` modules at
 * module-eval time — the Anthropic/email/admin seams are loaded via dynamic
 * `import()` inside the handler body (runs only when a job actually dispatches).
 *
 * Idempotent (delivery is at-least-once): it no-ops unless the row is still
 * `email_status = 'pending'`, so a re-run after a crash won't double-send.
 */

const NOTIFICATION_COLS =
  "id, org_id, user_id, type, title, body, data, read_at, email, email_status, created_at";

export const notificationSendHandler: JobHandler = async (job: Job) => {
  const notificationId =
    typeof job.payload.notificationId === "string" ? job.payload.notificationId : null;
  if (!notificationId) {
    throw new Error("notification-send: missing notificationId in payload");
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("notification_events")
    .select(NOTIFICATION_COLS)
    .eq("id", notificationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return; // notification was deleted — nothing to deliver.

  const n = mapNotification(data as NotificationRow);
  // Idempotency gate: only a still-pending email needs sending.
  if (n.emailStatus !== "pending") return;

  // Resolve the recipient's email (profiles mirrors auth.users.email).
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", n.userId)
    .maybeSingle();
  const to = (profile as { email: string | null } | null)?.email ?? null;
  if (!to) {
    // No address to send to — terminal, don't burn retries.
    await admin
      .from("notification_events")
      .update({ email_status: "failed", email_error: "no recipient email" })
      .eq("id", n.id);
    return;
  }

  const [{ sendEmail }, { NotificationEmail }] = await Promise.all([
    import("@/lib/email/send"),
    import("@/lib/email/templates/notification"),
  ]);

  const link = notificationLink(n.data);
  const result = await sendEmail({
    to,
    subject: n.title,
    react: createElement(NotificationEmail, {
      title: n.title,
      body: n.body,
      actionUrl: link?.url,
      actionLabel: link?.label,
    }),
  });

  if (!result.ok) {
    // Record the error and throw so the job runtime retries with backoff.
    await admin
      .from("notification_events")
      .update({ email_error: result.error })
      .eq("id", n.id);
    throw new Error(`notification-send: email send failed: ${result.error}`);
  }

  await admin
    .from("notification_events")
    .update({
      email_status: "sent",
      email_sent_at: new Date().toISOString(),
      email_error: null,
    })
    .eq("id", n.id);
};
