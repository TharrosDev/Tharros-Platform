"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

/**
 * Switch primitive on Base UI (`@base-ui/react/switch`). Submits "on" via a
 * hidden input when given a `name` and checked (nothing when off — native
 * checkbox behavior), so it works inside a plain `<form action>`. Visually
 * matches the rest of the Maple Pure UI kit.
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer focus-visible:ring-ring/40 inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 outline-none transition-colors focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        "data-[checked]:bg-primary bg-input",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-background pointer-events-none block size-4 rounded-full shadow-sm transition-transform",
          "data-[checked]:translate-x-4 translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
