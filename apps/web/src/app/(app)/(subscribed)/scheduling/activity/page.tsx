import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, CalendarClock, ScrollText } from "lucide-react";

import { getOrgContext } from "@/lib/org/queries";
import { getSchedulingStatus } from "@/lib/scheduling/queries";
import { getActivityPage } from "@/lib/audit/queries";
import { presentActivityFeed, type ActivitySource, type ActivityCategory } from "@/lib/audit/present";
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

const CATEGORY_BADGE: Record<ActivityCategory, { label: string; tone: "secondary" | "outline" | "destructive" }> = {
  decision: { label: "Decision", tone: "secondary" },
  change: { label: "Change", tone: "outline" },
  escalation: { label: "Escalation", tone: "destructive" },
  system: { label: "System", tone: "outline" },
};

function resolveSource(value: string | undefined): ActivitySource | "all" {
  return value === "agent" || value === "schedule" ? value : "all";
}

/**
 * Day 62 — full traceability surface. A unified, owner/admin-only timeline of
 * every agent decision (agent_audit_log) and every schedule change
 * (scheduling_audit_log), via the gated `org_activity_log` RPC. Cursor-paginated
 * (one page per view) with a source filter; the RPC and this page both gate to
 * managers, so a member is sent back to the scheduling home.
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

  // Agent internals are management-level — members don't get the audit view.
  if (activeOrg.role !== "owner" && activeOrg.role !== "admin") redirect("/scheduling");

  const source = resolveSource(sp.source);
  const before = typeof sp.before === "string" ? sp.before : null;
  const page = await getActivityPage(activeOrg.id, { source, before });
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
        description="A complete, auditable trail of every agent decision and schedule change in your workspace."
        actions={
          <Link href="/scheduling" className={buttonVariants({ variant: "outline" })}>
            Back to scheduling
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter activity">
        {SOURCES.map((s) => (
          <Link
            key={s.key}
            href={href({ source: s.key })}
            aria-current={s.key === source ? "page" : undefined}
            className={buttonVariants({ variant: s.key === source ? "default" : "outline", size: "sm" })}
          >
            {s.label}
          </Link>
        ))}
      </div>

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
        <ul className="divide-border/60 overflow-hidden rounded-lg border divide-y">
          {events.map((e) => {
            const badge = CATEGORY_BADGE[e.category];
            const Icon = e.source === "agent" ? Bot : CalendarClock;
            return (
              <li key={e.id} className="bg-card flex items-start gap-3 px-4 py-3.5">
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                    e.source === "agent" ? "bg-primary-soft/40 text-primary" : "bg-muted text-muted-foreground",
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
          <Link href={href({ source })} className={buttonVariants({ variant: "ghost", size: "sm" })}>
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
