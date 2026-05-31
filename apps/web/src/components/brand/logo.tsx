import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Original Tharros mark — a rounded maple tile with a clean "T" cut out of it
 * (negative space, so it reads on any background). Single-colour: inherits
 * `currentColor`, so wrap it in `text-primary` for maple. Not derived from the
 * marketing-site glyph.
 */
function TharrosMark({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Tharros"
      className={cn("size-6", className)}
      {...props}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 0h10a7 7 0 0 1 7 7v10a7 7 0 0 1-7 7H7a7 7 0 0 1-7-7V7a7 7 0 0 1 7-7Zm-1 6h12v3.5h-4.5V18h-3V9.5H6V6Z"
      />
    </svg>
  );
}

/** Mark + wordmark lockup. */
function TharrosWordmark({
  className,
  markClassName,
  ...props
}: React.ComponentProps<"span"> & { markClassName?: string }) {
  return (
    <span
      data-slot="wordmark"
      className={cn("inline-flex items-center gap-2", className)}
      {...props}
    >
      <TharrosMark className={cn("size-6 text-primary", markClassName)} />
      <span className="text-[1.0625rem] font-semibold tracking-tight">Tharros</span>
    </span>
  );
}

export { TharrosMark, TharrosWordmark };
