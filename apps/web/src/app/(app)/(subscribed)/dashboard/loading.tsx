import { Skeleton } from "@/components/ui/skeleton";

/**
 * Day 35 — route skeleton for /dashboard. Mirrors the header + focal "waiting on
 * you" card + the activity / right-rail grid.
 */
export default function DashboardLoading() {
  return (
    <div role="status" aria-busy="true" className="space-y-8">
      <span className="sr-only">Loading your dashboard…</span>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Focal card */}
      <Skeleton className="h-44 w-full rounded-lg" />

      {/* Activity + right rail */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Skeleton className="h-64 w-full rounded-lg" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
