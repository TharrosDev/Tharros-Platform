import type { Metadata } from "next";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { GettingStarted, MarketingCTA, FAQ } from "@/components/marketing/sections";
import { TRIAL_DAYS } from "@/lib/billing/plans";
export const metadata: Metadata = {
  title: "Getting started with Tharros",
  description:
    "A practical guide to setting up your organization, choosing your first workflow and evaluating Tharros with your team.",
  alternates: { canonical: "/how-it-works" },
};
export default function HowItWorksPage() {
  return (
    <>
      <div className="marketing-wrap">
        <header className="public-page-intro">
          <h1>
            Make your first day
            <br />a useful one.
          </h1>
          <p>
            Bring a real question, a team to schedule or a lead to follow up. Tharros is easiest to
            evaluate with the work you already do.
          </p>
        </header>
      </div>
      <GettingStarted showMore={false} />
      <section className="marketing-wrap marketing-section detail-proof">
        <div>
          <h2>Give your trial a clear purpose.</h2>
          <p>
            Your {TRIAL_DAYS}-day trial is time to test fit. Pick a workflow, include the people who
            will use it, and check the results against your current process.
          </p>
          <Link href="/pricing" className="marketing-text-link">
            Review trial terms and plans
            <ArrowRight size={17} aria-hidden />
          </Link>
        </div>
        <div>
          <h3>Before you start</h3>
          <ul className="detail-list mt-6">
            {[
              "Choose a plan with the capabilities your team needs.",
              "Prepare a few relevant documents or your team’s availability.",
              "Decide who reviews schedules, drafts and workflow results.",
              "Review security and data handling before uploading organizational information.",
              "A payment card is required. Cancel before the trial ends to avoid a subscription charge.",
            ].map((item) => (
              <li key={item}>
                <Check size={18} aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <FAQ />
      <MarketingCTA />
    </>
  );
}
