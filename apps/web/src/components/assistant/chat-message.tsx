"use client";

import * as React from "react";

import type { ChatMessage } from "@/lib/assistant/types";
import { TharrosMark } from "@/components/brand/logo";
import { AssistantMarkdown } from "@/components/assistant/markdown";
import { CitationFooter, NotGroundedNote, SourcesDialog } from "@/components/assistant/citations";
import { MessageActions } from "@/components/assistant/message-actions";
import { ProposalCard } from "@/components/assistant/proposal-card";

/**
 * Day 29/30 — one chat turn. User turns sit right in a soft-cobalt bubble (plain
 * text, newlines preserved). Assistant turns sit left with the Tharros mark as
 * avatar, rendered as markdown with inline `[n]` citation chips, a streaming
 * caret, and a trust footer (Day 30) listing the documents the answer drew from.
 */
export function ChatTurn({
  message,
  streaming = false,
}: {
  message: ChatMessage;
  streaming?: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-card text-foreground max-w-[85%] rounded-xl rounded-br-sm border px-4 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  return <AssistantTurn message={message} streaming={streaming} />;
}

function AssistantTurn({ message, streaming }: { message: ChatMessage; streaming: boolean }) {
  // Which source the sources dialog is opened to (null = closed). Shared by the
  // inline `[n]` markers and the footer source list.
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className="rounded-xl text-primary-soft-foreground bg-card mt-0.5 flex size-7 shrink-0 items-center justify-center border"
      >
        <TharrosMark className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        {message.content ? (
          <AssistantMarkdown
            content={message.content}
            citations={message.citations}
            onCite={setOpenIndex}
          />
        ) : streaming && !message.statusLabel ? (
          <ThinkingDots />
        ) : null}
        {streaming && message.statusLabel ? (
          <p role="status" className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
            <span className="bg-primary size-1.5 animate-pulse rounded-full motion-reduce:animate-none" />
            {message.statusLabel}…
          </p>
        ) : null}
        {message.proposals?.map((p) => (
          <ProposalCard key={p.id} proposal={p} />
        ))}
        {streaming && message.content ? (
          <span className="bg-primary ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse align-middle motion-reduce:animate-none" />
        ) : null}
        {!streaming && message.content ? (
          <>
            {message.citations.length > 0 ? (
              <CitationFooter citations={message.citations} onOpen={setOpenIndex} />
            ) : (
              <NotGroundedNote />
            )}
            <MessageActions
              content={message.content}
              messageId={message.persistedId ?? message.id}
            />
          </>
        ) : null}
        <SourcesDialog
          citations={message.citations}
          openIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      </div>
    </div>
  );
}

/** Pre-first-token indicator: three cobalt dots breathing. */
function ThinkingDots() {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label="The assistant is thinking"
      className="flex items-center gap-1 py-1.5"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="bg-muted-foreground/60 size-1.5 animate-pulse motion-reduce:animate-none"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}
