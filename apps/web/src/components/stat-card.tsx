import * as React from "react";

import { cn } from "@/lib/utils";

/** A single metric: label, tabular value, optional one-line hint. */
function StatCard({
  label,
  value,
  hint,
  icon,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div
      data-slot="stat-card"
      className={cn("bg-card flex flex-col gap-2 border p-4 shadow-card sm:p-5", className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm font-medium">{label}</span>
        {icon ? (
          <span className="text-muted-foreground [&>svg]:size-4" aria-hidden>
            {icon}
          </span>
        ) : null}
      </div>
      <span
        className={cn(
          "text-foreground text-[1.75rem] leading-none font-semibold tracking-[-0.03em]",
          typeof value === "number" && "num",
        )}
      >
        {value}
      </span>
      {hint ? <p className="text-muted-foreground type-small">{hint}</p> : null}
      {children}
    </div>
  );
}

export { StatCard };
