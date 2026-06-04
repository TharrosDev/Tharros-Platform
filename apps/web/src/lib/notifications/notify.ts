import type { SupabaseClient } from "@supabase/supabase-js";

import { enqueueJob } from "@/lib/jobs/enqueue";
import { resolveNotifications } from "@/lib/org/schemas";
import { prefKeyForType, type EmailStatus, type NotificationType } from "@/lib/notifications/types";

/**
 * Day 40 — the public "send a notification" entry point. Other features call
 * this to record an in-app notification and (optionally) deliver it by email.
 *
 * Takes the service-role admin client as a parameter (DI, like enqueueJob /
 * recordAuditEvent) — `notification_events` is system-created (no user-insert
 * RLS) and reading the org's email prefs must bypass RLS. Keeping the client a
 * parameter (rather than importing the `server-only` admin seam) leaves this
 * module unit-testable; app callers pass `createAdminClient()`.
 *
 * Email gating: if `email` is requested, the type is mapped to an org
 * notification preference (Day 21). Pref off → the row is stored `skipped` and no
 * job is enqueued. Pref on (or no gate) → stored `pending` and a `notification-send`
 * job is enqueued; the Day-38 runtime handles retries/backoff.
 */
export type CreateNotificationInput = {
  orgId: string;
  /** The recipient (an auth user in the org). */
  userId: string;
  type: NotificationType | (string & {});
  title: string;
  body: string;
  /** Free-form payload; `url` + `label` render the inbox item's link. */
  data?: Record<string, unknown>;
  /** Also deliver by email (subject to the org preference for this type). */
  email?: boolean;
};

export type CreateNotificationResult = {
  id: string;
  emailStatus: EmailStatus;
};

/** Decide the initial email_status for a notification, honouring org prefs. */
export async function resolveEmailStatus(
  admin: SupabaseClient,
  orgId: string,
  type: string,
  wantEmail: boolean,
): Promise<EmailStatus> {
  if (!wantEmail) return "none";

  const prefKey = prefKeyForType(type);
  if (!prefKey) return "pending"; // transactional — no preference gate

  const { data } = await admin
    .from("org_settings")
    .select("notifications")
    .eq("org_id", orgId)
    .maybeSingle();
  const prefs = resolveNotifications(data?.notifications);
  return prefs[prefKey] ? "pending" : "skipped";
}

export async function createNotification(
  admin: SupabaseClient,
  input: CreateNotificationInput,
): Promise<CreateNotificationResult> {
  const wantEmail = input.email ?? false;
  const emailStatus = await resolveEmailStatus(admin, input.orgId, input.type, wantEmail);

  const { data, error } = await admin
    .from("notification_events")
    .insert({
      org_id: input.orgId,
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
      email: wantEmail,
      email_status: emailStatus,
    })
    .select("id")
    .single();

  if (error) throw error;
  const id = (data as { id: string }).id;

  // Only a 'pending' email needs the worker; 'skipped'/'none' are terminal.
  if (emailStatus === "pending") {
    await enqueueJob(admin, {
      type: "notification-send",
      payload: { notificationId: id },
      orgId: input.orgId,
    });
  }

  return { id, emailStatus };
}
