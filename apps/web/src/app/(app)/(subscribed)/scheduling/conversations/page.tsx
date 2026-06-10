import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessagesSquare } from "lucide-react";

import { getOrgContext } from "@/lib/org/queries";
import { getSchedulingStatus } from "@/lib/scheduling/queries";
import { listOrgThreads } from "@/lib/agents/queries";
import { PageHeader } from "@/components/page-header";
import { ThreadList } from "@/components/agents/thread-list";

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
        <ThreadList threads={threads} />
      )}
    </div>
  );
}
