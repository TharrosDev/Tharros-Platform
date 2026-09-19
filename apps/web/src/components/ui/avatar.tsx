"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function Avatar({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar"
      className={cn(
        "relative flex size-9 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-muted shadow-xs",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  alt = "",
  ...props
}: React.ComponentProps<"img">) {
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
        "bg-gradient-to-br from-secondary to-primary-soft text-secondary-foreground flex size-full items-center justify-center rounded-xl text-sm font-semibold",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
