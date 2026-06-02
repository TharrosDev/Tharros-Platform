import Link from "next/link";

import { PLANS, TRIAL_DAYS, formatMonthly } from "@/lib/billing/plans";
import { getOrgContext } from "@/lib/org/queries";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
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

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const { activeOrg } = await getOrgContext();
  const isOwner = activeOrg?.role === "owner";

  return (
    <>
      <PageHeader
        title="Choose your plan"
        description={`Start with a ${TRIAL_DAYS}-day free trial. Your card is collected now and charged when the trial ends — cancel anytime before then.`}
      />

      {!isOwner && (
        <p className="text-muted-foreground type-small">
          Only the organization owner can manage billing.
        </p>
      )}

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
    </>
  );
}
