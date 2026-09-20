import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import {
  mapNotification,
  type Notification,
  type NotificationRow,
} from "@/lib/notifications/types";

/**
 * Day 40 — in-app inbox reads. RLS scopes `notification_events` to the calling
 * user (`user_id = auth.uid()`), so these never re-filter by recipient — the
 * database guarantees a user only ever sees their own notifications.
 */

const COLS =
  "id, org_id, user_id, type, title, body, data, read_at, email, email_status, created_at";

/** The caller's notifications, newest-first (bounded). */
export async function listNotifications(opts?: { limit?: number }): Promise<Notification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_events")
    .select(COLS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(opts?.limit ?? 30);

  if (error) {
    logger.error("notifications.list_failed", { error: error.message });
    return [];
  }
  return ((data ?? []) as NotificationRow[]).map(mapNotification);
}

/** Count the caller's unread notifications (the topbar bell badge). */
export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notification_events")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) {
    logger.warn("notifications.unread_count_failed", { error: error.message });
    return 0;
  }
  return count ?? 0;
}
