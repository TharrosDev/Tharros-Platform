import type { Metadata } from "next";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { listNotifications } from "@/lib/notifications/queries";
import { markAllNotificationsRead, markNotificationRead, dismissNotification } from "@/lib/notifications/actions";
import { formatTimestamp, notificationLink } from "@/lib/notifications/types";

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
              <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Mark all as read
              </button>
            </form>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <p className="text-muted-foreground type-body">
          You have no notifications yet. Updates from your workspace will show up here.
        </p>
      ) : (
        <ul className="visual-panel divide-border/55 overflow-hidden rounded-2xl divide-y">
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
                    "mt-1.5 size-2 shrink-0 rounded-full",
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
                        className="text-primary text-xs font-medium hover:underline"
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
                          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 rounded-sm text-xs outline-none focus-visible:ring-[3px]"
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
                        className="text-muted-foreground hover:text-destructive focus-visible:ring-ring/40 rounded-sm text-xs outline-none focus-visible:ring-[3px]"
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
