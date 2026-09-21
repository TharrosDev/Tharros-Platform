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

/**
 * The photo sits over the initials and stays invisible until it has actually
 * loaded. A missing or blocked photo therefore never shows as a broken-image
 * icon, not even for the moment between server paint and hydration: the
 * initials are what paints first, and the photo only covers them once it has
 * pixels.
 *
 * An SSR'd image can finish (or fail) before hydration attaches onLoad and
 * onError, so the element is also checked on mount.
 */
function AvatarImage({ className, alt = "", ...props }: React.ComponentProps<"img">) {
  const [state, setState] = React.useState<"loading" | "loaded" | "failed">("loading");
  const ref = React.useRef<HTMLImageElement>(null);

  React.useEffect(() => {
    const img = ref.current;
    if (!img || !img.complete) return;
    setState(img.naturalWidth > 0 ? "loaded" : "failed");
  }, [props.src]);

  if (state === "failed" || !props.src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      ref={ref}
      data-slot="avatar-image"
      alt={alt}
      className={cn(
        "absolute inset-0 size-full object-cover transition-opacity",
        state === "loaded" ? "opacity-100" : "opacity-0",
        className,
      )}
      onLoad={() => setState("loaded")}
      onError={() => setState("failed")}
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
