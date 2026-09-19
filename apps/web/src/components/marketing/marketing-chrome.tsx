import Link from "next/link";

import { cn } from "@/lib/utils";
import { TharrosWordmark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

const quietLinkClass =
  "text-sidebar-muted-foreground hover:text-sidebar-foreground focus-visible:ring-sidebar-ring/40 inline-flex min-h-10 items-center rounded-xl px-3 py-2 text-sm font-medium outline-none transition-[color,background-color] hover:bg-white/[0.06] focus-visible:ring-[4px]";

function MarketingBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="text-sidebar-foreground pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "linear-gradient(to bottom, black, transparent 78%)",
        }}
      />
      <div
        aria-hidden
        className="bg-primary pointer-events-none absolute -top-56 left-[58%] size-[48rem] -translate-x-1/2 rounded-full opacity-20 blur-[120px]"
      />
    </>
  );
}

function MarketingHeader({ showPricing = false }: { showPricing?: boolean }) {
  return (
    <header className="relative mx-auto mt-3 flex w-[calc(100%-1.5rem)] max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 shadow-[0_20px_60px_-38px_rgba(0,0,0,0.75)] backdrop-blur-xl sm:w-[calc(100%-3rem)] sm:px-5">
      <Link
        href="/"
        aria-label="Tharros home"
        className="focus-visible:ring-sidebar-ring/40 inline-flex min-h-10 items-center rounded-xl outline-none focus-visible:ring-[4px]"
      >
        <TharrosWordmark markClassName="size-7" />
      </Link>
      <nav aria-label="Main navigation" className="flex items-center gap-1 sm:gap-2">
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
        <Link href="/signup" className={cn(buttonVariants({ size: "sm" }), "h-11 sm:h-9")}>
          Get started
        </Link>
      </nav>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer className="relative border-t border-white/10 bg-black/10 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="space-y-1.5">
          <Link
            href="/"
            aria-label="Tharros home"
            className="focus-visible:ring-sidebar-ring/40 inline-flex min-h-10 items-center rounded-xl outline-none focus-visible:ring-[4px]"
          >
            <TharrosWordmark markClassName="size-6" />
          </Link>
          <p className="text-sidebar-muted-foreground type-meta">
            Keep it Local, Keep it Canadian.
          </p>
        </div>
        <nav
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1"
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

export { MarketingBackdrop, MarketingFooter, MarketingHeader };
