"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { markAllNotificationsRead } from "@/lib/notifications/actions";
import { notificationLink, type Notification } from "@/lib/notifications/types";

/**
 * Day 40 — the topbar notification inbox: a bell with an unread badge and a
 * dropdown of recent notifications, plus a link to the full `/notifications`
 * page. Data is fetched server-side in the app layout and passed in (fetch-on-
 * load; the app has no realtime yet — a refresh/navigation re-reads).
 */
export function NotificationMenu({
  notifications,
  unreadCount,
}: {
  notifications: Notification[];
  unreadCount: number;
}) {
  const recent = notifications.slice(0, 6);
  const badge = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5">
            {/* One soft ping when the badge appears, then steady. */}
            <span
              aria-hidden
              className="bg-primary/40 absolute inset-0 animate-ping rounded-full [animation-iteration-count:2] motion-reduce:animate-none"
            />
            <span className="bg-primary text-primary-foreground relative flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold">
              {badge}
            </span>
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 max-w-[calc(100vw-2rem)]">
        <div className="flex items-center justify-between gap-2 pr-1">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          {unreadCount > 0 ? (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/40 min-h-8 rounded-md px-2 py-1 text-xs outline-none transition-colors focus-visible:ring-[3px]"
              >
                Mark all read
              </button>
            </form>
          ) : null}
        </div>
        <DropdownMenuSeparator />

        {recent.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">
            You&apos;re all caught up.
          </p>
        ) : (
          recent.map((n) => {
            const link = notificationLink(n.data);
            const body = (
              <div className="flex w-full items-start gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    n.readAt ? "bg-transparent" : "bg-primary",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{n.title}</p>
                  <p className="text-muted-foreground line-clamp-2 text-xs">{n.body}</p>
                </div>
              </div>
            );
            return link ? (
              <DropdownMenuItem key={n.id} render={<Link href={link.url} />}>
                {body}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem key={n.id} className="cursor-default">
                {body}
              </DropdownMenuItem>
            );
          })
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<Link href="/notifications" />}
          className="justify-center text-sm font-medium"
        >
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
