"use client";

import { m, useReducedMotion } from "motion/react";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Scroll-triggered fade + rise, once. Reduced motion keeps only the fade. */
function Reveal({
  children,
  className,
  delay = 0,
  rise = 18,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  rise?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : rise }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, ease: EASE_OUT, delay }}
    >
      {children}
    </m.div>
  );
}

/**
 * Masked line entrance: each line slides up from behind its own clip. Lines
 * render as block spans so the parent heading keeps its semantics. `onMount`
 * uses a CSS animation so above-the-fold text paints before hydration.
 */
function MaskedLines({
  lines,
  className,
  delay = 0,
  onMount = false,
}: {
  lines: { text: string; className?: string }[];
  className?: string;
  delay?: number;
  onMount?: boolean;
}) {
  const reduced = useReducedMotion();

  return (
    <>
      {lines.map((line, index) =>
        onMount ? (
          <span key={line.text} className={`block overflow-hidden pb-[0.08em] ${className ?? ""}`}>
            <span
              className={`animate-mask-up block ${line.className ?? ""}`}
              style={{ animationDelay: `${delay + index * 0.12}s` }}
            >
              {line.text}
            </span>
          </span>
        ) : (
          // The clip wrapper is what gets observed: the inner line starts fully
          // clipped, which IntersectionObserver reports as never visible.
          <m.span
            key={line.text}
            className={`block overflow-hidden pb-[0.08em] ${className ?? ""}`}
            initial="hidden"
            whileInView="shown"
            viewport={{ once: true, amount: 0.6 }}
          >
            <m.span
              className={`block ${line.className ?? ""}`}
              variants={{
                hidden: { y: reduced ? "0%" : "105%", opacity: reduced ? 0 : 1 },
                shown: { y: "0%", opacity: 1 },
              }}
              transition={{ duration: 0.9, ease: EASE_OUT, delay: delay + index * 0.12 }}
            >
              {line.text}
            </m.span>
          </m.span>
        ),
      )}
    </>
  );
}
export { EASE_OUT, MaskedLines, Reveal };
