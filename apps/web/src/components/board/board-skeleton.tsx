import { Skeleton } from "@/components/ui/skeleton";

/*
  Loading states are the silhouette of what is coming. A bay skeleton is a
  labelled header over empty slots at strip height, which is what the page
  will be a moment later.
*/

/** The struck header every board surface opens with. */
function HeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="border-foreground flex items-end justify-between gap-4 border-b-2 pb-3">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3.5 w-40" />
      </div>
      {action ? <Skeleton className="h-control w-32" /> : null}
    </div>
  );
}

/** A bay with `rows` empty slots in it. */
function BaySkeleton({ rows = 4, lead = false }: { rows?: number; lead?: boolean }) {
  return (
    <section className="flex min-w-0 flex-col">
      <div
        className={
          lead
            ? "border-foreground flex items-end justify-between gap-3 border-b-2 pb-2"
            : "border-border flex items-end justify-between gap-3 border-b pb-2"
        }
      >
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-3.5 w-8" />
      </div>
      {lead ? <Skeleton className="mt-3 mb-1 h-12 w-20" /> : null}
      <div className="border-border flex flex-col border-x border-b">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="border-border flex items-center gap-4 border-b p-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-1 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="h-7 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** A ruled log: continuous lines, no slots. */
function LogSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <section>
      <div className="border-border flex items-end justify-between gap-3 border-b pb-2">
        <Skeleton className="h-3.5 w-28" />
      </div>
      <div className="border-border border-x border-b">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="border-border flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0"
          >
            <Skeleton className="h-3.5 w-14 shrink-0" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-3.5 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** A panel of stock: header rule, then body lines. */
function PanelSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="border-border bg-card border">
      <div className="border-border border-b px-4 py-3">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="space-y-3 px-4 py-4">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} className="h-4" style={{ width: `${90 - index * 12}%` }} />
        ))}
      </div>
    </div>
  );
}

export { BaySkeleton, HeaderSkeleton, LogSkeleton, PanelSkeleton };
