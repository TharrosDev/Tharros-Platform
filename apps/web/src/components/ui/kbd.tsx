import * as React from "react";

import { cn } from "@/lib/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/60 px-1 font-sans text-[0.6875rem] font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
