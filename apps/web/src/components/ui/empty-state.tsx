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
        "relative flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed bg-card/60 px-6 py-12 text-center",
        className,
      )}
    >
      <span
        className={cn(
          "relative mb-4 flex size-11 items-center justify-center rounded-xl border bg-card shadow-xs [&>svg]:size-5",
          tone === "danger"
            ? "text-destructive"
            : "text-primary-soft-foreground",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <Heading className="type-h2 text-balance">{title}</Heading>
      <p className="text-muted-foreground mt-1.5 max-w-sm text-pretty text-sm leading-relaxed">
        {description}
      </p>
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
