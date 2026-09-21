"use client";

import * as React from "react";
import { Check, Copy, Download, Pencil, ThumbsDown, ThumbsUp, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { draftFilename } from "@/lib/assistant/export";
import { rateMessage } from "@/lib/assistant/feedback-actions";

/**
 * Day 31 — per-turn toolbar for a finished assistant answer: Copy, Export (a
 * `.md` download), and an inline Edit toggle. Editing is local only — it never
 * writes back to the stored conversation; Copy and Export reflect the edited
 * text so a generated draft can be tweaked and taken out of the app.
 */
export function MessageActions({
  content,
  label = "answer",
  messageId,
  extra,
}: {
  /** Persisted message id; enables thumbs feedback. */
  messageId?: string;
  /** Extra toolbar controls (Regenerate on the latest turn). */
  extra?: React.ReactNode;
  /** The assistant turn's text as persisted/streamed. */
  content: string;
  /** Human label used for the download filename + edit textarea aria-label. */
  label?: string;
}) {
  const toast = useToast();
  const [editing, setEditing] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  // Local edit buffer. `null` until the user starts editing, so Copy/Export use
  // the live `content` until then and pick up edits once made. This turn only
  // mounts after streaming finishes (see chat-message), so `content` is stable.
  const [draft, setDraft] = React.useState<string | null>(null);
  const [rating, setRating] = React.useState<1 | -1 | null>(null);

  const onRate = React.useCallback(
    async (value: 1 | -1) => {
      if (!messageId) return;
      setRating(value);
      const res = await rateMessage(messageId, value);
      if (res.ok && value === -1) {
        toast.add({
          title: "Thanks",
          description: "Your team's admins will see this in Knowledge gaps.",
        });
      } else if (!res.ok) {
        setRating(null);
        toast.add({ title: "Couldn't save feedback" });
      }
    },
    [messageId, toast],
  );

  const text = draft ?? content;

  const onCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
      toast.add({ title: "Copied to clipboard" });
    } catch {
      toast.add({ title: "Couldn't copy", description: "Your browser blocked clipboard access." });
    }
  }, [text, toast]);

  const onExport = React.useCallback(() => {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = draftFilename(label, "md");
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [text, label]);

  return (
    <div className="mt-3">
      {editing ? (
        <Textarea
          value={text}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={`Edit ${label}`}
          rows={Math.min(20, Math.max(4, text.split("\n").length + 1))}
          className="bg-card max-h-96 w-full resize-y text-[0.9375rem] leading-relaxed"
        />
      ) : null}
      <div className="text-muted-foreground mt-1.5 flex items-center gap-1">
        <ActionButton onClick={onCopy} label={copied ? "Copied" : "Copy"}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </ActionButton>
        <ActionButton onClick={onExport} label="Export as Markdown">
          <Download className="size-3.5" />
          Export
        </ActionButton>
        <ActionButton
          onClick={() => {
            if (!editing && draft === null) setDraft(content);
            setEditing((v) => !v);
          }}
          label={editing ? "Done editing" : "Edit"}
          active={editing}
        >
          {editing ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
          {editing ? "Done" : "Edit"}
        </ActionButton>
        {messageId ? (
          <>
            <ActionButton onClick={() => void onRate(1)} label="Helpful" active={rating === 1}>
              <ThumbsUp className="size-3.5" />
            </ActionButton>
            <ActionButton
              onClick={() => void onRate(-1)}
              label="Not helpful"
              active={rating === -1}
            >
              <ThumbsDown className="size-3.5" />
            </ActionButton>
          </>
        ) : null}
        {extra}
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  label,
  active = false,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "hover:bg-accent hover:text-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
        active && "bg-accent text-foreground",
      )}
    >
      {children}
    </button>
  );
}
