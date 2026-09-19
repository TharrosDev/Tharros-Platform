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
              "relative flex flex-col overflow-hidden rounded-3xl border p-6 transition-[box-shadow,transform,border-color] duration-200 ease-out motion-reduce:transition-none before:pointer-events-none before:absolute before:-right-20 before:-top-20 before:size-52 before:rounded-full before:bg-primary/0 before:blur-3xl hover:before:bg-primary/8",
              plan.highlight
                ? "border-primary/35 bg-gradient-to-b from-card to-primary-soft/25 ring-primary/10 shadow-modal ring-4 md:-my-3 md:py-9"
                : "border-border/75 bg-card/85 shadow-card hover:-translate-y-1 hover:border-primary/15 hover:shadow-card-hover motion-reduce:hover:translate-y-0",
            )}
          >
            {plan.highlight && (
              <Badge
                variant="solid"
                className="absolute -top-2.5 left-6 px-2.5 py-0.5"
              >
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
            <p className="text-muted-foreground type-meta mt-2">
              {TRIAL_DAYS}-day free trial
            </p>

            <ul className="relative mt-6 flex-1 space-y-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Check
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      plan.highlight ? "text-primary" : "text-muted-foreground",
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
        Your card is collected now and charged when the trial ends. Cancel anytime
        before then and you won&apos;t be billed.
      </p>
    </div>
  );
}
