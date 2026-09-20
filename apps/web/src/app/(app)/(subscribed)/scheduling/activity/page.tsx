import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, CalendarClock, ScrollText } from "lucide-react";

import { getOrgContext } from "@/lib/org/queries";
import { getSchedulingStatus } from "@/lib/scheduling/queries";
import { getActivityPage, getScheduleActivityPage } from "@/lib/audit/queries";
import {
  presentActivityFeed,
  type ActivitySource,
  type ActivityCategory,
} from "@/lib/audit/present";
import { formatTimestamp } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Activity log" };

const SOURCES: { key: ActivitySource | "all"; label: string }[] = [
  { key: "all", label: "All activity" },
  { key: "agent", label: "Agent decisions" },
  { key: "schedule", label: "Schedule changes" },
];

const CATEGORY_BADGE: Record<
  ActivityCategory,
  { label: string; tone: "secondary" | "outline" | "destructive" }
> = {
  decision: { label: "Decision", tone: "secondary" },
  change: { label: "Change", tone: "outline" },
  escalation: { label: "Escalation", tone: "destructive" },
  system: { label: "System", tone: "outline" },
};

function resolveSource(value: string | undefined): ActivitySource | "all" {
  return value === "agent" || value === "schedule" ? value : "all";
}

/**
 * Day 62 — traceability surface. Owners/admins get the full unified timeline of
 * every agent decision (agent_audit_log) + schedule change (scheduling_audit_log)
 * via the gated `org_activity_log` RPC, with a source filter. Plain members get a
 * schedule-changes-only view (read directly from the member-readable
 * scheduling_audit_log) — the agent internals (model calls, tool steps) stay
 * manager-only. Cursor-paginated, one page per view.
 */
export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; before?: string }>;
}) {
  const [{ activeOrg }, sp] = await Promise.all([getOrgContext(), searchParams]);
  if (!activeOrg) redirect("/dashboard");

  const { onboardedAt } = await getSchedulingStatus(activeOrg.id);
  if (!onboardedAt) redirect("/scheduling/setup");

  const canManage = activeOrg.role === "owner" || activeOrg.role === "admin";
  const before = typeof sp.before === "string" ? sp.before : null;
  // Managers: the full unified feed + source filter. Members: schedule changes
  // only (their RLS-readable trail), with no source filter to choose.
  const source = canManage ? resolveSource(sp.source) : "schedule";
  const page = canManage
    ? await getActivityPage(activeOrg.id, { source, before })
    : await getScheduleActivityPage(activeOrg.id, { before });
  const events = presentActivityFeed(page.rows);

  const href = (params: { source?: string; before?: string }) => {
    const q = new URLSearchParams();
    if (params.source && params.source !== "all") q.set("source", params.source);
    if (params.before) q.set("before", params.before);
    const s = q.toString();
    return `/scheduling/activity${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Activity log"
        description={
          canManage
            ? "A complete, auditable trail of every agent decision and schedule change in your workspace."
            : "An auditable trail of every schedule change in your workspace."
        }
      />

      {canManage ? (
        <div
          className="bg-muted inline-flex flex-wrap items-center gap-1 rounded-lg p-1"
          role="group"
          aria-label="Filter activity"
        >
          {SOURCES.map((s) => (
            <Link
              key={s.key}
              href={href({ source: s.key })}
              aria-current={s.key === source ? "page" : undefined}
              className={cn(
                " rounded-md px-3 py-1.5 text-sm font-medium transition-colors ",
                s.key === source
                  ? "bg-card text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </Link>
          ))}
        </div>
      ) : null}

      {events.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-3 rounded-lg border px-6 py-16 text-center">
          <ScrollText className="text-muted-foreground size-8" />
          <p className="type-body font-medium">No activity to show</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            {before
              ? "You've reached the end of the trail."
              : "Agent decisions and schedule changes will appear here as your workspace runs."}
          </p>
        </div>
      ) : (
        <ul className="bg-card overflow-hidden rounded-lg border">
          {events.map((e, index) => {
            const badge = CATEGORY_BADGE[e.category];
            const Icon = e.source === "agent" ? Bot : CalendarClock;
            return (
              <li key={e.id} className="relative flex items-start gap-3 px-4 py-3.5">
                {/* Timeline rail connecting this event to the next one. */}
                {index < events.length - 1 ? (
                  <span
                    aria-hidden
                    className="bg-border absolute top-11 bottom-0 left-[1.85rem] w-px"
                  />
                ) : null}
                <span
                  className={cn(
                    "relative mt-0.5 flex size-7 shrink-0 items-center justify-center ring-2",
                    e.source === "agent"
                      ? "bg-primary-soft/40 text-primary-soft-foreground"
                      : "bg-muted text-muted-foreground",
                    e.category === "escalation"
                      ? "ring-destructive/40"
                      : e.category === "decision"
                        ? "ring-primary/30"
                        : "ring-transparent",
                  )}
                  aria-hidden
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{e.title}</span>
                    <Badge variant={badge.tone}>{badge.label}</Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {e.actorLabel}
                    {e.model ? ` · ${e.model}` : ""} · {formatTimestamp(e.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between">
        {before ? (
          <Link
            href={href({ source })}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            ← Back to latest
          </Link>
        ) : (
          <span />
        )}
        {page.nextBefore ? (
          <Link
            href={href({ source, before: page.nextBefore })}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Load older →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
