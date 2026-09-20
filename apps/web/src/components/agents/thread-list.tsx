"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import type { ThreadListItem } from "@/lib/agents/queries";
import { threadKindLabel, threadStatusBadge } from "@/lib/agents/present";
import { formatTimestamp } from "@/lib/notifications/types";
import { fuzzyFilter } from "@/lib/search/fuzzy";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Resolved" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

/**
 * Client-side search + status filter over the loaded conversation page (the
 * inbox is bounded at 50 threads, so no extra endpoint is needed). Search
 * matches the title, kind label, and last snippet with the shared fuzzy
 * scorer.
 */
export function ThreadList({ threads }: { threads: ThreadListItem[] }) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");

  const byStatus = status === "all" ? threads : threads.filter((t) => t.status === status);
  const visible = fuzzyFilter(
    query,
    byStatus,
    (t) => `${t.title} ${threadKindLabel(t.kind)} ${t.lastSnippet ?? ""}`,
    byStatus.length,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1 basis-56">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="pl-9"
          />
        </div>
        <div role="group" aria-label="Filter by status" className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              data-active={status === f.value || undefined}
              className={cn(
                " px-3 py-1.5 text-sm font-medium transition-colors ",
                status === f.value
                  ? "bg-primary-soft text-primary-soft-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">No conversations match.</p>
      ) : (
        <ul className="divide-border/60 bg-card overflow-hidden border divide-y">
          {visible.map((t) => {
            const badge = threadStatusBadge(t);
            return (
              <li key={t.id} className="hover:bg-muted/40 transition-colors">
                <Link
                  href={`/scheduling/conversations/${t.id}`}
                  className="flex items-start gap-4 px-4 py-3.5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{t.title}</span>
                      <Badge variant="secondary">{threadKindLabel(t.kind)}</Badge>
                      <Badge variant={badge.tone}>{badge.label}</Badge>
                    </div>
                    {t.lastSnippet ? (
                      <p className="text-muted-foreground line-clamp-1 text-sm">{t.lastSnippet}</p>
                    ) : null}
                    <p className="text-muted-foreground text-xs">
                      {t.turnCount} {t.turnCount === 1 ? "message" : "messages"} ·{" "}
                      {formatTimestamp(t.updatedAt)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
