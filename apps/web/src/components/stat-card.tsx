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
    <Card
      data-slot="stat-card"
      className={cn(
        "gap-3 py-5 transition-shadow duration-200 hover:shadow-card-hover",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between px-5">
        <span className="type-meta text-muted-foreground">{label}</span>
        {icon ? <span className="text-muted-foreground/80 [&>svg]:size-4">{icon}</span> : null}
      </div>
      <div className="px-5">
        <span className="num text-foreground text-3xl font-semibold tracking-tight">{value}</span>
        {hint ? <p className="text-muted-foreground type-small mt-1">{hint}</p> : null}
      </div>
      {children ? <div className="px-5">{children}</div> : null}
    </Card>
  );
}

export { StatCard };
