import type { ReactNode } from "react";

import {
  MarketingBackdrop,
  MarketingFooter,
  MarketingHeader,
} from "@/components/marketing/marketing-chrome";

function PublicDocument({
  eyebrow,
  title,
  intro,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-background text-foreground relative min-h-screen overflow-x-clip">
      <MarketingBackdrop />
      <MarketingHeader showPricing />
      <main className="relative">
        <article className="relative mx-auto w-full max-w-4xl px-6 py-16 sm:py-24">
          <div className="bg-primary-soft inline-flex rounded-full border border-primary-edge/15 px-3 py-1.5">
            <p className="text-primary-soft-foreground type-meta">{eyebrow}</p>
          </div>
          <h1 className="mt-5 text-5xl font-[720] tracking-[-0.05em] text-balance sm:text-6xl">
            {title}
          </h1>
          <p className="text-muted-foreground mt-5 max-w-2xl text-lg leading-relaxed">{intro}</p>
          <p className="text-muted-foreground type-meta mt-4">Last updated {updated}</p>
          <div className="mt-14 space-y-10 bg-card rounded-3xl border p-6 text-base leading-7 shadow-card sm:p-9 [&_a]:text-primary-soft-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:space-y-1.5">
            {children}
          </div>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}

export { PublicDocument };
