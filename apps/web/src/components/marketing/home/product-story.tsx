"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m, useInView, useScroll } from "motion/react";
import { useReducedMotionSafe } from "@/components/motion/reduced-motion";

import { cn } from "@/lib/utils";
import { marketingContainer } from "@/components/marketing/marketing-chrome";
import { EASE_OUT } from "./reveal";
import { SectionHeading } from "./section-heading";
import { PANELS, PRODUCTS, type ProductKey } from "./product-panels";
import { WorkspaceFrame } from "./workspace-frame";

/**
 * Sticky product narrative. On large screens the four products transform one
 * persistent workspace as the visitor scrolls; below lg every step carries its
 * own static panel and nothing sticks.
 */
function ProductStory() {
  const [active, setActive] = useState<ProductKey>("knowledge");
  const listRef = useRef<HTMLOListElement>(null);
  const reduced = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ["start 60%", "end 60%"],
  });
  const ActivePanel = PANELS[active];

  return (
    <section
      id="product"
      aria-labelledby="product-heading"
      className="relative scroll-mt-16 py-24 sm:py-32"
    >
      <div className={marketingContainer}>
        <SectionHeading
          id="product-heading"
          index="I"
          eyebrow="The operating layer"
          lines={["Four products.", "One workspace."]}
          intro="Every surface shares the same organization, permissions, notifications, billing and audit trail. Work moves between them instead of stalling in separate tools."
        />

        <div className="mt-20 grid grid-cols-[minmax(0,1fr)] gap-16 lg:mt-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <ol ref={listRef} className="relative">
            {/* The connector: one line runs through every product. */}
            <span aria-hidden className="bg-border absolute top-2 bottom-2 left-[0.6875rem] w-px" />
            <m.span
              aria-hidden
              className="bg-primary absolute top-2 bottom-2 left-[0.6875rem] w-px origin-top"
              style={{ scaleY: reduced ? 1 : scrollYProgress }}
            />
            {PRODUCTS.map((product) => (
              <Step
                key={product.key}
                product={product}
                active={active === product.key}
                onActive={setActive}
              />
            ))}
          </ol>

          <div className="relative hidden lg:block">
            <div className="sticky top-[max(6rem,calc(50vh-17rem))]">
              <WorkspaceFrame active={active}>
                <div className="h-[26rem]">
                  <AnimatePresence mode="wait" initial={false}>
                    <m.div
                      key={active}
                      className="h-full"
                      initial={{ opacity: 0, y: reduced ? 0 : 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: reduced ? 0 : -10 }}
                      transition={{ duration: 0.35, ease: EASE_OUT }}
                    >
                      <ActivePanel />
                    </m.div>
                  </AnimatePresence>
                </div>
              </WorkspaceFrame>
              <p className="type-meta text-muted-foreground mt-5 text-right">
                Illustrative workspace
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Step({
  product,
  active,
  onActive,
}: {
  product: (typeof PRODUCTS)[number];
  active: boolean;
  onActive: (key: ProductKey) => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  // A step is "current" while it crosses the middle band of the viewport.
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => {
    if (inView) onActive(product.key);
  }, [inView, onActive, product.key]);
  const Panel = PANELS[product.key];

  return (
    <li
      ref={ref}
      className="relative pb-20 pl-12 last:pb-0 lg:flex lg:min-h-[78vh] lg:items-center lg:pb-0"
    >
      <span
        aria-hidden
        className={cn(
          "bg-background absolute top-1 left-0 flex size-[1.375rem] items-center justify-center rounded-full border transition-colors duration-300 lg:top-1/2 lg:-translate-y-1/2",
          active ? "border-primary" : "border-border",
        )}
      >
        <span
          className={cn(
            "size-2 rounded-full transition-colors duration-300",
            active ? "bg-primary" : "bg-border",
          )}
        />
      </span>
      <div>
        <p className="type-meta flex items-center gap-3">
          <span className="text-primary-soft-foreground">{product.index}</span>
          <span className="text-muted-foreground">{product.label}</span>
        </p>
        <h3
          className={cn(
            "mt-4 text-[clamp(1.9rem,3.2vw,2.9rem)] leading-[1] font-[720] tracking-[-0.045em] transition-colors duration-500",
            active ? "text-foreground" : "lg:text-muted-foreground",
          )}
        >
          {product.title}
        </h3>
        <p className="text-muted-foreground mt-5 max-w-md text-lg leading-relaxed text-pretty">
          {product.body}
        </p>
        <ul className="mt-6 flex flex-wrap gap-2" aria-label={`${product.title} highlights`}>
          {product.tags.map((tag) => (
            <li key={tag} className="bg-card rounded-full border px-3 py-1.5 text-sm font-medium">
              {tag}
            </li>
          ))}
        </ul>
        <WorkspaceFrame active={product.key} showRail={false} className="mt-10 lg:hidden">
          <Panel />
        </WorkspaceFrame>
      </div>
    </li>
  );
}

export { ProductStory };
