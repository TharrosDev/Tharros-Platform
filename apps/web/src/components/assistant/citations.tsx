"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, BookOpen } from "lucide-react";

import type { Citation } from "@/lib/documents/rag-prompt";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Day 30 — the trust layer under an assistant turn.
 *
 *  - `CitationFooter` — a quiet "Based on N documents" divider + a numbered
 *    source list; each `[n] filename` opens the sources dialog at that source.
 *  - `SourcesDialog` — lists every cited document, highlighting the opened one,
 *    with a link to the Knowledge library (no per-document viewer until Day 32).
 *  - `NotGroundedNote` — the honest, low-key state for an answer with no sources.
 *
 * Inline `[n]` markers in the answer body are rendered by `AssistantMarkdown`;
 * both the markers and this footer call the same `onOpen(index)`.
 */

export function CitationFooter({
  citations,
  onOpen,
}: {
  citations: Citation[];
  onOpen: (index: number) => void;
}) {
  if (citations.length === 0) return null;
  const ordered = [...citations].sort((a, b) => a.index - b.index);

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="text-muted-foreground type-meta whitespace-nowrap">
          Based on {citations.length} document{citations.length === 1 ? "" : "s"}
        </span>
        <span aria-hidden className="bg-border h-px flex-1" />
      </div>
      <ul className="flex flex-col gap-1">
        {ordered.map((c) => (
          <li key={c.documentId}>
            <button
              type="button"
              onClick={() => onOpen(c.index)}
              className="group hover:bg-accent/60 focus-visible:ring-ring/40 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2"
            >
              <span className="text-primary bg-primary-soft flex size-5 shrink-0 items-center justify-center rounded text-xs font-semibold tabular-nums">
                {c.index}
              </span>
              <FileText className="text-muted-foreground size-3.5 shrink-0" />
              <span className="text-foreground truncate text-sm" title={c.filename}>
                {c.filename}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NotGroundedNote() {
  return (
    <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
      <span aria-hidden className="bg-muted-foreground/50 size-1.5 rounded-full" />
      Not based on your documents
    </p>
  );
}

export function SourcesDialog({
  citations,
  openIndex,
  onClose,
}: {
  citations: Citation[];
  openIndex: number | null;
  onClose: () => void;
}) {
  const ordered = [...citations].sort((a, b) => a.index - b.index);

  return (
    <Dialog open={openIndex !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sources</DialogTitle>
          <DialogDescription>
            This answer drew from {citations.length} document
            {citations.length === 1 ? "" : "s"} in your Knowledge base.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1.5">
          {ordered.map((c) => {
            const active = c.index === openIndex;
            return (
              <li
                key={c.documentId}
                className={cn(
                  "flex items-center gap-2.5 rounded-md border px-3 py-2 transition-colors",
                  active ? "border-ring bg-primary-soft/50" : "border-border bg-card",
                )}
              >
                <span className="text-primary bg-primary-soft flex size-5 shrink-0 items-center justify-center rounded text-xs font-semibold tabular-nums">
                  {c.index}
                </span>
                <FileText className="text-muted-foreground size-4 shrink-0" />
                <span className="text-foreground truncate text-sm font-medium" title={c.filename}>
                  {c.filename}
                </span>
              </li>
            );
          })}
        </ul>
        <Link href="/knowledge" className={cn(buttonVariants({ variant: "outline" }), "mt-1 w-full")}>
          <BookOpen className="size-4" />
          View in Knowledge
        </Link>
      </DialogContent>
    </Dialog>
  );
}
