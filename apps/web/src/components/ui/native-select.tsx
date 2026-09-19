import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Native <select> with the shared field styling. Use it inside server-action
 * forms where a plain form field is needed (the Base UI Select is for client
 * components). Matches Input/SelectTrigger height, border and focus ring.
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative w-full", className)}>
      <select
        data-slot="native-select"
        className="border-input bg-card text-foreground h-10 w-full appearance-none rounded-lg border py-2 pr-9 pl-3 text-sm shadow-xs outline-none transition-[box-shadow,border-color] hover:border-muted-foreground/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
      />
    </div>
  );
}

export { NativeSelect };
