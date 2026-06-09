import { Skeleton } from "@/components/ui/skeleton";

/** Route skeleton for /billing — header + plan summary + invoice/portal cards. */
export default function BillingLoading() {
  return (
    <div role="status" aria-busy="true" className="space-y-8">
      <span className="sr-only">Loading billing…</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <Skeleton className="h-48 w-full rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-36 w-full rounded-lg" />
        <Skeleton className="h-36 w-full rounded-lg" />
      </div>
    </div>
  );
}
