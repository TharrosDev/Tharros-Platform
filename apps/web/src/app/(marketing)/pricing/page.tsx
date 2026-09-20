import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { PLANS, TRIAL_DAYS, formatMonthly } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  MarketingBackdrop,
  MarketingFooter,
  MarketingHeader,
} from "@/components/marketing/marketing-chrome";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, flat monthly pricing for Canadian small businesses. One predictable number, no per-seat surprises. Start with a 14-day free trial.",
};

const FAQ = [
  {
    q: "What happens after the trial?",
    a: `Your card is collected when you start and only charged when the ${TRIAL_DAYS}-day trial ends. Cancel before then and you won't be billed a cent.`,
  },
  {
    q: "Is the price per person?",
    a: "No. One flat price covers your whole business — add your team without watching the bill climb.",
  },
  {
    q: "Can I change plans later?",
    a: "Anytime. Upgrade or downgrade from your Billing page and the change applies to your next month.",
  },
];

export default function PricingPage() {
  const growth = PLANS.find((p) => p.highlight);
  const others = PLANS.filter((p) => !p.highlight);
  const [starter, pro] = others;

  return (
    <div className="bg-background text-foreground relative flex min-h-screen flex-col overflow-x-clip">
      <MarketingBackdrop />
      <MarketingHeader />

      <main className="relative">
        <section className="relative mx-auto w-full max-w-6xl px-4 pb-24 pt-20 sm:px-6 sm:pt-24">
          <div className="max-w-2xl">
            <p className="type-meta text-primary-soft-foreground">Simple pricing</p>
            <h1 className="mt-3 text-5xl font-bold tracking-[-0.05em] text-balance sm:text-6xl">
              One flat price. No per-seat math.
            </h1>
            <p className="text-muted-foreground mt-5 max-w-xl text-lg leading-relaxed text-pretty">
              Pick the plan that matches where your business is today, and change it whenever that
              changes. Every plan starts with a {TRIAL_DAYS}-day free trial. Prices in CAD; tax
              calculated at checkout.
            </p>
          </div>

          {/* The ladder: Growth is the raised, cobalt-edged panel between two quiet plans. */}
          <div className="mt-16 grid items-stretch gap-4 lg:grid-cols-[1fr_1.22fr_1fr] lg:gap-3">
            {starter ? <QuietPlan plan={starter} side="left" /> : null}

            {growth ? (
              <div className="visual-panel-strong text-card-foreground ring-primary/20 relative z-10 flex flex-col overflow-hidden rounded-3xl p-7 ring-1 sm:p-8 lg:-my-7">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="type-h2">{growth.name}</h2>
                  <span className="text-primary text-sm font-semibold">
                    Where most businesses land
                  </span>
                </div>
                <p className="text-muted-foreground mt-1.5 text-sm">{growth.blurb}</p>

                <p className="mt-6">
                  <span className="num text-5xl font-bold tracking-tight">
                    {formatMonthly(growth.priceMonthly)}
                  </span>
                  <span className="text-muted-foreground text-sm"> /month CAD</span>
                </p>

                <ul className="mt-7 flex-1 space-y-3">
                  {growth.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check aria-hidden className="text-primary mt-0.5 size-4 shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "mt-8 w-full")}>
                  Start your {TRIAL_DAYS}-day free trial
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            ) : null}

            {pro ? <QuietPlan plan={pro} side="right" /> : null}
          </div>

          {/* Shared ground — true for every plan. */}
          <div className="text-muted-foreground mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 border-y py-5 text-sm">
            <span>{TRIAL_DAYS}-day free trial</span>
            <span aria-hidden className="bg-border hidden h-1 w-1 rounded-full sm:block" />
            <span>Flat price per business, not per seat</span>
            <span aria-hidden className="bg-border hidden h-1 w-1 rounded-full sm:block" />
            <span>Cancel anytime</span>
            <span aria-hidden className="bg-border hidden h-1 w-1 rounded-full sm:block" />
            <span>CAD pricing, tax at checkout</span>
          </div>

          {/* The three questions every owner actually asks. */}
          <div className="mx-auto mt-16 grid max-w-4xl gap-8 sm:grid-cols-3">
            {FAQ.map((item) => (
              <div key={item.q}>
                <h3 className="text-sm font-semibold">{item.q}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>

          <p className="text-muted-foreground mt-16 text-center text-sm">
            Not sure which plan fits?{" "}
            <Link
              href="/signup"
              className="text-foreground rounded-sm underline underline-offset-4 hover:no-underline "
            >
              Start the trial
            </Link>{" "}
            — you can switch plans at any point.
          </p>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

/** The flanking plans: quiet card panels that frame the raised Growth card. */
function QuietPlan({ plan, side }: { plan: (typeof PLANS)[number]; side: "left" | "right" }) {
  return (
    <div
      className={cn(
        "flex flex-col bg-card rounded-3xl border p-7 shadow-card transition-[border-color,box-shadow,transform] hover:-translate-y-1 hover:border-primary/20 hover:shadow-card-hover",
        side === "left" ? "" : "",
      )}
    >
      <h2 className="type-h2">{plan.name}</h2>
      <p className="text-muted-foreground mt-1.5 text-sm">{plan.blurb}</p>

      <p className="mt-6">
        <span className="num text-4xl font-bold tracking-tight">
          {formatMonthly(plan.priceMonthly)}
        </span>
        <span className="text-muted-foreground text-sm"> /month CAD</span>
      </p>

      <ul className="mt-7 flex-1 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/signup"
        className={cn(
          "bg-card text-foreground hover:bg-accent ",
          "mt-8 inline-flex h-11 w-full items-center justify-center rounded-xl border text-sm font-semibold transition-[background-color,border-color,transform] hover:-translate-y-px ",
        )}
      >
        Start free trial
      </Link>
    </div>
  );
}
