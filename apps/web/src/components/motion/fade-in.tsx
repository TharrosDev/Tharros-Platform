"use client";

import { m, useReducedMotion } from "motion/react";
import { ease } from "./springs";

/**
 * Opacity + small rise on mount, for content appearing in response to state
 * (a new message, a loaded result). Not for page-load choreography. Under
 * reduced motion the rise is dropped and only the fade remains.
 */
export function FadeIn({
  children,
  className,
  rise = 6,
}: {
  children: React.ReactNode;
  className?: string;
  /** Pixels to rise from. Set 0 for a pure crossfade. */
  rise?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : rise }}
      animate={{ opacity: 1, y: 0 }}
      transition={ease.standard}
    >
      {children}
    </m.div>
  );
}
