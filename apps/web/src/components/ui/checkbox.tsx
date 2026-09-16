"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Checkbox primitive on Base UI (`@base-ui/react/checkbox`). Controlled or
 * uncontrolled; submits via a hidden input when given a `name`. Matches the
 * Workshop UI kit (tight radius, cobalt when checked).
 */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer border-input bg-card flex size-[1.375rem] shrink-0 cursor-pointer items-center justify-center rounded-md border shadow-xs outline-none transition-[color,box-shadow,background-color]",
        "focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]",
        "data-[checked]:bg-primary data-[checked]:border-primary data-[checked]:text-primary-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
