import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";

import { PLANS, TRIAL_DAYS, formatMonthly } from "@/lib/billing/plans";
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
import { TharrosWordmark } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, flat monthly pricing for Canadian small businesses. One predictable number — no per-seat surprises. Start with a 14-day free trial.",
};

export default function PricingPage() {
  return (
    <main className="bg-background flex min-h-screen flex-col items-center px-6 py-16">
      <Link href="/" aria-label="Tharros home">
        <TharrosWordmark />
      </Link>

      <div className="mt-10 max-w-2xl space-y-4 text-center">
        <Badge variant="default" className="gap-1.5">
          <span className="bg-primary size-1.5 rounded-full" />
          {TRIAL_DAYS}-day free trial
        </Badge>
        <h1 className="type-h1 text-balance">Simple pricing that scales with you.</h1>
        <p className="type-body text-muted-foreground text-balance">
          One flat monthly price per business — not per seat. Start free for{" "}
          {TRIAL_DAYS} days; cancel anytime. Prices in CAD, tax calculated at
          checkout.
        </p>
      </div>

      <div className="mt-12 grid w-full max-w-5xl gap-6 md:grid-cols-3">
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
                <span className="type-display">{formatMonthly(plan.priceMonthly)}</span>
                <span className="text-muted-foreground type-small"> /month</span>
              </p>
            </CardHeader>

            <CardContent className="flex-1">
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check
                      aria-hidden
                      className="text-primary mt-0.5 size-4 shrink-0"
                    />
                    <span className="type-small">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({
                    size: "lg",
                    variant: plan.highlight ? "default" : "outline",
                  }),
                  "w-full",
                )}
              >
                Start free trial
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>

      <p className="text-muted-foreground type-meta mt-10 text-center">
        Questions about which plan fits?{" "}
        <Link href="/signup" className="text-foreground underline underline-offset-4">
          Get started
        </Link>{" "}
        and we&apos;ll help you choose.
      </p>
    </main>
  );
}
