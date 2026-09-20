"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/* An initials plate: square stock, condensed caps, cut to the same grid. */
function Avatar({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar"
      className={cn(
        "border-border bg-muted relative flex h-control-sm w-control-sm shrink-0 overflow-hidden border",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({ className, alt = "", ...props }: React.ComponentProps<"img">) {
  const [failed, setFailed] = React.useState(false);
  if (failed || !props.src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      data-slot="avatar-image"
      alt={alt}
      className={cn("aspect-square size-full object-cover", className)}
      onError={() => setFailed(true)}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-fallback"
      className={cn(
        "bg-primary-soft text-primary-soft-foreground type-meta flex size-full items-center justify-center",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
