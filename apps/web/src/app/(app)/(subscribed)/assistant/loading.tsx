import { Skeleton } from "@/components/ui/skeleton";

/**
 * Day 35 — route skeleton for /assistant. Mirrors the page layout (header +
 * centered thread + composer bar) so navigation shows structure, not a blank
 * wait, with no jump when the real content lands.
 */
export default function AssistantLoading() {
  return (
    <div role="status" aria-busy="true" className="flex flex-1 flex-col gap-6">
      <span className="sr-only">Loading the assistant…</span>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Thread */}
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-8 shrink-0 rounded-md" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-4 w-[92%]" />
              <Skeleton className="h-4 w-[78%]" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="mx-auto w-full max-w-3xl">
        <Skeleton className="h-[3.25rem] w-full rounded-xl" />
      </div>
    </div>
  );
}
