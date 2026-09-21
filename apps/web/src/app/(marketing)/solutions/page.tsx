import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { MarketingCTA } from "@/components/marketing/sections";
export const metadata: Metadata = {
  title: "For Canadian businesses and organizations",
  description:
    "Explore Tharros for independent businesses, growing teams and larger Canadian organizations. Start with the workflow that needs a clearer home.",
  alternates: { canonical: "/solutions" },
};
const solutions = [
  {
    title: "Small business. A full day.",
    description:
      "When you handle customers, people and operations, your workspace should help you keep the day together.",
    items: [
      "Ask questions about your policies and business documents.",
      "Bring enquiries into one pipeline with notes and follow-up drafts.",
      "Add workforce scheduling when coordinating shifts becomes part of your week.",
    ],
    href: "/pricing",
    cta: "Find the right plan",
  },
  {
    title: "Growing teams. Shared understanding.",
    description:
      "Give managers and employees a clearer way to coordinate, with the context they need to do their part.",
    items: [
      "Collect availability and review schedules before publishing.",
      "Give employees a dedicated portal for shifts and requests.",
      "Keep team knowledge in a shared, searchable library.",
    ],
    href: "/products/workforce-scheduling",
    cta: "Explore workforce scheduling",
  },
  {
    title: "Larger organizations. A considered rollout.",
    description:
      "Start with one team and one measurable workflow. Evaluate fit before expanding across your organization.",
    items: [
      "Define the team, workflow and approval responsibilities for your evaluation.",
      "Review organization access, query limits and data handling with your stakeholders.",
      "Discuss requirements such as procurement, identity systems and support before committing.",
    ],
    href: "/contact",
    cta: "Discuss your requirements",
  },
];
export default function SolutionsPage() {
  return (
    <>
      <div className="marketing-wrap">
        <header className="public-page-intro">
          <h1>
            Different teams.
            <br />A shared need for clarity.
          </h1>
          <p>
            For Canadian businesses and organizations, large and small. Start where the work is most
            scattered and build a better everyday rhythm.
          </p>
        </header>
        <section className="marketing-section" aria-label="Find your use case">
          {solutions.map((solution) => (
            <article key={solution.title} className="solution-row">
              <div>
                <h2>{solution.title}</h2>
                <p>{solution.description}</p>
                <Link className="marketing-text-link" href={solution.href}>
                  {solution.cta}
                  <ArrowRight size={17} aria-hidden />
                </Link>
              </div>
              <ul>
                {solution.items.map((item) => (
                  <li key={item}>
                    <Check size={19} aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </div>
      <section className="marketing-band">
        <div className="marketing-wrap marketing-section">
          <div className="marketing-section-intro">
            <h2>
              Start with the work.
              <br />
              Then choose the plan.
            </h2>
            <p>
              Plan tiers describe capabilities, not company size. A larger team may begin with
              knowledge; a smaller operation may need the full workflow.
            </p>
          </div>
          <div className="plan-summary">
            <article>
              <h3>Keep knowledge close</h3>
              <p>
                Begin with Starter when finding answers in business documents is your first
                priority.
              </p>
            </article>
            <article>
              <h3>Coordinate people and enquiries</h3>
              <p>
                Choose Growth when you need scheduling, the employee portal and lead capture
                alongside knowledge.
              </p>
            </article>
            <article>
              <h3>Put routine steps in motion</h3>
              <p>
                Choose Pro for native lead-event automations, recorded executions and higher AI
                query limits.
              </p>
            </article>
          </div>
        </div>
      </section>
      <MarketingCTA />
    </>
  );
}
