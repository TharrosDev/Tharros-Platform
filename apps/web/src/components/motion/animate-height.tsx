"use client";

import { m } from "motion/react";
import { useReducedMotionSafe } from "@/components/motion/reduced-motion";
import { spring } from "./springs";

/**
 * Measured-height expand/collapse. Motion animates to `height: "auto"`
 * directly, so no measurement state is needed (and none is allowed:
 * react-hooks/set-state-in-effect is enforced in this repo).
 */
export function AnimateHeight({
  open,
  children,
  className,
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotionSafe();
  return (
    <m.div
      className={className}
      initial={false}
      animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
      transition={reduced ? { duration: 0 } : spring.gentle}
      style={{ overflow: "hidden" }}
      aria-hidden={!open}
    >
      {children}
    </m.div>
  );
}
