import * as React from "react";

import { cn } from "@/lib/utils";

/*
  A ruled box on a printed form. Square, one visible rule, no shadow: a field
  is cut into the stock rather than floated above it.
*/
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-card text-foreground placeholder:text-muted-foreground/75 type-strip h-control flex w-full min-w-0 border px-3 py-2 transition-colors hover:border-foreground/45",
        "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-xs file:font-semibold file:uppercase",
        "aria-invalid:border-destructive aria-invalid:border-2",
        "disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
