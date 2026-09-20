import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
  A control on the board is a key: square, condensed caps, answering the press
  with colour and a single pixel of travel. Hi-vis yellow is struck with a
  press-black rule, because the fill alone has no edge against warm stock.
  Focus comes from the one base outline rule in globals.css; no variant here
  draws its own ring.
*/
const buttonVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap",
    "transition-colors select-none active:translate-y-px",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    "aria-invalid:border-destructive",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "type-control border-primary-edge bg-primary text-primary-foreground border-2 hover:bg-primary/85",
        soft: "type-control border-primary-edge/30 bg-primary-soft text-primary-soft-foreground border hover:bg-primary-soft/70",
        destructive:
          "type-control border-primary-edge bg-destructive text-destructive-foreground border-2 hover:bg-destructive/88",
        outline: "type-control border-input bg-card text-foreground border hover:bg-accent",
        secondary:
          "type-control border-input bg-secondary text-secondary-foreground border hover:bg-surface-3",
        ghost: "type-control text-foreground border border-transparent hover:bg-accent",
        link: "type-small text-foreground decoration-primary-soft-foreground border-0 font-medium underline underline-offset-4 hover:decoration-2",
      },
      size: {
        default: "h-control px-4 has-[>svg]:px-3.5",
        sm: "h-control-sm px-3 has-[>svg]:px-2.5",
        lg: "h-control-lg px-5 has-[>svg]:px-4",
        icon: "h-control w-control px-0",
        "icon-sm": "h-control-sm w-control-sm px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
