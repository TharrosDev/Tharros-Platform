"use client";

import * as React from "react";
import { ArrowUp, Square } from "lucide-react";

import type { TemplateId } from "@/lib/assistant/templates";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

type TemplateOption = { id: TemplateId; label: string; description: string };

/**
 * Message composer. Auto-sizing textarea, Enter to send / Shift+Enter for a
 * newline, Esc to stop a streaming answer. Typing "/" opens the template menu
 * (arrow keys + Enter, or click). The action button is Send when idle and Stop
 * while a response streams.
 */
export function ChatComposer({
  onSend,
  onStop,
  streaming,
  disabled = false,
  placeholder,
  header,
  templates = [],
  onPickTemplate,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  /** Override the textarea placeholder (template-specific prompt). */
  placeholder?: string;
  /** Optional element rendered above the input (template chips / active template). */
  header?: React.ReactNode;
  /** Templates reachable with "/" commands. */
  templates?: readonly TemplateOption[];
  onPickTemplate?: (id: TemplateId) => void;
}) {
  const [value, setValue] = React.useState("");
  const [highlight, setHighlight] = React.useState(0);
  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !streaming && !disabled;
  const listId = React.useId();

  // "/em" → templates whose label starts with "em". Only while the whole input is the command.
  const slash = /^\/(\S*)$/.exec(value);
  const matches =
    slash && onPickTemplate
      ? templates.filter((t) => t.label.toLowerCase().startsWith(slash[1].toLowerCase()))
      : [];
  const menuOpen = matches.length > 0;

  function pick(id: TemplateId) {
    onPickTemplate?.(id);
    setValue("");
    setHighlight(0);
  }

  function submit() {
    if (!canSend) return;
    onSend(trimmed);
    setValue("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (menuOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setHighlight((h) => (h + step + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(matches[Math.min(highlight, matches.length - 1)].id);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setValue("");
        return;
      }
    }
    if (e.key === "Escape" && streaming) {
      e.preventDefault();
      onStop();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="bg-background sticky bottom-0 pt-2 pb-4 before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-gradient-to-t before:from-background before:to-transparent">
      {header ? <div className="mb-2">{header}</div> : null}
      <div className="relative">
        {menuOpen ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Templates"
            className="bg-popover absolute right-0 bottom-full left-0 z-20 mb-2 overflow-hidden rounded-xl border p-1 shadow-[0_8px_24px_-12px_oklch(0.28_0.045_255/0.25)]"
          >
            {matches.map((t, i) => (
              <li key={t.id} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(t.id)}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    "flex w-full items-baseline gap-3 rounded-lg px-3 py-2 text-left text-sm",
                    i === highlight && "bg-accent",
                  )}
                >
                  <span className="text-foreground font-semibold">/{t.label.toLowerCase()}</span>
                  <span className="text-muted-foreground truncate">{t.description}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div
          className={cn(
            "border-input bg-card focus-within:border-ring focus-within:ring-ring/25 relative flex items-end gap-2 rounded-2xl border p-2 transition-[box-shadow,border-color] focus-within:ring-[3px]",
            disabled && "opacity-60",
          )}
        >
          <Textarea
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={onKeyDown}
            disabled={disabled}
            rows={1}
            role={menuOpen ? "combobox" : undefined}
            aria-expanded={menuOpen || undefined}
            aria-controls={menuOpen ? listId : undefined}
            placeholder={
              disabled
                ? "This is a teammate's conversation."
                : (placeholder ??
                  (templates.length
                    ? "Ask anything, or type / for templates…"
                    : "Ask anything about your business…"))
            }
            aria-label="Ask the assistant a question"
            className="max-h-44 min-h-10 resize-none border-0 bg-transparent px-2 py-2 text-[0.9375rem] shadow-none hover:border-0 focus-visible:border-0 focus-visible:ring-0"
          />
          <button
            type="button"
            onClick={streaming ? onStop : submit}
            disabled={!streaming && !canSend}
            aria-label={streaming ? "Stop generating (Esc)" : "Send message"}
            className={cn(
              "relative inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-150 active:translate-y-px",
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
      </div>
      <p className="text-muted-foreground mt-2 px-1 text-center text-xs">
        The assistant can make mistakes. Check sources, and nothing changes until you confirm it.
      </p>
    </div>
  );
}
