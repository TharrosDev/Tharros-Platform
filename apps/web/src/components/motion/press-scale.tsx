"use client";

import { m } from "motion/react";
import { ease } from "./springs";

/**
 * Tactile press feedback for card-shaped interactive surfaces (clickable
 * rows, link cards). Buttons keep their CSS `active:` treatment; this is for
 * larger hit areas where a translate looks wrong but a settle feels right.
 * MotionConfig reducedMotion="user" disables the scale automatically.
 */
export function PressScale({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <m.div className={className} whileTap={{ scale: 0.98 }} transition={ease.fast}>
      {children}
    </m.div>
  );
}
