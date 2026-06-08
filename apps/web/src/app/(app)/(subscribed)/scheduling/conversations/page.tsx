import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessagesSquare } from "lucide-react";

import { getOrgContext } from "@/lib/org/queries";
import { getSchedulingStatus } from "@/lib/scheduling/queries";
import { listOrgThreads } from "@/lib/agents/queries";
import {
  threadKindLabel,
  threadStatusBadge,
} from "@/lib/agents/present";
import { formatTimestamp } from "@/lib/notifications/types";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Conversations" };

/**
 * Day 58 — the AI conversation inbox. Lists the org's operational agent threads
 * (sick-call, schedule generation, time-off, …) so a manager can step into any
 * of them. Threads are org-wide readable (Day-39 RLS); the detail page is where
 * takeover / reply / resolve happen.
 */
export default async function ConversationsPage() {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) redirect("/dashboard");

  const { onboardedAt } = await getSchedulingStatus(activeOrg.id);
  if (!onboardedAt) redirect("/scheduling/setup");

  const threads = await listOrgThreads({ limit: 50 });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Conversations"
        description="Every AI conversation your scheduling agents are running. Step in to take over, reply, or override a decision."
        actions={
          <Link href="/scheduling" className={buttonVariants({ variant: "outline" })}>
            Back to scheduling
          </Link>
        }
      />

      {threads.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-3 rounded-lg border px-6 py-16 text-center">
          <MessagesSquare className="text-muted-foreground size-8" />
          <p className="type-body font-medium">No conversations yet</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            When the agent handles a sick call, generates a schedule, or processes a time-off
            request, the conversation shows up here.
          </p>
        </div>
      ) : (
        <ul className="divide-border/60 overflow-hidden rounded-lg border divide-y">
          {threads.map((t) => {
            const badge = threadStatusBadge(t);
            return (
              <li key={t.id} className="bg-card hover:bg-muted/40 transition-colors">
                <Link
                  href={`/scheduling/conversations/${t.id}`}
                  className="flex items-start gap-4 px-4 py-3.5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{t.title}</span>
                      <Badge variant="secondary">{threadKindLabel(t.kind)}</Badge>
                      <Badge variant={badge.tone}>{badge.label}</Badge>
                    </div>
                    {t.lastSnippet ? (
                      <p className="text-muted-foreground line-clamp-1 text-sm">{t.lastSnippet}</p>
                    ) : null}
                    <p className="text-muted-foreground text-xs">
                      {t.turnCount} {t.turnCount === 1 ? "message" : "messages"} ·{" "}
                      {formatTimestamp(t.updatedAt)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
