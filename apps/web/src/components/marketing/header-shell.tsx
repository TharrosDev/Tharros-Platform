"use client";

import { useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";

/**
 * The rack's top rail. Transparent over the opening, then a machined seam
 * appears once the page moves under it. No blur and no translucency: this is
 * anodized metal, not glass.
 */
function HeaderShell({ children }: { children: React.ReactNode }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  return (
    <header
      data-scrolled={scrolled}
      className="z-topbar data-[scrolled=true]:bg-rack-deep data-[scrolled=true]:border-rack-edge sticky top-0 border-b border-transparent transition-colors"
    >
      {children}
    </header>
  );
}

export { HeaderShell };
