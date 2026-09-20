import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
  The tab. A strip carries its state in its stock tint and in this tab, never
  in a pill floated over the content: square, solid, condensed caps, and it
  carries its own ink pair instead of an alpha wash over whatever sits behind.
*/
const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden",
    "type-meta border px-1.5 py-px whitespace-nowrap transition-colors",
    "[&>svg]:size-3 [&>svg]:pointer-events-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border-primary-edge/25 bg-primary-soft text-primary-soft-foreground",
        solid: "border-primary-edge bg-primary text-primary-foreground",
        secondary: "border-input bg-secondary text-secondary-foreground",
        outline: "border-input bg-card text-foreground",
        success: "border-success bg-success text-success-foreground",
        warning: "border-warning bg-warning text-warning-foreground",
        info: "border-info bg-info text-info-foreground",
        destructive: "border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
