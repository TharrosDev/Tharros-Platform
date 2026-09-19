"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "visual-panel text-muted-foreground relative inline-flex h-12 items-center justify-center rounded-2xl p-1.5",
        className,
      )}
      {...props}
    />
  );
}

function TabsTab({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "text-muted-foreground data-[selected]:text-primary-soft-foreground focus-visible:ring-ring/35 relative z-10 inline-flex h-9 select-none items-center justify-center rounded-xl px-3.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-[4px]",
        className,
      )}
      {...props}
    />
  );
}

function TabsIndicator({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Indicator>) {
  return (
    <TabsPrimitive.Indicator
      className={cn(
        "bg-primary-soft border border-primary/10 shadow-xs absolute left-0 top-1.5 z-0 h-9 rounded-xl transition-all duration-200 ease-out",
        className,
      )}
      style={{
        width: "var(--active-tab-width)",
        transform: "translateX(var(--active-tab-left))",
      }}
      {...props}
    />
  );
}

function TabsPanel({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Panel>) {
  return (
    <TabsPrimitive.Panel
      className={cn("focus-visible:ring-ring/40 mt-4 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTab, TabsIndicator, TabsPanel };
