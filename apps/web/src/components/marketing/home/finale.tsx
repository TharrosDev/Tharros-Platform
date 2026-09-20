import Link from "next/link";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { marketingContainer } from "@/components/marketing/marketing-chrome";

/** The close: one plate, one key. */
function Finale() {
  return (
    <section aria-labelledby="finale-heading" className="seam-t py-20 sm:py-28">
      <div className={cn(marketingContainer)}>
        <div className="on-stock bg-card border-border border p-8 sm:p-14">
          <h2 id="finale-heading" className="type-hero text-foreground max-w-3xl">
            Put the busywork on the board. Keep the decisions.
          </h2>
          <p className="type-body text-muted-foreground mt-5 max-w-xl text-pretty sm:text-lg">
            Start on the free trial. No card, no call, and nothing goes out to your staff or your
            customers until you say so.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Start free
            </Link>
            <Link href="/pricing" className={buttonVariants({ size: "lg", variant: "outline" })}>
              Compare plans
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export { Finale };
