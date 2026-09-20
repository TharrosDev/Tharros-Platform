import Link from "next/link";
import { Check } from "lucide-react";

import { PLANS, formatMonthly, TRIAL_DAYS } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * The three-tier subscribe surface. Shown on /billing when the active org has no
 * (manageable) subscription. Owner-gated CTAs route to the embedded Checkout.
 * The "Growth" tier is the committed focal point: cobalt ring, raised, filled CTA.
 */
export function PlanPicker({ isOwner }: { isOwner: boolean }) {
  return (
    <div>
      <div className="grid items-stretch gap-5 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.tier}
            className={cn(
              "bg-card relative flex flex-col rounded-xl border p-6 transition-[border-color,box-shadow] duration-200",
              plan.highlight
                ? "border-primary-edge/40 ring-primary/15 shadow-raised ring-2"
                : "shadow-card hover:border-input",
            )}
          >
            {plan.highlight && (
              <Badge variant="solid" className="absolute -top-2.5 left-5">
                Most popular
              </Badge>
            )}

            <div className="space-y-1">
              <h3 className="type-h2">{plan.name}</h3>
              <p className="text-muted-foreground type-small text-pretty">{plan.blurb}</p>
            </div>

            <div className="relative mt-6 flex items-baseline gap-1.5">
              <span className="num text-foreground text-4xl font-bold tracking-tight">
                {formatMonthly(plan.priceMonthly)}
              </span>
              <span className="text-muted-foreground type-small">CAD / month</span>
            </div>
            <p className="text-muted-foreground type-meta mt-2">{TRIAL_DAYS}-day free trial</p>

            <ul className="relative mt-6 flex-1 space-y-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Check
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      plan.highlight ? "text-primary-soft-foreground" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                  <span className="type-small">{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href={`/billing/subscribe?plan=${plan.tier}`}
              aria-disabled={!isOwner}
              tabIndex={isOwner ? undefined : -1}
              className={cn(
                buttonVariants({
                  size: "lg",
                  variant: plan.highlight ? "default" : "outline",
                }),
                "mt-7 w-full",
                !isOwner && "pointer-events-none opacity-50",
              )}
            >
              Start free trial
            </Link>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground type-small mt-6 text-center">
        Your card is collected now and charged when the trial ends. Cancel anytime before then and
        you won&apos;t be billed.
      </p>
    </div>
  );
}
