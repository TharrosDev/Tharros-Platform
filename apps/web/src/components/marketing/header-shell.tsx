"use client";

import { useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";

/**
 * Sticky marketing header frame. Transparent over the hero, then settles onto a
 * card surface once the page scrolls, so the bar never competes with the
 * opening typography.
 */
function HeaderShell({ children }: { children: React.ReactNode }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  return (
    <header
      data-scrolled={scrolled}
      className="sticky top-0 z-topbar border-b border-transparent transition-[background-color,border-color,box-shadow] duration-300 ease-out data-[scrolled=true]:border-border/70 data-[scrolled=true]:bg-background/85 data-[scrolled=true]:shadow-xs data-[scrolled=true]:backdrop-blur-xl"
    >
      {children}
    </header>
  );
}

export { HeaderShell };
