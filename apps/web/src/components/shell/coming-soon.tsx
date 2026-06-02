import type { NavIcon } from "@/components/shell/nav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Shared empty state for product pages that ship in a later phase. A calm,
 * on-brand placeholder: a cobalt-soft icon tile, an "In the works" tag, and a
 * line that tells the owner what will live here.
 */
function ComingSoon({
  icon: Icon,
  message,
}: {
  icon: NavIcon;
  message: string;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-4 border-dashed py-20 text-center">
      <span className="bg-primary-soft text-primary-soft-foreground flex size-14 items-center justify-center rounded-xl [&>svg]:size-7">
        <Icon />
      </span>
      <Badge variant="outline" className="gap-1.5">
        <span className="bg-primary size-1.5 rounded-full" />
        In the works
      </Badge>
      <p className="text-muted-foreground max-w-sm text-pretty">{message}</p>
    </Card>
  );
}

export { ComingSoon };
