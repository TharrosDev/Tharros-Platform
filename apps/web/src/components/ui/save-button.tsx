"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Submit button for settings-style forms: the label holds its width while a
 * spinner crossfades in during the pending state, so the button never jumps.
 * Success/failure feedback stays with the form's toast / message pattern.
 */
export function SaveButton({
  pending,
  children = "Save changes",
  pendingLabel = "Saving…",
  className,
  ...props
}: React.ComponentProps<typeof Button> & {
  pending: boolean;
  pendingLabel?: string;
}) {
  return (
    <Button type="submit" disabled={pending} className={cn("relative", className)} {...props}>
      <span
        className={cn(
          "flex items-center gap-2 transition-opacity duration-150",
          pending && "opacity-0",
        )}
      >
        {children}
      </span>
      <span
        aria-hidden={!pending}
        className={cn(
          "absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-150",
          pending ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
        {pendingLabel}
      </span>
    </Button>
  );
}
