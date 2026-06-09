import { Skeleton } from "@/components/ui/skeleton";

/** Section skeleton for /settings/* — header + a couple of card blocks. */
export default function SettingsLoading() {
  return (
    <div role="status" aria-busy="true" className="space-y-8">
      <span className="sr-only">Loading settings…</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <Skeleton className="h-44 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}
