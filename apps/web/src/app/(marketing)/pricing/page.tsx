import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";

import { PLANS, TRIAL_DAYS, formatMonthly } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { marketingContainer } from "@/components/marketing/marketing-chrome";

export const metadata: Metadata = {
  title: "Pricing",
  alternates: { canonical: "/pricing" },
  description:
    "Simple, flat monthly pricing for Canadian businesses and organizations. One predictable number, no per-seat surprises. Start with a 14-day free trial.",
};

const FAQ = [
  {
    q: "What happens after the trial?",
    a: `Your card is collected when you start and only charged when the ${TRIAL_DAYS}-day trial ends. Cancel before then and you will not be billed a cent.`,
  },
  {
    q: "Is the price per person?",
    a: "No. One flat price covers your whole business, so you can add your team without watching the bill climb.",
  },
  {
    q: "Can I change plans later?",
    a: "Anytime. Upgrade or downgrade from your Billing page and the change applies to your next month.",
  },
];

const SHARED = [
  `${TRIAL_DAYS}-day free trial`,
  "Flat price per business, not per seat",
  "Cancel anytime",
  "CAD pricing, tax at checkout",
];

/* Plans use the billing source of truth. */
export default function PricingPage() {
  return (
    <section className={cn(marketingContainer, "py-16 sm:py-24")}>
      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-end">
        <div className="min-w-0">
          <h1 className="type-hero text-rack-foreground">One flat price. No per-seat math.</h1>
          <p className="text-rack-muted-foreground type-body mt-5 max-w-xl text-pretty sm:text-lg">
            Pick the plan that matches where your business is today, and change it whenever that
            changes. Every plan starts with a {TRIAL_DAYS}-day free trial. Prices in CAD, tax
            calculated at checkout.
          </p>
        </div>

        {/* The shared terms sit beside the heading rather than leaving the
            right half of the opening empty. */}
        <ul className="border-rack-edge grid border-t">
          {SHARED.map((item) => (
            <li
              key={item}
              className="border-rack-edge type-meta text-rack-muted-foreground flex items-center gap-3 border-b py-2.5"
            >
              <span aria-hidden className="bg-primary h-px w-4" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-12 grid items-start gap-5 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <Plan key={plan.name} plan={plan} />
        ))}
      </div>

      <p className="comparison-hint">Swipe to compare all plans.</p>
      <div
        className="plan-comparison"
        tabIndex={0}
        role="region"
        aria-label="Plan comparison, scroll horizontally on small screens"
      >
        <table>
          <caption>Compare the work each plan brings together</caption>
          <thead>
            <tr>
              <th scope="col">Included capability</th>
              {PLANS.map((plan) => (
                <th scope="col" key={plan.tier}>
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["AI Business Assistant", "assistant"],
                ["Workforce Scheduling & employee portal", "scheduling"],
                ["Lead Capture & follow-up drafts", "leads"],
                ["Native Automations", "automations"],
              ] as const
            ).map(([label, feature]) => (
              <tr key={feature}>
                <th scope="row">{label}</th>
                {PLANS.map((plan) => (
                  <td key={plan.tier}>
                    {plan.products.includes(feature) ? "Included" : "Not included"}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">AI queries per month</th>
              {PLANS.map((plan) => (
                <td key={plan.tier}>{plan.monthlyQueryCap.toLocaleString("en-CA")}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="scope-note">
        <h2 className="type-h2">Evaluating for a larger organization?</h2>
        <p className="mt-3">
          Choose by workflow and query needs, then review your access, data-handling and procurement
          requirements before a wider rollout.{" "}
          <Link href="/contact" className="marketing-text-link">
            Talk to the Tharros team
          </Link>
        </p>
      </div>

      <dl className="mt-14 grid gap-x-10 gap-y-8 sm:grid-cols-3">
        {FAQ.map((item) => (
          <div key={item.q}>
            <dt className="type-h2 text-rack-foreground">{item.q}</dt>
            <dd className="text-rack-muted-foreground type-body mt-2">{item.a}</dd>
          </div>
        ))}
      </dl>

      <p className="text-rack-muted-foreground type-body mt-14">
        Not sure which plan fits?{" "}
        <Link
          href="/signup"
          className="text-rack-foreground decoration-primary underline underline-offset-4"
        >
          Start the trial
        </Link>{" "}
        and switch at any point.
      </p>
    </section>
  );
}

function Plan({ plan }: { plan: (typeof PLANS)[number] }) {
  const recommended = plan.highlight;

  return (
    <div
      className={cn(
        "on-stock rounded-xl border-border flex min-w-0 flex-col border p-6 sm:p-8",
        recommended ? "bg-stock-pending" : "bg-card",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="type-h2 text-foreground">{plan.name}</h2>
        {recommended ? (
          <p className="type-meta text-primary-soft-foreground max-w-36 text-right">
            Includes scheduling & leads
          </p>
        ) : null}
      </div>

      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="num type-count text-foreground">{formatMonthly(plan.priceMonthly)}</span>
        <span className="type-meta text-muted-foreground">per month CAD</span>
      </p>

      <p className="type-body text-muted-foreground mt-3 text-pretty">{plan.blurb}</p>

      <ul className="border-border mt-7 space-y-2.5 border-t pt-6">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check aria-hidden className="text-foreground mt-0.5 size-4 shrink-0" strokeWidth={3} />
            <span className="type-strip font-normal">{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/signup"
        className={cn(
          buttonVariants({ variant: recommended ? "default" : "outline", size: "lg" }),
          "mt-7 w-full",
        )}
      >
        {recommended ? `Start your ${TRIAL_DAYS}-day free trial` : "Start free trial"}
      </Link>
    </div>
  );
}
