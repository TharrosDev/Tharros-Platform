import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";

import type { Entitlement } from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Day 19 — app-wide billing banner. Renders nothing unless the entitlement asks
 * for one. `past_due` (payment failed → access blocked) is shown on the un-gated
 * pages a blocked user lands on; `trial_ending` rides along on the product pages.
 */
export function BillingBanner({ entitlement }: { entitlement: Entitlement }) {
  if (!entitlement.banner) return null;

  const isPastDue = entitlement.banner === "past_due";
  const Icon = isPastDue ? AlertTriangle : Clock;

  const message = isPastDue
    ? "We couldn't process your payment. Update your payment method to restore access."
    : `Your free trial ends in ${entitlement.trialDaysLeft} day${
        entitlement.trialDaysLeft === 1 ? "" : "s"
      }.`;

  const cta = isPastDue ? "Update payment" : "Manage plan";

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-2 border-b px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6",
        isPastDue
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "border-info/20 bg-info/10 text-info",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="type-small font-medium">{message}</span>
      </div>
      <Link
        href="/billing"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "w-fit shrink-0 bg-background/60",
        )}
      >
        {cta}
      </Link>
    </div>
  );
}
