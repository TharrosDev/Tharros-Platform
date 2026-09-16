import * as React from "react";

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted skeleton-shimmer overflow-hidden rounded-lg", className)}
      {...props}
    />
  );
}

export { Skeleton };
