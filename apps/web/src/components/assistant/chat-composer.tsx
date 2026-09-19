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
    <div className="sticky bottom-0 rounded-t-2xl bg-background/78 pt-3 pb-4 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/68">
      {header ? <div className="mb-2">{header}</div> : null}
      <div
        className={cn(
          "border-input bg-card/90 shadow-raised focus-within:border-ring focus-within:ring-ring/30 relative flex items-end gap-2 overflow-hidden rounded-2xl border p-2.5 backdrop-blur-xl transition-[box-shadow,border-color,transform] focus-within:-translate-y-px focus-within:ring-[4px] before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary/45 before:to-transparent",
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
          className="max-h-44 min-h-11 resize-none border-0 bg-transparent px-2 py-2.5 shadow-none focus-visible:ring-0"
        />
        <button
          type="button"
          onClick={streaming ? onStop : submit}
          disabled={!streaming && !canSend}
          aria-label={streaming ? "Stop generating" : "Send message"}
          className={cn(
            "relative mb-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl shadow-xs transition-all duration-200 outline-none focus-visible:ring-ring/35 focus-visible:ring-[4px] active:scale-95",
            streaming
              ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40",
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
      <p className="text-muted-foreground mt-1.5 px-1 text-center text-xs">
        Answers come only from your uploaded documents. Verify anything important.
      </p>
    </div>
  );
}
