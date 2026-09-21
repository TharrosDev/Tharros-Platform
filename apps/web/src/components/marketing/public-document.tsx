import type { ReactNode } from "react";

/**
 * A public reference document: security, privacy, terms. Read mode, so the
 * job is comprehension and wayfinding, not expression. The rack frames it and
 * the text sits on stock at a comfortable measure.
 */
function PublicDocument({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-8 sm:py-24">
      <h1 className="type-hero text-rack-foreground text-balance">{title}</h1>
      <p className="text-rack-muted-foreground type-body mt-5 max-w-2xl text-pretty sm:text-lg">
        {intro}
      </p>
      <p className="text-rack-muted-foreground type-meta mt-5">Last updated {updated}</p>

      <div className="on-stock bg-card border-border text-foreground doc-prose mt-12 rounded-xl border p-6 sm:p-10">
        {children}
      </div>
    </article>
  );
}

export { PublicDocument };
