import { HeaderSkeleton, LogSkeleton, PanelSkeleton } from "@/components/board/board-skeleton";

/** A lead detail: the draft, the timeline and the record. Previously inherited the list skeleton. */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="space-y-8">
      <HeaderSkeleton />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          <PanelSkeleton lines={4} />
          <LogSkeleton rows={5} />
        </div>
        <PanelSkeleton lines={6} />
      </div>
    </div>
  );
}
