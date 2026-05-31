import type { NavIcon } from "@/components/shell/nav";
import { Card } from "@/components/ui/card";

/** Shared empty state for product pages that ship in a later phase. */
function ComingSoon({
  icon: Icon,
  message,
}: {
  icon: NavIcon;
  message: string;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center">
      <span className="bg-secondary text-foreground flex size-12 items-center justify-center rounded-lg border border-border [&>svg]:size-6">
        <Icon />
      </span>
      <p className="text-muted-foreground max-w-sm text-sm">{message}</p>
    </Card>
  );
}

export { ComingSoon };
