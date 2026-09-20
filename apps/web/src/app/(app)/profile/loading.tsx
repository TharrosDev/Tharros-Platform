import { HeaderSkeleton, PanelSkeleton } from "@/components/board/board-skeleton";

/** Profile. */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="space-y-8">
      <HeaderSkeleton action={false} />
      <PanelSkeleton lines={4} />
    </div>
  );
}
