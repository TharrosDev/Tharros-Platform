import * as React from "react";

import { cn } from "@/lib/utils";

/*
  An empty bay. Not a dashed box with an icon tile: a rail with nothing seated
  in it, ruled slots showing through, and a printed note saying what belongs
  here and how to put it there.
*/
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
      data-tone={tone}
      className={cn(
        "border-border bg-surface-2 relative flex min-h-56 flex-col items-center justify-center border px-6 py-12 text-center",
        className,
      )}
    >
      {/* Empty slots: a rail is ruled whether or not a strip is seated in it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 [background-image:repeating-linear-gradient(to_bottom,var(--border)_0,var(--border)_1px,transparent_1px,transparent_2.25rem)]"
      />
      <div className="bg-surface-2 relative flex max-w-md flex-col items-center px-6 py-5">
        <span
          aria-hidden
          className={cn(
            "bg-card h-control w-control mb-4 flex items-center justify-center border [&>svg]:size-5",
            tone === "danger"
              ? "border-destructive text-destructive"
              : "border-input text-muted-foreground",
          )}
        >
          {icon}
        </span>
        <Heading className="type-h2 text-balance">{title}</Heading>
        <p className="text-muted-foreground type-small mt-1.5 max-w-sm text-pretty">
          {description}
        </p>
        {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}

export { EmptyState };
