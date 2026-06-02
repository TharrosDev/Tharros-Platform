import Link from "next/link";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { TharrosWordmark } from "@/components/brand/logo";

export default function MarketingHome() {
  return (
    <main className="bg-sidebar text-sidebar-foreground relative flex min-h-screen flex-col overflow-hidden">
      {/* Workshop brand atmosphere — matches the auth panel */}
      <div
        aria-hidden
        className="text-sidebar-foreground pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div
        aria-hidden
        className="bg-primary pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full opacity-15 blur-3xl"
      />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <TharrosWordmark markClassName="size-7" />
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/pricing"
            className="text-sidebar-muted-foreground hover:text-sidebar-foreground hidden rounded-md px-3 py-2 text-sm font-medium transition-colors sm:inline-flex"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="text-sidebar-muted-foreground hover:text-sidebar-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors"
          >
            Sign in
          </Link>
          <Link href="/signup" className={cn(buttonVariants({ size: "sm" }))}>
            Get started
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <span className="type-meta text-sidebar-muted-foreground">Local and Canadian</span>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-balance sm:text-6xl">
          Your business, running itself.
        </h1>
        <p className="text-sidebar-muted-foreground mt-5 max-w-xl text-lg leading-relaxed text-pretty">
          The AI operating layer for small businesses. Tharros does the busywork
          between the tools you already use, so you can get back to the work that
          matters.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup" className={cn(buttonVariants({ size: "lg" }))}>
            Get started free
          </Link>
          <Link
            href="/pricing"
            className="border-border/40 text-sidebar-foreground hover:bg-white/10 focus-visible:ring-sidebar-ring/50 inline-flex h-11 items-center justify-center rounded-md border px-6 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px]"
          >
            See pricing
          </Link>
        </div>
        <p className="text-sidebar-muted-foreground type-small mt-6">
          14-day free trial. No credit card to look around.
        </p>
      </section>
    </main>
  );
}
