import type { Transition } from "motion/react";

/**
 * Shared motion vocabulary for the Workshop system. Product register: motion
 * conveys state, lands inside the 150-300ms window, and always eases out.
 * Pick from these instead of inventing per-component timings.
 */
export const spring = {
  /** Selection indicators, pills, chips: fast and assured. */
  snappy: { type: "spring", stiffness: 500, damping: 34 } as Transition,
  /** Height, layout shifts, cards settling: calm, no overshoot. */
  gentle: { type: "spring", stiffness: 380, damping: 38 } as Transition,
} as const;

export const ease = {
  /** Default tween for opacity/simple movement. */
  standard: { duration: 0.2, ease: "easeOut" } as Transition,
  /** Quick feedback (hover states, small fades). */
  fast: { duration: 0.15, ease: "easeOut" } as Transition,
} as const;
