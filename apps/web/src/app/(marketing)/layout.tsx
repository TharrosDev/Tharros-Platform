import type { ReactNode } from "react";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/marketing-chrome";
import "./marketing.css";
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-site relative flex min-h-dvh flex-col">
      <MarketingHeader />
      <main id="main-content" className="relative flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
