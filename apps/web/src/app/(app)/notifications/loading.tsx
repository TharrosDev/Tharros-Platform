import { Skeleton } from "@/components/ui/skeleton";

/** Route skeleton for /notifications — header + a list of inbox rows. */
export default function NotificationsLoading() {
  return (
    <div role="status" aria-busy="true" className="space-y-8">
      <span className="sr-only">Loading notifications…</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="divide-border/60 overflow-hidden rounded-lg border border-border/60 divide-y">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3.5">
            <Skeleton className="mt-1.5 size-2 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3.5 w-72 max-w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
