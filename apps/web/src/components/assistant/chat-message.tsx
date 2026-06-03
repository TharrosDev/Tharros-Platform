import * as React from "react";

import type { ChatMessage } from "@/lib/assistant/types";
import { TharrosMark } from "@/components/brand/logo";
import { AssistantMarkdown } from "@/components/assistant/markdown";
import { Citations } from "@/components/assistant/citations";

/**
 * Day 29 — one chat turn. User turns sit right in a soft-cobalt bubble (plain
 * text, newlines preserved). Assistant turns sit left on the canvas with the
 * Tharros mark as avatar, rendered as markdown, with source chips beneath. While
 * streaming, a blinking cobalt caret trails the partial text.
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
        <div className="bg-primary-soft text-primary-soft-foreground max-w-[85%] rounded-lg rounded-br-sm px-3.5 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className="text-primary bg-primary-soft mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md"
      >
        <TharrosMark className="size-4" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        {message.content ? (
          <AssistantMarkdown content={message.content} />
        ) : streaming ? (
          <ThinkingDots />
        ) : null}
        {streaming && message.content ? (
          <span className="bg-primary ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse rounded-full align-middle motion-reduce:animate-none" />
        ) : null}
        {!streaming ? <Citations citations={message.citations} /> : null}
      </div>
    </div>
  );
}

/** Pre-first-token indicator: three cobalt dots breathing. */
function ThinkingDots() {
  return (
    <span className="flex items-center gap-1 py-1.5" aria-label="Thinking">
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
