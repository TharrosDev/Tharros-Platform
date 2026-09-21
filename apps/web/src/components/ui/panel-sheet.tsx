"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

/**
 * A right-side panel for secondary tasks (add a record, manage settings) that
 * keeps the list behind it in view. Children can be server-rendered forms with
 * server actions. The panel closes once a form inside it submits; the action
 * is already dispatched to the router by then, and browser validation still
 * blocks invalid submits first.
 */
function PanelSheet({
  label,
  icon,
  title,
  description,
  variant = "outline",
  closeOnSubmit = true,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  variant?: "default" | "outline" | "ghost";
  closeOnSubmit?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className={buttonVariants({ variant })}>
        {icon}
        {label}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="rounded-xl bg-popover text-popover-foreground w-[28rem] max-w-[92vw]"
      >
        <div className="border-b px-5 py-4 pr-14">
          <DialogPrimitive.Title className="type-h2 font-semibold">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="text-muted-foreground mt-1 text-sm">
              {description}
            </DialogPrimitive.Description>
          ) : null}
        </div>
        <div
          className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-5")}
          onSubmitCapture={closeOnSubmit ? () => queueMicrotask(() => setOpen(false)) : undefined}
        >
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { PanelSheet };
