import type { ReactNode } from "react";

import { MarketingFooter, MarketingHeader } from "@/components/marketing/marketing-chrome";

/**
 * One chrome mount for every public page.
 *
 * The header, footer and backdrop used to be hand-mounted by each page, with
 * the pricing link passed inconsistently, which is why the pricing page itself
 * rendered a header with no pricing link in it.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="on-rack relative flex min-h-dvh flex-col overflow-x-clip">
      <MarketingHeader />
      <main className="relative flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
