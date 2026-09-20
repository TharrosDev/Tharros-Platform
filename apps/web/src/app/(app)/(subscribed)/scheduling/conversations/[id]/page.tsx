import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getOrgContext } from "@/lib/org/queries";
import { getSchedulingStatus } from "@/lib/scheduling/queries";
import { createClient } from "@/lib/supabase/server";
import { getThread, listThreadTurns } from "@/lib/agents/threads";
import {
  presentTranscript,
  threadKindLabel,
  threadStatusBadge,
  type TurnVoice,
} from "@/lib/agents/present";
import { formatTimestamp } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { TakeoverPanel } from "@/components/agents/takeover-panel";

export const metadata: Metadata = { title: "Conversation" };

/** Bubble alignment + accent per voice. Manager + employee frame the human ends. */
const VOICE_STYLE: Record<TurnVoice, { align: string; bubble: string }> = {
  employee: { align: "items-start", bubble: "bg-muted text-foreground" },
  agent: { align: "items-start", bubble: "bg-primary-soft/40 text-foreground" },
  manager: { align: "items-end", bubble: "bg-primary text-primary-foreground" },
  tool: { align: "items-start", bubble: "bg-card text-muted-foreground border border-dashed" },
  system: { align: "items-start", bubble: "bg-card text-muted-foreground border" },
};

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ activeOrg }, { id }] = await Promise.all([getOrgContext(), params]);
  if (!activeOrg) redirect("/dashboard");

  const { onboardedAt } = await getSchedulingStatus(activeOrg.id);
  if (!onboardedAt) redirect("/scheduling/setup");

  const canManage = activeOrg.role === "owner" || activeOrg.role === "admin";

  const supabase = await createClient();
  const thread = await getThread(supabase, id);
  if (!thread || thread.orgId !== activeOrg.id) notFound();

  const turns = await listThreadTurns(supabase, id);
  const transcript = presentTranscript(turns);
  const badge = threadStatusBadge(thread);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={thread.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{threadKindLabel(thread.kind)}</Badge>
            <Badge variant={badge.tone}>{badge.label}</Badge>
            {thread.takenOverAt ? (
              <span className="text-muted-foreground text-xs">
                Taken over {formatTimestamp(thread.takenOverAt)}
              </span>
            ) : null}
          </span>
        }
        actions={
          <Link href="/scheduling/conversations" className={buttonVariants({ variant: "outline" })}>
            All conversations
          </Link>
        }
      />

      <section aria-label="Transcript" className="space-y-4">
        {transcript.length === 0 ? (
          <p className="text-muted-foreground text-sm">This conversation has no messages yet.</p>
        ) : (
          transcript.map((turn) => {
            const style = VOICE_STYLE[turn.voice];
            return (
              <div key={turn.id} className={cn("flex flex-col gap-1", style.align)}>
                <div className="text-muted-foreground flex items-baseline gap-2 px-1 text-xs">
                  <span className="font-medium">{turn.label}</span>
                  <span>{formatTimestamp(turn.createdAt)}</span>
                </div>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-2.5 text-sm leading-relaxed",
                    style.bubble,
                  )}
                >
                  {turn.text}
                </div>
              </div>
            );
          })
        )}
      </section>

      {canManage ? (
        <TakeoverPanel threadId={thread.id} mode={thread.mode} status={thread.status} />
      ) : (
        <p className="text-muted-foreground border-t pt-4 text-sm">
          Only owners and admins can take over or reply to a conversation.
        </p>
      )}
    </div>
  );
}
