import type { Metadata } from "next";
import { ProductOverview, MarketingCTA, FAQ } from "@/components/marketing/sections";
export const metadata: Metadata = {
  title: "The Tharros platform",
  description:
    "Explore business knowledge, workforce scheduling, lead capture and native automations in one shared workspace.",
  alternates: { canonical: "/products" },
};
export default function ProductsPage() {
  return (
    <>
      <div className="marketing-wrap">
        <header className="public-page-intro">
          <h1>
            Your work has a lot of parts.
            <br />
            Give them a shared home.
          </h1>
          <p>
            Tharros brings four everyday workflows together, with shared organization access, clear
            plan limits and people in control of the decisions that matter.
          </p>
        </header>
      </div>
      <ProductOverview />
      <FAQ />
      <MarketingCTA />
    </>
  );
}
