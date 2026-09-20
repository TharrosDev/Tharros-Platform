"use client";

import { LazyMotion, domMax, MotionConfig } from "motion/react";

/**
 * App-wide motion runtime. Mounted once in the root layout so every route
 * group (app, portal, auth, onboarding, marketing) shares one animation
 * feature bundle.
 *
 * - `LazyMotion strict` + `m.*` components keep the core bundle small and
 * throw if a full `motion.*` component sneaks in.
 * - `MotionConfig reducedMotion="user"` disables transform/layout animation
 * for prefers-reduced-motion users at the JS level. The CSS clamp in
 * globals.css only covers CSS transitions, not motion's springs, so both
 * layers are required.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
