import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Hero } from "@/components/marketing/home/hero";
import {
  FAQ,
  GettingStarted,
  MarketingCTA,
  ProductOverview,
} from "@/components/marketing/sections";
import { PLANS, TRIAL_DAYS, formatMonthly } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: { absolute: "Tharros — A clearer workday for Canadian organizations" },
  description:
    "Bring business knowledge, workforce scheduling, lead capture and native automations together. A shared workspace for Canadian businesses and organizations, large and small.",
  alternates: { canonical: "/" },
};

export default function MarketingHome() {
  return (
    <>
      <Hero />
      <div className="marketing-wrap audience-line">
        <p>Built around the people doing the work.</p>
        <span>Independent businesses</span>
        <span>Growing teams</span>
        <span>Larger organizations</span>
      </div>
      <ProductOverview />
      <section className="marketing-wrap marketing-section people-section">
        <div>
          <h2>
            From your first few people
            <br />
            to a bigger operation.
          </h2>
          <p>
            A small team needs fewer things to keep track of. A larger organization needs a clear
            place to coordinate. Start with the part of your work that needs the most clarity.
          </p>
          <Link href="/solutions" className="marketing-text-link">
            Find your starting point
            <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
        <div className="people-scenarios">
          <article>
            <h3>For owners wearing many hats</h3>
            <p>
              Find answers, plan the week and keep new enquiries moving without another scattered
              list.
            </p>
          </article>
          <article>
            <h3>For managers bringing teams together</h3>
            <p>
              Give availability, approvals and shared knowledge a home your people can return to.
            </p>
          </article>
          <article>
            <h3>For organizations planning a wider rollout</h3>
            <p>
              Evaluate a defined workflow first. Review access, plan limits and data handling
              against your requirements.
            </p>
          </article>
        </div>
      </section>
      <GettingStarted />
      <section className="marketing-wrap marketing-section trust-section">
        <div className="trust-statement">
          <ShieldCheck size={40} strokeWidth={1.5} aria-hidden />
          <h2>
            Helpful AI.
            <br />
            Human judgement.
          </h2>
          <p>
            Confidence starts with knowing what the system can do—and where your team takes over.
          </p>
          <Link href="/security" className="marketing-text-link">
            Explore security and controls
            <ArrowRight size={17} aria-hidden />
          </Link>
        </div>
        <ul className="trust-list">
          {[
            {
              title: "Check the source",
              text: "Assistant answers cite the business documents behind them.",
            },
            {
              title: "Review before publishing",
              text: "Managers review schedule drafts before they reach employees.",
            },
            {
              title: "Keep follow-ups thoughtful",
              text: "AI prepares a draft. A person decides what to send.",
            },
            {
              title: "Know what happened",
              text: "Native automation executions are recorded and workflows can be paused.",
            },
          ].map((item) => (
            <li key={item.title}>
              <Check size={20} aria-hidden />
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="marketing-wrap marketing-section home-plans">
        <div className="marketing-section-intro">
          <h2>
            A useful starting point.
            <br />
            Room to do more.
          </h2>
          <p>
            Flat monthly plans in Canadian dollars. Start with a {TRIAL_DAYS}-day trial; a card is
            required and billing begins when the trial ends unless you cancel.
          </p>
        </div>
        <div className="plan-summary">
          {PLANS.map((plan) => (
            <article key={plan.tier}>
              <h3>{plan.name}</h3>
              <p className="plan-summary-price">
                {formatMonthly(plan.priceMonthly)}
                <span> CAD / month</span>
              </p>
              <p>{plan.blurb}</p>
              <Link href="/pricing" className="marketing-text-link">
                See what’s included
                <ArrowRight size={17} aria-hidden />
              </Link>
            </article>
          ))}
        </div>
      </section>
      <FAQ />
      <MarketingCTA />
    </>
  );
}
