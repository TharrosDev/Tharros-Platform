import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { PLANS, TRIAL_DAYS, formatMonthly } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { TharrosWordmark } from "@/components/brand/logo";

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
    <main className="bg-sidebar text-sidebar-foreground relative flex min-h-screen flex-col overflow-hidden">
      {/* Workshop brand atmosphere — same world as the marketing home */}
      <div
        aria-hidden
        className="text-sidebar-foreground pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div
        aria-hidden
        className="bg-primary pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full opacity-15 blur-3xl"
      />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="Tharros home">
          <TharrosWordmark markClassName="size-7" />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/login"
            className="text-sidebar-muted-foreground hover:text-sidebar-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors"
          >
            Sign in
          </Link>
          <Link href="/signup" className={cn(buttonVariants({ size: "sm" }))}>
            Get started
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto w-full max-w-6xl px-6 pt-14 pb-20 sm:pt-20">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            One flat price. No per-seat math.
          </h1>
          <p className="text-sidebar-muted-foreground mt-5 max-w-xl text-lg leading-relaxed text-pretty">
            Pick the plan that matches where your business is today, and change it
            whenever that changes. Every plan starts with a {TRIAL_DAYS}-day free
            trial. Prices in CAD; tax calculated at checkout.
          </p>
        </div>

        {/* The ladder: Growth is the light panel punched out of the dark page. */}
        <div className="mt-14 grid items-stretch gap-4 lg:grid-cols-[1fr_1.25fr_1fr] lg:gap-0">
          {starter ? <QuietPlan plan={starter} side="left" /> : null}

          {growth ? (
            <div className="bg-card text-card-foreground shadow-card-hover relative z-10 flex flex-col rounded-2xl p-7 sm:p-8 lg:-my-6 lg:rounded-2xl">
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

              <Link
                href="/signup"
                className={cn(buttonVariants({ size: "lg" }), "mt-8 w-full")}
              >
                Start your {TRIAL_DAYS}-day free trial
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          ) : null}

          {pro ? <QuietPlan plan={pro} side="right" /> : null}
        </div>

        {/* Shared ground — true for every plan. */}
        <div className="border-border/20 text-sidebar-muted-foreground mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 border-y py-5 text-sm">
          <span>{TRIAL_DAYS}-day free trial</span>
          <span aria-hidden className="bg-border/30 hidden h-1 w-1 rounded-full sm:block" />
          <span>Flat price per business, not per seat</span>
          <span aria-hidden className="bg-border/30 hidden h-1 w-1 rounded-full sm:block" />
          <span>Cancel anytime</span>
          <span aria-hidden className="bg-border/30 hidden h-1 w-1 rounded-full sm:block" />
          <span>CAD pricing, tax at checkout</span>
        </div>

        {/* The three questions every owner actually asks. */}
        <div className="mx-auto mt-16 grid max-w-4xl gap-8 sm:grid-cols-3">
          {FAQ.map((item) => (
            <div key={item.q}>
              <h3 className="text-sm font-semibold">{item.q}</h3>
              <p className="text-sidebar-muted-foreground mt-2 text-sm leading-relaxed">
                {item.a}
              </p>
            </div>
          ))}
        </div>

        <p className="text-sidebar-muted-foreground mt-16 text-center text-sm">
          Not sure which plan fits?{" "}
          <Link
            href="/signup"
            className="text-sidebar-foreground underline underline-offset-4 hover:no-underline"
          >
            Start the trial
          </Link>{" "}
          — you can switch plans at any point.
        </p>
      </section>
    </main>
  );
}

/** The flanking plans: quiet, translucent panels that frame the light Growth card. */
function QuietPlan({
  plan,
  side,
}: {
  plan: (typeof PLANS)[number];
  side: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm transition-colors duration-200 ease-out hover:bg-white/[0.06] motion-reduce:transition-none",
        side === "left" ? "lg:rounded-r-none lg:border-r-0" : "lg:rounded-l-none lg:border-l-0",
      )}
    >
      <h2 className="type-h2">{plan.name}</h2>
      <p className="text-sidebar-muted-foreground mt-1.5 text-sm">{plan.blurb}</p>

      <p className="mt-6">
        <span className="num text-4xl font-bold tracking-tight">
          {formatMonthly(plan.priceMonthly)}
        </span>
        <span className="text-sidebar-muted-foreground text-sm"> /month CAD</span>
      </p>

      <ul className="mt-7 flex-1 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check
              aria-hidden
              className="text-sidebar-muted-foreground mt-0.5 size-4 shrink-0"
            />
            <span className="text-sidebar-foreground/90 text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/signup"
        className={cn(
          "border-border/40 text-sidebar-foreground hover:bg-white/10 focus-visible:ring-sidebar-ring/50",
          "mt-8 inline-flex h-11 w-full items-center justify-center rounded-md border text-sm font-medium outline-none transition-colors focus-visible:ring-[3px]",
        )}
      >
        Start free trial
      </Link>
    </div>
  );
}
