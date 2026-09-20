import { HeaderSkeleton, PanelSkeleton } from "@/components/board/board-skeleton";

/** Checkout. */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="space-y-8">
      <HeaderSkeleton action={false} />
      <PanelSkeleton lines={6} />
    </div>
  );
}
