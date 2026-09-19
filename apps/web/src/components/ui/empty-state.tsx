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
        "relative flex min-h-72 flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border/80 bg-gradient-to-b from-card/80 to-surface-2/75 px-6 py-12 text-center shadow-inner before:pointer-events-none before:absolute before:-top-24 before:size-48 before:rounded-full before:bg-primary/10 before:blur-3xl",
        className,
      )}
    >
      <span
        className={cn(
          "relative mb-5 flex size-14 items-center justify-center rounded-2xl border shadow-card [&>svg]:size-5",
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
