import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input bg-card/80 text-foreground placeholder:text-muted-foreground/60 flex min-h-24 w-full rounded-xl border px-3.5 py-3 text-sm leading-relaxed shadow-xs backdrop-blur-md transition-[color,background-color,box-shadow,border-color] outline-none field-sizing-content hover:border-primary/20 hover:bg-card",
        "focus-visible:border-ring focus-visible:bg-card focus-visible:ring-ring/30 focus-visible:ring-[4px]",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
