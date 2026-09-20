import { BaySkeleton, HeaderSkeleton, LogSkeleton } from "@/components/board/board-skeleton";

/** The board arriving: the lead bay, the state bay and the record. */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="space-y-8">
      <HeaderSkeleton />
      <div className="grid gap-x-8 gap-y-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <BaySkeleton rows={4} lead />
        <BaySkeleton rows={5} />
      </div>
      <LogSkeleton />
    </div>
  );
}
