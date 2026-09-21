import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { productDetails } from "@/components/marketing/content";
import { WorkspaceDemo } from "@/components/marketing/workspace-demo";
import { MarketingCTA } from "@/components/marketing/sections";
import { buttonVariants } from "@/components/ui/button";

export const dynamicParams = false;
export function generateStaticParams() {
  return productDetails.map((product) => ({ slug: product.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = productDetails.find((p) => p.slug === slug);
  return product
    ? {
        title: product.name,
        description: product.description,
        alternates: { canonical: `/products/${slug}` },
        openGraph: { title: `${product.name} | Tharros`, description: product.description },
      }
    : {};
}
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const index = productDetails.findIndex((p) => p.slug === slug);
  if (index < 0) notFound();
  const product = productDetails[index];
  return (
    <>
      <section className="marketing-wrap product-detail-hero">
        <div>
          <h1>{product.title}</h1>
          <p>{product.description}</p>
          <div className="marketing-actions">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Start free trial
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href="/pricing" className="marketing-text-link">
              Included in {product.plan.toLowerCase()}
            </Link>
          </div>
        </div>
        <div className={`hero-preview tone-${product.tone}`}>
          <WorkspaceDemo initial={index} />
        </div>
      </section>
      <section className="marketing-wrap marketing-section detail-proof">
        <div>
          <h2>{product.problem}</h2>
          <p>{product.story}</p>
        </div>
        <div>
          <h3>What you can do</h3>
          <ul className="detail-list mt-6">
            {product.capabilities.map((item) => (
              <li key={item}>
                <Check size={18} aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="marketing-band">
        <div className="marketing-wrap marketing-section">
          <h2>A clear path from setup to everyday use.</h2>
          <ol className="getting-started mt-10">
            {product.steps.map((step, i) => (
              <li key={step}>
                <span className="step-number">{i + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
          <p className="scope-note">
            <strong>Know what to expect. </strong>
            {product.boundary}
          </p>
        </div>
      </section>
      <section className="marketing-wrap marketing-section">
        <h2>Works alongside the rest of your day.</h2>
        <div className="plan-summary mt-10">
          {productDetails
            .filter((p) => p.slug !== slug)
            .map((p) => (
              <article key={p.slug}>
                <h3>{p.name}</h3>
                <p>{p.description}</p>
                <Link href={`/products/${p.slug}`} className="marketing-text-link">
                  Explore {p.short.toLowerCase()}
                  <ArrowRight size={17} aria-hidden />
                </Link>
              </article>
            ))}
        </div>
      </section>
      <MarketingCTA />
    </>
  );
}
