"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Select primitives on Base UI (`@base-ui/react/select`). Submits its value via
 * a hidden input when given a `name`, so it works inside a plain `<form action>`.
 * Visually matches the Input primitive (Maple Pure).
 */

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;
const SelectGroup = SelectPrimitive.Group;

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "border-input bg-card text-foreground flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none",
        "data-[placeholder]:text-muted-foreground/70",
        "focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="text-muted-foreground shrink-0">
        <ChevronDown className="size-4" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  sideOffset = 6,
  align = "start",
  side = "bottom",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Popup> & {
  sideOffset?: number;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        sideOffset={sideOffset}
        align={align}
        side={side}
        alignItemWithTrigger={false}
        className="z-50"
      >
        <SelectPrimitive.Popup
          className={cn(
            "bg-popover text-popover-foreground shadow-popover max-h-[min(24rem,var(--available-height))] min-w-[var(--anchor-width)] origin-[var(--transform-origin)] overflow-y-auto rounded-lg border border-border/60 p-1 outline-none",
            "transition-all duration-150 ease-out",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-foreground relative flex cursor-default select-none items-center gap-2.5 rounded-md py-2 pl-2.5 pr-8 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2.5 inline-flex">
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem };
