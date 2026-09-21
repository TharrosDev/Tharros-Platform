import * as React from "react";

import { cn } from "@/lib/utils";

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
        d="M6 0h12a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6V6a6 6 0 0 1 6-6Zm-.5 6.2v3.3h5.1V18h2.8V9.5h5.1V6.2H5.5Z"
      />
    </svg>
  );
}

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
