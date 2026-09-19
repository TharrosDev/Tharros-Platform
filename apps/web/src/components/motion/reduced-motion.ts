"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Hydration-safe reduced-motion flag. motion's `useReducedMotion` reads the
 * media query during the first client render, so any value derived from it
 * (initial styles, variants) differs from the server HTML and React throws a
 * hydration mismatch. This returns `false` for the server render and the
 * hydration pass, then the real preference.
 */
export function useReducedMotionSafe(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
