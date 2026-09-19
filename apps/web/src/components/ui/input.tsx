import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-card/80 text-foreground placeholder:text-muted-foreground/60 flex h-11 w-full min-w-0 rounded-xl border px-3.5 py-2 text-sm shadow-xs backdrop-blur-md transition-[color,background-color,box-shadow,border-color] outline-none hover:border-primary/20 hover:bg-card",
        "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "focus-visible:border-ring focus-visible:bg-card focus-visible:ring-ring/30 focus-visible:ring-[4px]",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
