import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tharros "Workshop" mark — a sharp cobalt tile (tight 5u radius) with one
 * chamfered top-right corner, and a clean "T" cut out of it as negative space
 * so it reads on any background. The chamfer is the tool-precision tell. Single
 * colour: inherits `currentColor`, so wrap it in `text-primary` for cobalt.
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
        d="M5 0h9.5L24 4.6V19a5 5 0 0 1-5 5H5a5 5 0 0 1-5-5V5a5 5 0 0 1 5-5Zm.5 6.2v3.3h5.1V18h2.8V9.5h5.1V6.2H5.5Z"
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
