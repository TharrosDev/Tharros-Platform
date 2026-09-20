import {
  BaySkeleton,
  HeaderSkeleton,
  LogSkeleton,
  PanelSkeleton,
} from "@/components/board/board-skeleton";

/** Workflows, the builder and the run history. Was a stack of generic grey rectangles. */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="space-y-8">
      <HeaderSkeleton />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <BaySkeleton rows={4} />
        <PanelSkeleton lines={5} />
      </div>
      <LogSkeleton rows={5} />
    </div>
  );
}
