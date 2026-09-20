import * as React from "react";

import { cn } from "@/lib/utils";

/* A field caption on a printed form: engraved, condensed, tracked out. */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "type-meta text-muted-foreground flex items-center gap-2 select-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-45",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
