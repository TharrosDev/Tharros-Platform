"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";

/**
 * Day 40 — in-app inbox mutations. All go through the RLS user-session client, so
 * a caller can only ever touch their own notifications (the `notification_events`
 * UPDATE/DELETE policies enforce `user_id = auth.uid()`). Shaped as form actions
 * (per-item ones read the id from FormData) for `<form action={…}>` usage.
 */

/** Mark one notification read. Reads `id` from the submitted form. */
export async function markNotificationRead(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_events")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) logger.warn("notifications.mark_read_failed", { id, error: error.message });

  revalidatePath("/notifications");
}

/** Mark every unread notification read (RLS limits this to the caller's rows). */
export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_events")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) logger.warn("notifications.mark_all_read_failed", { error: error.message });

  revalidatePath("/notifications");
}

/** Dismiss (delete) one notification. Reads `id` from the submitted form. */
export async function dismissNotification(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("notification_events").delete().eq("id", id);
  if (error) logger.warn("notifications.dismiss_failed", { id, error: error.message });

  revalidatePath("/notifications");
}
