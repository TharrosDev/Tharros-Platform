"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

function TooltipContent({
  className,
  sideOffset = 6,
  side = "top",
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Popup> & {
  sideOffset?: number;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner sideOffset={sideOffset} side={side} className="z-overlay">
        <TooltipPrimitive.Popup
          className={cn(
            "bg-foreground text-background shadow-popover origin-[var(--transform-origin)] rounded-md px-2.5 py-1.5 text-xs font-medium ",
            "transition-all duration-150 ease-out",
            "data-[starting-style]:translate-y-1 data-[starting-style]:opacity-0",
            "data-[ending-style]:translate-y-1 data-[ending-style]:opacity-0",
            className,
          )}
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };
