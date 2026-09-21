"use client";
import { useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
function HeaderShell({ children }: { children: React.ReactNode }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));
  return (
    <header
      data-scrolled={scrolled}
      className="public-header z-topbar sticky top-0 border-b border-transparent transition-colors data-[scrolled=true]:border-border"
    >
      {children}
    </header>
  );
}
export { HeaderShell };
