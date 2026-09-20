import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The Tharros mark: a square cut plate with one chamfered top-right corner and
 * a "T" cut out of it as negative space, so it reads on the rack and on stock
 * alike. The chamfer is the tool-precision tell. Nothing in this system is
 * rounded, and neither is the mark.
 *
 * Single colour: it inherits `currentColor`.
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
        d="M0 0h14.5L24 4.6V24H0V0Zm5.5 6.2v3.3h5.1V18h2.8V9.5h5.1V6.2H5.5Z"
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
      <span className="type-h2">Tharros</span>
    </span>
  );
}

export { TharrosMark, TharrosWordmark };
