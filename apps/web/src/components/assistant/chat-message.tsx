"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";

import type { ChatMessage } from "@/lib/assistant/types";
import { TharrosMark } from "@/components/brand/logo";
import { AssistantMarkdown } from "@/components/assistant/markdown";
import { CitationFooter, NotGroundedNote, SourcesDialog } from "@/components/assistant/citations";
import { MessageActions } from "@/components/assistant/message-actions";
import { ProposalCard } from "@/components/assistant/proposal-card";
import { DataBlocks, StepTrail, Suggestions } from "@/components/assistant/turn-parts";

/**
 * One chat turn. User turns sit right in a soft bubble. Assistant turns sit
 * left with the Tharros mark: the tool-step trail, the streamed markdown answer
 * with inline `[n]` citation chips, cards for records the tools returned,
 * confirm cards for proposed changes, then sources, actions and follow-ups.
 */
export function ChatTurn({
  message,
  streaming = false,
  isLast = false,
  onRegenerate,
  onSuggest,
}: {
  message: ChatMessage;
  streaming?: boolean;
  /** The latest turn in the thread: gets Regenerate and follow-up suggestions. */
  isLast?: boolean;
  onRegenerate?: () => void;
  onSuggest?: (q: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-primary-soft text-foreground max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <AssistantTurn
      message={message}
      streaming={streaming}
      isLast={isLast}
      onRegenerate={onRegenerate}
      onSuggest={onSuggest}
    />
  );
}

function AssistantTurn({
  message,
  streaming,
  isLast,
  onRegenerate,
  onSuggest,
}: {
  message: ChatMessage;
  streaming: boolean;
  isLast: boolean;
  onRegenerate?: () => void;
  onSuggest?: (q: string) => void;
}) {
  // Which source the sources dialog is opened to (null = closed). Shared by the
  // inline `[n]` markers and the footer source list.
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  const steps = message.steps ?? [];
  const usedTools = steps.length > 0 || (message.data?.length ?? 0) > 0;

  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className="text-primary-soft-foreground bg-card mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border"
      >
        <TharrosMark className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <StepTrail steps={steps} streaming={streaming} working={Boolean(message.statusLabel)} />
        {message.content ? (
          <AssistantMarkdown
            content={message.content}
            citations={message.citations}
            onCite={setOpenIndex}
          />
        ) : streaming && steps.length === 0 ? (
          <ThinkingDots />
        ) : null}
        {streaming && message.content ? (
          <span className="bg-primary ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse rounded-full align-middle motion-reduce:animate-none" />
        ) : null}
        {message.data?.length ? <DataBlocks data={message.data} /> : null}
        {message.proposals?.map((p) => (
          <ProposalCard key={p.id} proposal={p} />
        ))}
        {!streaming && message.content ? (
          <>
            {message.citations.length > 0 ? (
              <CitationFooter citations={message.citations} onOpen={setOpenIndex} />
            ) : usedTools ? null : (
              <NotGroundedNote />
            )}
            <MessageActions
              content={message.content}
              messageId={message.persistedId ?? message.id}
              extra={
                isLast && onRegenerate ? (
                  <button
                    type="button"
                    onClick={onRegenerate}
                    className="hover:bg-accent hover:text-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors"
                  >
                    <RotateCcw className="size-3.5" />
                    Regenerate
                  </button>
                ) : null
              }
            />
            {isLast && onSuggest && message.suggestions ? (
              <Suggestions items={message.suggestions} onPick={onSuggest} />
            ) : null}
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

/** Pre-first-token indicator: three dots breathing. */
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
          className="bg-muted-foreground/60 size-1.5 animate-pulse rounded-full motion-reduce:animate-none"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}
