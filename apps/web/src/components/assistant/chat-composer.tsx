"use client";

import * as React from "react";
import { ArrowUp, Square } from "lucide-react";

import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

/**
 * Day 29 — message composer. Auto-sizing textarea (`field-sizing-content`),
 * Enter to send / Shift+Enter for a newline, capped height with scroll. The
 * action button is Send when idle and Stop while a response streams.
 */
export function ChatComposer({
  onSend,
  onStop,
  streaming,
  disabled = false,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = React.useState("");
  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !streaming && !disabled;

  function submit() {
    if (!canSend) return;
    onSend(trimmed);
    setValue("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="bg-background/85 sticky bottom-0 pt-2 pb-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div
        className={cn(
          "border-input bg-card shadow-card focus-within:border-ring focus-within:ring-ring/40 relative flex items-end gap-2 rounded-xl border p-2 transition-[box-shadow,border-color] focus-within:ring-[3px]",
          disabled && "opacity-60",
        )}
      >
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={
            disabled ? "This is a teammate's conversation." : "Ask about your documents…"
          }
          aria-label="Ask the assistant a question"
          className="max-h-44 min-h-11 resize-none border-0 bg-transparent px-2 py-2.5 shadow-none focus-visible:ring-0"
        />
        <button
          type="button"
          onClick={streaming ? onStop : submit}
          disabled={!streaming && !canSend}
          aria-label={streaming ? "Stop generating" : "Send message"}
          className={cn(
            "mb-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition-all duration-150 outline-none focus-visible:ring-ring/40 focus-visible:ring-[3px]",
            streaming
              ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40",
          )}
        >
          {streaming ? <Square className="size-3.5 fill-current" /> : <ArrowUp className="size-4" />}
        </button>
      </div>
      <p className="text-muted-foreground mt-1.5 px-1 text-center text-xs">
        Answers come only from your uploaded documents. Verify anything important.
      </p>
    </div>
  );
}
