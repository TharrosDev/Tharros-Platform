"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, BookOpen } from "lucide-react";

import type { Citation } from "@/lib/documents/rag-prompt";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Day 29 — source citations under an assistant turn. One chip per cited
 * document; clicking any chip opens a dialog listing the sources with a link to
 * the Knowledge library (there's no per-document viewer until Day 32).
 */
export function Citations({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = React.useState(false);
  if (citations.length === 0) return null;

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground type-meta mr-0.5">
          {citations.length} source{citations.length === 1 ? "" : "s"}
        </span>
        {citations.map((c) => (
          <button
            key={c.documentId}
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full outline-none focus-visible:ring-ring/40 focus-visible:ring-[3px]"
          >
            <Badge variant="info" className="max-w-[16rem] cursor-pointer hover:bg-info/25">
              <FileText className="size-3" />
              <span className="truncate">{c.filename}</span>
            </Badge>
          </button>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sources</DialogTitle>
            <DialogDescription>
              This answer drew from {citations.length} document
              {citations.length === 1 ? "" : "s"} in your Knowledge base.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5">
            {citations.map((c) => (
              <li
                key={c.documentId}
                className="border-border bg-card flex items-center gap-2.5 rounded-md border px-3 py-2"
              >
                <FileText className="text-muted-foreground size-4 shrink-0" />
                <span className="text-foreground truncate text-sm font-medium" title={c.filename}>
                  {c.filename}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/knowledge" className={cn(buttonVariants({ variant: "outline" }), "mt-1 w-full")}>
            <BookOpen className="size-4" />
            View in Knowledge
          </Link>
        </DialogContent>
      </Dialog>
    </>
  );
}
