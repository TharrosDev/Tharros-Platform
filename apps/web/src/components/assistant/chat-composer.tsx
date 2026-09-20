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
  placeholder,
  header,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  /** Override the textarea placeholder (Day 31: template-specific prompt). */
  placeholder?: string;
  /** Optional element rendered above the input (Day 31: active-template chip). */
  header?: React.ReactNode;
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
    <div className="bg-background sticky bottom-0 pt-2 pb-4 before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-gradient-to-t before:from-background before:to-transparent">
      {header ? <div className="mb-2">{header}</div> : null}
      <div
        className={cn(
          "border-input bg-card shadow-card focus-within:border-ring focus-within:ring-ring/25 relative flex items-end gap-2 rounded-xl border p-2 transition-[box-shadow,border-color] focus-within:ring-[3px]",
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
            disabled
              ? "This is a teammate's conversation."
              : (placeholder ?? "Ask about your documents…")
          }
          aria-label="Ask the assistant a question"
          className="max-h-44 min-h-10 resize-none border-0 bg-transparent px-2 py-2 text-[0.9375rem] shadow-none hover:border-0 "
        />
        <button
          type="button"
          onClick={streaming ? onStop : submit}
          disabled={!streaming && !canSend}
          aria-label={streaming ? "Stop generating" : "Send message"}
          className={cn(
            "relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 active:translate-y-px",
            streaming
              ? "bg-foreground text-background hover:bg-foreground/85"
              : "bg-primary text-primary-foreground hover:bg-primary/92 disabled:bg-muted disabled:text-muted-foreground",
          )}
        >
          {/* Crossfade between send and stop so the state change reads as one control. */}
          <ArrowUp
            className={cn(
              "absolute size-4 transition-all duration-150 ease-out",
              streaming ? "scale-50 opacity-0" : "scale-100 opacity-100",
            )}
          />
          <Square
            className={cn(
              "absolute size-3.5 fill-current transition-all duration-150 ease-out",
              streaming ? "scale-100 opacity-100" : "scale-50 opacity-0",
            )}
          />
        </button>
      </div>
      <p className="text-muted-foreground mt-2 px-1 text-center text-xs">
        Answers come only from your uploaded documents. Verify anything important.
      </p>
    </div>
  );
}
