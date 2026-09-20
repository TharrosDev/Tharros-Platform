import Link from "next/link";

import { cn } from "@/lib/utils";
import { TharrosWordmark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { HeaderShell } from "./header-shell";

/** One measure for every public page. */
const marketingContainer = "mx-auto w-full max-w-board px-4 sm:px-8";

const railLinkClass =
  "text-rack-muted-foreground hover:text-rack-foreground hover:bg-accent min-h-control-lg type-meta inline-flex items-center px-3 transition-colors";

function MarketingHeader() {
  return (
    <HeaderShell>
      <div className={cn(marketingContainer, "h-topbar flex items-center justify-between")}>
        <Link
          href="/"
          aria-label="Tharros home"
          className="min-h-control-lg -ml-1 inline-flex items-center px-1"
        >
          <TharrosWordmark markClassName="size-6" />
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-0.5">
          <Link href="/#product" className={cn(railLinkClass, "hidden lg:inline-flex")}>
            Product
          </Link>
          <Link href="/pricing" className={cn(railLinkClass, "hidden sm:inline-flex")}>
            Pricing
          </Link>
          <Link href="/security" className={cn(railLinkClass, "hidden md:inline-flex")}>
            Security
          </Link>
          <Link href="/login" className={railLinkClass}>
            Sign in
          </Link>
          <Link href="/signup" className={cn(buttonVariants({ size: "sm" }), "ml-2")}>
            Get started
          </Link>
        </nav>
      </div>
    </HeaderShell>
  );
}

function MarketingFooter() {
  return (
    <footer className="seam-t relative">
      <div
        className={cn(marketingContainer, "grid gap-10 py-14 sm:grid-cols-[1fr_auto] sm:items-end")}
      >
        <div className="space-y-3">
          <Link
            href="/"
            aria-label="Tharros home"
            className="min-h-control-lg -ml-1 inline-flex items-center px-1"
          >
            <TharrosWordmark markClassName="size-6" />
          </Link>
          <p className="text-rack-muted-foreground type-body max-w-xs">
            One operating workspace for knowledge, scheduling, lead capture and automations.
          </p>
          <p className="text-rack-muted-foreground type-meta">Keep it Local, Keep it Canadian.</p>
        </div>
        <nav
          className="-ml-3 flex flex-wrap items-center gap-x-1 sm:ml-0 sm:justify-end"
          aria-label="Footer"
        >
          <Link href="/pricing" className={railLinkClass}>
            Pricing
          </Link>
          <Link href="/security" className={railLinkClass}>
            Security
          </Link>
          <Link href="/privacy" className={railLinkClass}>
            Privacy
          </Link>
          <Link href="/terms" className={railLinkClass}>
            Terms
          </Link>
          <Link href="/login" className={railLinkClass}>
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export { MarketingFooter, MarketingHeader, marketingContainer };
