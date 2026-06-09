import { Skeleton } from "@/components/ui/skeleton";

/**
 * Segment skeleton for /scheduling/* — header + content blocks. Shown while any
 * scheduling surface (hub, calendar, availability, team, …) loads its data.
 */
export default function SchedulingLoading() {
  return (
    <div role="status" aria-busy="true" className="space-y-8">
      <span className="sr-only">Loading scheduling…</span>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-44" />
      </div>

      <Skeleton className="h-40 w-full rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    </div>
  );
}
