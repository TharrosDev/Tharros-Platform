"use client";

import * as React from "react";
import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";

import { cn } from "@/lib/utils";

/**
 * Hover preview card (Base UI). Richer than a tooltip: a small popover that
 * opens on hover/focus for glanceable context (e.g. a citation's source)
 * without committing to a click. Touch devices fall through to the trigger's
 * own click behavior.
 */
const PreviewCard = PreviewCardPrimitive.Root;
const PreviewCardTrigger = PreviewCardPrimitive.Trigger;

function PreviewCardContent({
  className,
  sideOffset = 6,
  side = "top",
  ...props
}: React.ComponentProps<typeof PreviewCardPrimitive.Popup> & {
  sideOffset?: number;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <PreviewCardPrimitive.Portal>
      <PreviewCardPrimitive.Positioner sideOffset={sideOffset} side={side} className="z-overlay">
        <PreviewCardPrimitive.Popup
          className={cn(
            "bg-popover text-popover-foreground shadow-popover origin-[var(--transform-origin)] w-72 rounded-xl border border-border/60 p-4 outline-none",
            "transition-all duration-150 ease-out",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            className,
          )}
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  );
}

export { PreviewCard, PreviewCardTrigger, PreviewCardContent };
