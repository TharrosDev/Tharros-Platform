import Link from "next/link";
import { ArrowRight, Check, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { commonQuestions, productDetails } from "./content";

export function MarketingCTA() {
  return (
    <section className="marketing-close marketing-wrap">
      <div>
        <h2>A clearer workday starts here.</h2>
        <p>Bring your knowledge, your people and your next steps together.</p>
      </div>
      <div className="marketing-actions">
        <Link className={buttonVariants({ size: "lg" })} href="/signup">
          Start your free trial
          <ArrowRight size={18} aria-hidden />
        </Link>
        <Link className={buttonVariants({ size: "lg", variant: "outline" })} href="/contact">
          Talk about your organization
        </Link>
      </div>
    </section>
  );
}

export function FAQ({ title = "Good questions. Straight answers." }: { title?: string }) {
  return (
    <section className="marketing-wrap marketing-section faq-layout" id="questions">
      <div>
        <h2>{title}</h2>
        <p>Get to know the workspace before you make it yours.</p>
        <Link href="/contact" className="marketing-text-link">
          Have another question?
          <ArrowRight size={17} aria-hidden />
        </Link>
      </div>
      <div>
        {commonQuestions.map((item) => (
          <details className="marketing-faq" key={item.q}>
            <summary>
              {item.q}
              <Plus className="faq-toggle" size={22} aria-hidden />
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function ProductOverview() {
  return (
    <section className="marketing-wrap marketing-section" id="product">
      <div className="marketing-section-intro">
        <h2>
          Less scattered work.
          <br />
          More working together.
        </h2>
        <p>
          Four connected parts of your day. One place to make progress, with the right people in
          control.
        </p>
      </div>
      <div className="product-overview">
        {productDetails.map((product) => (
          <article className={cn("product-feature", `tone-${product.tone}`)} key={product.slug}>
            <h3>{product.title}</h3>
            <div className="product-feature-top">
              <span>{product.name}</span>
              <span>{product.plan}</span>
            </div>
            <p>{product.description}</p>
            <ul>
              {product.capabilities.slice(0, 2).map((item) => (
                <li key={item}>
                  <Check size={16} aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <Link href={`/products/${product.slug}`} className="marketing-text-link">
              Explore {product.short.toLowerCase()}
              <ArrowRight size={18} aria-hidden />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export function GettingStarted({ showMore = true }: { showMore?: boolean }) {
  return (
    <section className="marketing-band">
      <div className="marketing-wrap marketing-section">
        <div className="marketing-section-intro">
          <h2>
            Start with one better way
            <br />
            to work.
          </h2>
          <p>
            You don’t need to change everything at once. Begin with a real workflow, then bring more
            of your team along.
          </p>
        </div>
        <ol className="getting-started">
          {[
            {
              title: "Make space for your team",
              text: "Create your organization, choose a plan and bring the right people into your workspace.",
            },
            {
              title: "Give it the right context",
              text: "Add your documents, team availability or first lead. Start with the work you already know.",
            },
            {
              title: "Find your everyday rhythm",
              text: "Ask, review and act. Keep the useful parts of your day together as you expand your use of Tharros.",
            },
          ].map((item, i) => (
            <li key={item.title}>
              <span className="step-number">{i + 1}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ol>
        {showMore && (
          <Link href="/how-it-works" className="marketing-text-link">
            See how to get started
            <ArrowRight size={17} aria-hidden />
          </Link>
        )}
      </div>
    </section>
  );
}
