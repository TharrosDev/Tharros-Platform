import { BaySkeleton, HeaderSkeleton } from "@/components/board/board-skeleton";

/** Cross-org feedback review. */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="space-y-8">
      <HeaderSkeleton action={false} />
      <BaySkeleton rows={6} />
    </div>
  );
}
