import type { Metadata } from "next";
import { Bell } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { listNotifications } from "@/lib/notifications/queries";
import {
  markAllNotificationsRead,
  markNotificationRead,
  dismissNotification,
} from "@/lib/notifications/actions";
import { formatTimestamp, notificationLink } from "@/lib/notifications/types";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Notifications" };

/**
 * Day 40 — the full in-app inbox. Lists the caller's notifications (RLS-scoped),
 * with mark-read / dismiss per item and a mark-all-read action. Fetch-on-load;
 * the server actions revalidate this path.
 */
export default async function NotificationsPage() {
  const notifications = await listNotifications({ limit: 50 });
  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Updates from your workspace and the Tharros agents."
        actions={
          hasUnread ? (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Mark all as read
              </button>
            </form>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell />}
          title="Nothing in the inbox"
          description="Updates from scheduling, lead capture and automations land here as they happen."
        />
      ) : (
        <ul className="bg-card divide-y overflow-hidden rounded-xl border">
          {notifications.map((n) => {
            const link = notificationLink(n.data);
            return (
              <li
                key={n.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3.5 transition-colors",
                  n.readAt ? "bg-card" : "bg-primary-soft/30",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-2 shrink-0 ",
                    n.readAt ? "bg-transparent" : "bg-primary",
                  )}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatTimestamp(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">{n.body}</p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {link ? (
                      <Link
                        href={link.url}
                        className="text-primary-soft-foreground text-xs font-medium hover:underline"
                      >
                        {link.label}
                      </Link>
                    ) : null}
                    {!n.readAt ? (
                      <form action={markNotificationRead}>
                        <input type="hidden" name="id" value={n.id} />
                        <button
                          type="submit"
                          aria-label={`Mark "${n.title}" as read`}
                          className="text-muted-foreground hover:text-foreground rounded-sm text-xs "
                        >
                          Mark read
                        </button>
                      </form>
                    ) : null}
                    <form action={dismissNotification}>
                      <input type="hidden" name="id" value={n.id} />
                      <button
                        type="submit"
                        aria-label={`Dismiss "${n.title}"`}
                        className="text-muted-foreground hover:text-destructive rounded-sm text-xs "
                      >
                        Dismiss
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
