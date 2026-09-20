import * as React from "react";

import { cn } from "@/lib/utils";

/* A key legend: square cap, engraved label. */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "bg-surface-2 text-muted-foreground border-input type-meta inline-flex h-5 min-w-5 items-center justify-center border px-1 font-sans",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
