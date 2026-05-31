"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { DialogBackdrop } from "@/components/ui/dialog";

/**
 * Off-canvas panel built on the Base UI dialog primitive. Used for the mobile
 * navigation drawer. Slides in from the chosen edge via the Base UI transition
 * state attributes (`data-starting-style` / `data-ending-style`).
 */
const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

const sideClasses = {
  left: "inset-y-0 left-0 border-r data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full",
  right:
    "inset-y-0 right-0 border-l data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
} as const;

function SheetContent({
  side = "left",
  className,
  children,
  showClose = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Popup> & {
  side?: keyof typeof sideClasses;
  showClose?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogBackdrop />
      <DialogPrimitive.Popup
        className={cn(
          "bg-sidebar text-sidebar-foreground shadow-popover fixed z-50 flex w-72 max-w-[80vw] flex-col border-sidebar-border outline-none",
          "transition-transform duration-300 ease-out",
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {children}
        {showClose ? (
          <SheetClose
            className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/40 absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-[3px]"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </SheetClose>
        ) : null}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent };
