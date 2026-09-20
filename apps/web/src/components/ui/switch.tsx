"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

/**
 * Switch primitive on Base UI. Submits "on" via a hidden input when given a
 * name and checked (nothing when off, matching native checkbox behavior), so
 * it works inside a plain form action.
 *
 * Drawn as a rocker in its housing: a square track, a square lever, and the
 * lever throws to the other end of the slot.
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer border-input bg-surface-3 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center border p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        "data-[checked]:bg-primary data-[checked]:border-primary-edge",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-card border-input pointer-events-none block h-[1.125rem] w-[1.375rem] border transition-transform",
          "translate-x-0 data-[checked]:translate-x-[1.375rem]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
