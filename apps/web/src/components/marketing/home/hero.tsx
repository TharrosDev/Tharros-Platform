import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { WorkspaceDemo } from "../workspace-demo";

export function Hero() {
  return (
    <section className="marketing-wrap marketing-hero">
      <div className="hero-copy">
        <h1>
          A little less busy.
          <br />
          <span>A lot more together.</span>
        </h1>
        <p>
          Give your people a clearer way to work. Knowledge, scheduling, leads and everyday
          follow-through—together in one workspace for Canadian businesses and organizations.
        </p>
        <div className="marketing-actions">
          <Link href="/signup" className={buttonVariants({ size: "lg" })}>
            Start your free trial
            <ArrowRight size={18} aria-hidden />
          </Link>
          <Link href="/#explore" className="marketing-text-link">
            Take a look around
            <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
        <p className="hero-trial">{TRIAL_DAYS} days to explore · Plans in CAD · Card required</p>
        <ul className="hero-promises">
          <li>
            <Check size={16} aria-hidden />
            Your knowledge, with sources
          </li>
          <li>
            <Check size={16} aria-hidden />
            Your team, in control
          </li>
        </ul>
      </div>
      <div id="explore" className="hero-preview">
        <WorkspaceDemo />
      </div>
    </section>
  );
}
