import { Skeleton } from "@/components/ui/skeleton";

/**
 * Day 35 — route skeleton for /knowledge. Mirrors the page (header + uploader
 * zone + document table) so navigation shows structure, not a blank wait.
 */
export default function KnowledgeLoading() {
  return (
    <div role="status" aria-busy="true" className="space-y-8">
      <span className="sr-only">Loading your knowledge base…</span>

      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {/* Uploader zone */}
      <Skeleton className="h-44 w-full rounded-xl" />

      {/* Document table */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-full max-w-sm rounded-lg" />
        <div className="space-y-2 pt-1">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
