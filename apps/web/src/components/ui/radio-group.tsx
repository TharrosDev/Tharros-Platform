"use client";

import * as React from "react";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { cn } from "@/lib/utils";

/**
 * Radio primitives on Base UI (`@base-ui/react/radio-group` + `radio`).
 * Controlled or uncontrolled; submits via a hidden input when the group has a
 * `name`. Matches the Workshop UI kit. `RadioGroupItem` renders the dial only;
 * compose it with a `<Label>` for the option text.
 */
function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive>) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid gap-2", className)}
      {...props}
    />
  );
}

function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioPrimitive.Root>) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "border-input bg-card flex size-[1.375rem] shrink-0 cursor-pointer items-center justify-center rounded-full border shadow-xs outline-none transition-[color,box-shadow]",
        "focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]",
        "data-[checked]:border-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator className="bg-primary size-2.5 rounded-full" />
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupItem };
