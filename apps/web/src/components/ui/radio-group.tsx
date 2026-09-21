"use client";

import * as React from "react";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { cn } from "@/lib/utils";

/**
 * Radio primitives on Base UI. Controlled or uncontrolled; submits via a
 * hidden input when the group has a name. RadioGroupItem renders the mark
 * only; compose it with a Label for the option text.
 *
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
        "rounded-full border-input bg-card flex size-[1.125rem] shrink-0 cursor-pointer items-center justify-center border transition-colors hover:border-foreground/50",
        "data-[checked]:border-primary-edge data-[checked]:border-2",
        "disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator className="bg-primary size-2.5 rounded-full" />
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupItem };
