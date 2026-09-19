import * as React from "react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

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
    <Card data-slot="stat-card" className={cn("group gap-3 overflow-hidden py-5 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-card-hover", className)} {...props}>
      <div className="flex items-start justify-between px-5">
        <span className="type-meta text-muted-foreground">{label}</span>
        {icon ? (
          <span className="bg-primary-soft text-primary-soft-foreground flex size-9 items-center justify-center rounded-xl border border-primary/10 shadow-xs transition-transform duration-200 group-hover:scale-105 [&>svg]:size-4">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="px-5">
        <span className="num text-foreground text-4xl font-bold tracking-[-0.045em]">{value}</span>
        {hint ? <p className="text-muted-foreground type-small mt-1">{hint}</p> : null}
      </div>
      {children ? <div className="px-5">{children}</div> : null}
    </Card>
  );
}

export { StatCard };
