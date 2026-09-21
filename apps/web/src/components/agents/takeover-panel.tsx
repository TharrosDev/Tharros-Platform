"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  takeOverThreadAction,
  releaseThreadAction,
  postManualReplyAction,
  setThreadStatusAction,
  type ConversationActionState,
} from "@/lib/agents/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

/**
 * Day 58 — the manager control surface on a conversation. Take over / release the
 * thread, post a manual reply (only while you hold it), and resolve / reopen it.
 * Each control is its own `useActionState` form so they report independently; the
 * server actions revalidate the page, so the transcript above re-renders on
 * success. Toasts surface the action message.
 */
export function TakeoverPanel({
  threadId,
  mode,
  status,
}: {
  threadId: string;
  mode: "ai" | "human";
  status: "open" | "closed";
}) {
  const isHuman = mode === "human";
  const isClosed = status === "closed";

  return (
    <div className="rounded-xl bg-card space-y-5 border p-5">
      <div className="flex flex-wrap items-center gap-3">
        {isHuman ? (
          <SingleAction
            action={releaseThreadAction}
            threadId={threadId}
            label="Hand back to agent"
            pendingLabel="Releasing…"
            variant="outline"
          />
        ) : (
          <SingleAction
            action={takeOverThreadAction}
            threadId={threadId}
            label="Take over conversation"
            pendingLabel="Taking over…"
          />
        )}

        <SingleAction
          action={setThreadStatusAction}
          threadId={threadId}
          label={isClosed ? "Reopen" : "Mark resolved"}
          pendingLabel="Saving…"
          variant="outline"
          extra={{ status: isClosed ? "open" : "closed" }}
        />
      </div>

      <ReplyForm threadId={threadId} disabled={!isHuman} />
      {!isHuman ? (
        <p className="text-muted-foreground text-xs">
          Take the conversation over to reply in place of the agent.
        </p>
      ) : null}
    </div>
  );
}

/** A one-button form bound to a server action, with a toast on completion. */
function SingleAction({
  action,
  threadId,
  label,
  pendingLabel,
  variant,
  extra,
}: {
  action: (prev: ConversationActionState, formData: FormData) => Promise<ConversationActionState>;
  threadId: string;
  label: string;
  pendingLabel: string;
  variant?: "outline";
  extra?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const toast = useToast();
  const seen = useRef<ConversationActionState | null>(null);

  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    if (state.message) {
      toast.add({ title: state.ok ? "Done" : "Couldn't complete", description: state.message });
    }
  }, [state, toast]);

  return (
    <form action={formAction}>
      <input type="hidden" name="threadId" value={threadId} />
      {extra
        ? Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)
        : null}
      <Button type="submit" disabled={pending} variant={variant}>
        {pending ? pendingLabel : label}
      </Button>
    </form>
  );
}

/** The manual-reply composer. Only enabled once the manager holds the thread. */
function ReplyForm({ threadId, disabled }: { threadId: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(postManualReplyAction, {});
  const toast = useToast();
  const seen = useRef<ConversationActionState | null>(null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    if (state.message) {
      toast.add({ title: state.ok ? "Reply sent" : "Couldn't send", description: state.message });
    }
    if (state.ok) ref.current?.reset();
  }, [state, toast]);

  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <input type="hidden" name="threadId" value={threadId} />
      <Textarea
        name="body"
        rows={3}
        maxLength={4000}
        disabled={disabled || pending}
        placeholder={
          disabled ? "Take over to reply…" : "Reply to this conversation as the manager…"
        }
        aria-label="Manual reply"
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={disabled || pending}>
          {pending ? "Sending…" : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
