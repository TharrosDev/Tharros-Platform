"use client";

import * as React from "react";
import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitive.Provider;

/** Hook for raising toasts: `useToast().add({ title, description })`. */
const useToast = ToastPrimitive.useToastManager;

function ToastList() {
  const { toasts } = useToast();

  return toasts.map((toast) => (
    <ToastPrimitive.Root
      key={toast.id}
      toast={toast}
      className={cn(
        "rounded-xl bg-popover text-popover-foreground shadow-popover relative flex flex-col gap-1 overflow-hidden border p-4 pr-11 ",
        "transition-all duration-300 ease-out",
        "data-[starting-style]:translate-x-full data-[starting-style]:opacity-0",
        "data-[ending-style]:translate-x-full data-[ending-style]:opacity-0",
      )}
    >
      <ToastPrimitive.Title className="text-sm font-semibold" />
      <ToastPrimitive.Description className="text-muted-foreground text-sm" />
      <ToastPrimitive.Close
        className="text-muted-foreground hover:bg-accent hover:text-foreground absolute right-2 top-2 inline-flex h-control-sm w-control-sm items-center justify-center transition-colors "
        aria-label="Close"
      >
        <X className="size-3.5" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  ));
}

/** Renders the toast viewport. Must be mounted inside a `<ToastProvider>`. */
function Toaster() {
  return (
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport className="fixed right-0 bottom-0 z-toast flex w-full max-w-sm flex-col gap-2 p-4 sm:right-4 sm:bottom-4">
        <ToastList />
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  );
}

export { ToastProvider, Toaster, useToast };
