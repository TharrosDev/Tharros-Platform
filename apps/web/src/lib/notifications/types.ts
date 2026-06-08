/**
 * Day 40 — notification domain types + pure helpers. No `server-only`, so the
 * mappers, the type→preference map, and the relative-time formatter stay
 * importable by client islands and the Vitest harness.
 */

import type { NotificationKey } from "@/lib/org/schemas";

/**
 * Known notification kinds. `type` is free text in the DB (forward-compatible),
 * but the senders we have / plan use this set. Used to route email delivery to
 * an org notification preference (see `prefKeyForType`).
 */
export type NotificationType =
  | "system"
  | "billing"
  | "new_lead"
  | "weekly_summary"
  | "agent_handoff"
  | "sick_call"
  | "replacement_filled"
  | "replacement_escalated"
  | "swap_escalated"
  | "time_off_requested";

export type EmailStatus = "none" | "pending" | "sent" | "failed" | "skipped";

export type Notification = {
  id: string;
  orgId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  /** Free-form payload; `url`/`label` drive the inbox item's link when present. */
  data: Record<string, unknown>;
  readAt: string | null;
  email: boolean;
  emailStatus: EmailStatus;
  createdAt: string;
};

export type NotificationRow = {
  id: string;
  org_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  email: boolean;
  email_status: EmailStatus;
  created_at: string;
};

export function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data ?? {},
    readAt: row.read_at,
    email: row.email,
    emailStatus: row.email_status,
    createdAt: row.created_at,
  };
}

/**
 * Map a notification type to the org email-preference key that gates its email
 * delivery (Day-21 `org_settings.notifications`). `null` = no gate (always email
 * when an email is requested), e.g. transactional `system`/`agent_handoff`.
 */
export function prefKeyForType(type: string): NotificationKey | null {
  switch (type) {
    case "billing":
      return "billing_account";
    case "new_lead":
      return "new_lead";
    case "weekly_summary":
      return "weekly_summary";
    default:
      return null;
  }
}

/** Pull a typed action link out of `data` (if the sender set one). */
export function notificationLink(
  data: Record<string, unknown>,
): { url: string; label: string } | null {
  const url = typeof data.url === "string" ? data.url : null;
  if (!url) return null;
  const label = typeof data.label === "string" ? data.label : "View";
  return { url, label };
}

/**
 * Absolute, render-pure timestamp ("Jun 4, 2:30 PM") — depends only on the row,
 * so it's safe to call during render (unlike a `Date.now()`-relative format).
 */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Compact relative time ("just now", "5m", "3h", "2d", else a short date). */
export function formatRelativeTime(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Math.max(0, now - then);
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(then).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
