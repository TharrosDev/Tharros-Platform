import Link from "next/link";

import { cn } from "@/lib/utils";
import { TharrosWordmark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { HeaderShell } from "./header-shell";

/** Shared marketing measure: wide editorial grid with a 16px phone gutter. */
const marketingContainer = "mx-auto w-full max-w-[84rem] px-4 sm:px-8";

const quietLinkClass =
  "text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-medium transition-[color,background-color] hover:bg-accent ";

function MarketingBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="text-foreground pointer-events-none absolute inset-x-0 top-0 h-[60rem] opacity-[0.045]"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 80% 70% at 70% 0%, black, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[56rem]"
        style={{
          background:
            "radial-gradient(ellipse 55% 60% at 88% 8%, color-mix(in oklch, var(--primary) 11%, transparent), transparent 70%)",
        }}
      />
    </>
  );
}

function MarketingHeader({ showPricing = false }: { showPricing?: boolean }) {
  return (
    <HeaderShell>
      <div className={cn(marketingContainer, "flex h-16 items-center justify-between sm:h-18")}>
        <Link
          href="/"
          aria-label="Tharros home"
          className=" -ml-1 inline-flex min-h-11 items-center rounded-xl px-1 "
        >
          <TharrosWordmark markClassName="size-7" />
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-0.5 sm:gap-1.5">
          <Link href="/#product" className={cn(quietLinkClass, "hidden lg:inline-flex")}>
            Product
          </Link>
          {showPricing ? (
            <Link href="/pricing" className={cn(quietLinkClass, "hidden sm:inline-flex")}>
              Pricing
            </Link>
          ) : null}
          <Link href="/security" className={cn(quietLinkClass, "hidden md:inline-flex")}>
            Security
          </Link>
          <Link href="/login" className={quietLinkClass}>
            Sign in
          </Link>
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: "sm" }), "ml-1 h-11 px-4 sm:h-10")}
          >
            Get started
          </Link>
        </nav>
      </div>
    </HeaderShell>
  );
}

function MarketingFooter() {
  return (
    <footer className="bg-background relative border-t">
      <div
        className={cn(marketingContainer, "grid gap-10 py-14 sm:grid-cols-[1fr_auto] sm:items-end")}
      >
        <div className="space-y-3">
          <Link
            href="/"
            aria-label="Tharros home"
            className=" -ml-1 inline-flex min-h-11 items-center rounded-xl px-1 "
          >
            <TharrosWordmark markClassName="size-7" />
          </Link>
          <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
            One operating workspace for knowledge, scheduling, lead capture and automations.
          </p>
          <p className="text-muted-foreground type-meta">Keep it Local, Keep it Canadian.</p>
        </div>
        <nav
          className="-ml-3 flex flex-wrap items-center gap-x-1 gap-y-1 sm:ml-0 sm:justify-end"
          aria-label="Footer"
        >
          <Link href="/pricing" className={quietLinkClass}>
            Pricing
          </Link>
          <Link href="/security" className={quietLinkClass}>
            Security
          </Link>
          <Link href="/privacy" className={quietLinkClass}>
            Privacy
          </Link>
          <Link href="/terms" className={quietLinkClass}>
            Terms
          </Link>
          <Link href="/login" className={quietLinkClass}>
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export { MarketingBackdrop, MarketingFooter, MarketingHeader, marketingContainer };
