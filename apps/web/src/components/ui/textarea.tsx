import * as React from "react";

import { cn } from "@/lib/utils";

/* The ruled box, grown to hold several lines. Same rule work as Input. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input bg-card text-foreground placeholder:text-muted-foreground/75 type-body field-sizing-content flex min-h-24 w-full border px-3 py-2.5 transition-colors hover:border-foreground/45",
        "aria-invalid:border-destructive aria-invalid:border-2",
        "disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
