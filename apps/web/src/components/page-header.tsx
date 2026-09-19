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
        "relative flex flex-col gap-5 pb-7 sm:flex-row sm:items-end sm:justify-between sm:pb-8 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-primary/55 after:via-border after:to-transparent",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 space-y-2.5">
        <div className="mb-3 flex items-center gap-2" aria-hidden>
          <span className="bg-primary size-1.5 rounded-full shadow-[0_0_14px_color-mix(in_oklch,var(--primary)_75%,transparent)]" />
          <span className="type-meta text-primary">Workspace</span>
        </div>
        <h1 className="type-h1 text-gradient text-balance">{title}</h1>
        {description ? (
          <p className="text-muted-foreground type-body max-w-2xl text-pretty">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}

export { PageHeader };
