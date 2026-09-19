import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Minimal table primitives (Maple Pure). Thin semantic wrappers — first used by
 * the Day-15 team page (members + pending invites), reusable for Leads/Billing.
 */

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto overscroll-x-contain rounded-xl border border-border/65 bg-card/35 shadow-xs backdrop-blur-sm">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom border-separate border-spacing-0 text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-surface-2/82 [&_tr]:border-b [&_tr]:border-border/60", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border/55 transition-[background-color,box-shadow] hover:bg-primary-soft/30 hover:shadow-[inset_3px_0_0_var(--primary)] data-[state=selected]:bg-primary-soft/50",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-muted-foreground h-11 px-4 text-left align-middle text-[0.6875rem] font-bold uppercase tracking-[0.075em] whitespace-nowrap first:rounded-l-xl last:rounded-r-xl",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td data-slot="table-cell" className={cn("px-4 py-4 align-middle", className)} {...props} />
  );
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
