import * as React from "react";

import { cn } from "@/lib/utils";

function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "default",
  headingLevel = "h2",
  className,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  action?: React.ReactNode;
  tone?: "default" | "danger";
  headingLevel?: "h1" | "h2";
  className?: string;
}) {
  const Heading = headingLevel;

  return (
    <div
      data-slot="empty-state"
      className={cn(
        "bg-surface-2/75 flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      <span
        className={cn(
          "mb-5 flex size-12 items-center justify-center rounded-xl shadow-xs [&>svg]:size-5",
          tone === "danger"
            ? "bg-destructive/10 text-destructive"
            : "bg-primary-soft text-primary-soft-foreground",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <Heading className="type-h2 text-balance">{title}</Heading>
      <p className="text-muted-foreground mt-2 max-w-md text-pretty text-sm leading-relaxed">
        {description}
      </p>
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
