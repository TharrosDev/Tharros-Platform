"use client";

import { m, useReducedMotion } from "motion/react";

/**
 * Staggered appearance for a list that just changed state (search results,
 * filtered rows). Use on state-driven lists only, never as page-load
 * choreography. The stagger is tight (40ms) so even long lists settle fast.
 */
export function StaggerGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <m.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.04 } },
      }}
    >
      {children}
    </m.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <m.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: reduced ? 0 : 4 },
        show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
      }}
    >
      {children}
    </m.div>
  );
}
