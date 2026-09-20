import { HeaderSkeleton, PanelSkeleton } from "@/components/board/board-skeleton";

/** Post-checkout confirmation. */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="space-y-8">
      <HeaderSkeleton action={false} />
      <PanelSkeleton lines={3} />
    </div>
  );
}
