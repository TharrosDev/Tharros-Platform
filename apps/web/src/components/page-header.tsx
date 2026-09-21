import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Page title block. The title carries the page; description is one line of
 * context; actions sit right-aligned on the title's baseline (primary last).
 */
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
        "border-foreground flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b-2 pb-3",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-[1_1_14rem] space-y-1.5">
        <h1 className="type-h1 text-balance">{title}</h1>
        {description ? (
          <p className="text-muted-foreground type-body max-w-2xl text-pretty">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export { PageHeader };
