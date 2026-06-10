"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

/**
 * Counts a stat up to its value when it first appears. The real value is in
 * the server-rendered HTML (and stays there for no-JS and reduced-motion
 * users); the animation only rewrites textContent, so there is no state and
 * no layout shift. Pair with the `.num` utility for tabular numerals.
 */
export function CountUp({
  value,
  format,
  className,
}: {
  value: number;
  /** Optional formatter, e.g. (v) => `${v}%`. Defaults to locale string. */
  format?: (value: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const fmt = useRef(format);

  // Keep the latest formatter without making it an animation dependency
  // (an inline formatter would otherwise restart the count on every render).
  useEffect(() => {
    fmt.current = format;
  });

  useEffect(() => {
    const node = ref.current;
    if (reduced || !node) return;
    const render = (v: number) =>
      (node.textContent = fmt.current ? fmt.current(v) : v.toLocaleString());
    const controls = animate(0, value, {
      duration: 0.5,
      ease: "easeOut",
      onUpdate: (v) => render(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduced]);

  return (
    <span ref={ref} className={className}>
      {format ? format(value) : value.toLocaleString()}
    </span>
  );
}
