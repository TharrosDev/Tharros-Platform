import * as React from "react";

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted/85 skeleton-shimmer overflow-hidden rounded-xl border border-border/30", className)}
      {...props}
    />
  );
}

export { Skeleton };
