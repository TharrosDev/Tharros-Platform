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
    <main className="bg-sidebar text-sidebar-foreground relative min-h-screen overflow-hidden">
      <MarketingBackdrop />
      <MarketingHeader showPricing />
      <article className="relative mx-auto w-full max-w-3xl px-6 py-14 sm:py-20">
        <p className="text-primary-soft-foreground type-meta">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          {title}
        </h1>
        <p className="text-sidebar-muted-foreground mt-5 max-w-2xl text-lg leading-relaxed">
          {intro}
        </p>
        <p className="text-sidebar-muted-foreground type-meta mt-4">Last updated {updated}</p>
        <div className="mt-12 space-y-10 text-[0.95rem] leading-7 text-sidebar-foreground/90 [&_a]:text-primary-soft-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:space-y-1.5">
          {children}
        </div>
      </article>
      <MarketingFooter />
    </main>
  );
}

export { PublicDocument };
