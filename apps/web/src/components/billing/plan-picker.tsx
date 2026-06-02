import Link from "next/link";

import { PLANS, formatMonthly } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * The three-tier subscribe surface. Shown on /billing when the active org has no
 * (manageable) subscription. Extracted from the Day-17 page so the Day-20 billing
 * settings view can swap in when subscribed. Owner-gated CTAs.
 */
export function PlanPicker({ isOwner }: { isOwner: boolean }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {PLANS.map((plan) => (
        <Card
          key={plan.tier}
          className={cn(
            "relative flex flex-col",
            plan.highlight && "border-primary shadow-lg",
          )}
        >
          {plan.highlight && (
            <Badge
              variant="solid"
              className="absolute -top-3 left-1/2 -translate-x-1/2"
            >
              Most popular
            </Badge>
          )}

          <CardHeader>
            <CardTitle className="type-h2">{plan.name}</CardTitle>
            <CardDescription>{plan.blurb}</CardDescription>
            <p className="mt-4">
              <span className="type-h1">{formatMonthly(plan.priceMonthly)}</span>
              <span className="text-muted-foreground type-small"> /month</span>
            </p>
          </CardHeader>

          <CardContent className="flex-1">
            <ul className="space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="type-small text-muted-foreground">
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>

          <CardFooter>
            <Link
              href={`/billing/subscribe?plan=${plan.tier}`}
              aria-disabled={!isOwner}
              tabIndex={isOwner ? undefined : -1}
              className={cn(
                buttonVariants({
                  size: "lg",
                  variant: plan.highlight ? "default" : "outline",
                }),
                "w-full",
                !isOwner && "pointer-events-none opacity-50",
              )}
            >
              Start free trial
            </Link>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
