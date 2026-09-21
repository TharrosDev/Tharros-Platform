import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
export const metadata: Metadata = {
  title: "Talk to Tharros",
  description:
    "Ask about Tharros, evaluate fit for your Canadian organization, or discuss your team’s workflow and rollout requirements.",
  alternates: { canonical: "/contact" },
};
export default function ContactPage() {
  return (
    <section className="marketing-wrap contact-layout">
      <div>
        <h1>
          Let’s talk about
          <br />
          your workday.
        </h1>
        <p>
          Exploring Tharros for your business or a larger organization? Tell us what your team is
          trying to make simpler and what you need from a shared workspace.
        </p>
        <a
          href="mailto:tharrosdev@gmail.com?subject=Tharros%20workspace%20enquiry"
          className={buttonVariants({ size: "lg" })}
        >
          <Mail size={18} aria-hidden />
          Email the Tharros team
        </a>
        <p className="text-sm break-all">tharrosdev@gmail.com</p>
        <p>
          Already using Tharros? Include the page or workflow you need help with. Please don’t send
          passwords, payment details or confidential business documents.
        </p>
        <Link href="/pricing" className="marketing-text-link">
          Prefer to explore on your own?
          <ArrowRight size={17} aria-hidden />
        </Link>
      </div>
      <aside className="contact-aside">
        <h2>A good place to begin.</h2>
        <p>A few details help us understand your organization.</p>
        <ul>
          <li>Your organization and team size</li>
          <li>The workflow you want to improve</li>
          <li>The features and access controls you need</li>
          <li>Your evaluation or rollout timeline</li>
          <li>Any procurement or data-handling requirements</li>
        </ul>
        <p>
          For a larger rollout, discuss your requirements before purchasing. Public plans describe
          the capabilities currently included.
        </p>
        <Link href="/security" className="marketing-text-link">
          Read about security
          <ArrowRight size={17} aria-hidden />
        </Link>
      </aside>
    </section>
  );
}
