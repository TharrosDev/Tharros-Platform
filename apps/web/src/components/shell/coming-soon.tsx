import type { NavIcon } from "@/components/shell/nav";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Shared empty state for product pages that ship in a later phase. A calm,
 * on-brand placeholder seated on the inset surface-2 layer: a cobalt-soft
 * icon tile, an "In the works" tag, and a line that tells the owner what
 * will live here.
 */
function ComingSoon({ icon: Icon, message }: { icon: NavIcon; message: string }) {
  return (
    <EmptyState
      icon={<Icon />}
      title={
        <Badge variant="outline" className="bg-card gap-1.5">
          <span className="bg-primary size-1.5 rounded-full" />
          In the works
        </Badge>
      }
      description={message}
      className="min-h-[24rem]"
    />
  );
}

export { ComingSoon };
