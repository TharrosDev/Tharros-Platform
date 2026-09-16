import * as React from "react";

import { cn } from "@/lib/utils";

function PageHeader({
  title,
  description,
  actions,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        "border-border/70 flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-end sm:justify-between sm:pb-7",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 space-y-2">
        <h1 className="type-h1 text-balance">{title}</h1>
        {description ? (
          <p className="text-muted-foreground type-body max-w-prose">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}

export { PageHeader };
