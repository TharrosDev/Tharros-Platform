import Link from "next/link";
import { CalendarDays, FileText, MessagesSquare, Sparkles, Users, Workflow } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { TharrosWordmark } from "@/components/brand/logo";

/**
 * The interim marketing landing, in the dark Workshop world (graphite + dot
 * grid + cobalt glow, matching /pricing and the auth brand panel). One page:
 * hero, the product trio, how it works, footer. The full marketing site is a
 * Phase 9 launch gate; this carries the brand until then.
 */

const PRODUCTS = [
  {
    icon: Sparkles,
    name: "AI Business Assistant",
    blurb:
      "Answers questions from your own documents, in plain language, with the source cited every time.",
  },
  {
    icon: CalendarDays,
    name: "AI Workforce Scheduling",
    blurb:
      "Collects availability, builds a labor-valid schedule, and handles sick calls, swaps, and time off. Only exceptions reach you.",
    headline: true,
  },
  {
    icon: Workflow,
    name: "Lead Capture & Automations",
    blurb:
      "Catches every enquiry, follows up for you, and runs the busywork between the tools you already use.",
  },
];

const STEPS = [
  {
    icon: FileText,
    title: "Show it your business",
    body: "Upload your documents, add your team, and answer a few plain questions about how you run things.",
  },
  {
    icon: MessagesSquare,
    title: "Let it run",
    body: "Tharros answers questions, drafts the schedule, and chases the follow-ups while you work.",
  },
  {
    icon: Users,
    title: "Approve the exceptions",
    body: "The few decisions that genuinely need a human land in one inbox. Everything else is handled.",
  },
];

/**
 * Staggered, motion-safe entrance for the hero only (≤ 600ms total). The
 * classes are static so Tailwind emits them; the per-element delay rides an
 * inline style (with backwards fill so delayed elements start hidden).
 */
const ENTRANCE_CLASS =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500";
function entranceDelay(delayMs: number): React.CSSProperties {
  return { animationDelay: `${delayMs}ms`, animationFillMode: "backwards" };
}

export default function MarketingHome() {
  return (
    <main className="bg-sidebar text-sidebar-foreground relative flex min-h-screen flex-col overflow-hidden">
      {/* Workshop brand atmosphere — matches /pricing and the auth panel */}
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

      <section className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-6 pt-20 pb-16 text-center sm:pt-28">
        <span className={cn("type-meta text-sidebar-muted-foreground", ENTRANCE_CLASS)}
  style={entranceDelay(0)}
>
          Local and Canadian
        </span>
        <h1
          className={cn(
            "mt-5 text-4xl font-bold tracking-tight text-balance sm:text-6xl",
            ENTRANCE_CLASS,
          )}
          style={entranceDelay(80)}
        >
          Your business, running itself.
        </h1>
        <p
          className={cn(
            "text-sidebar-muted-foreground mt-5 max-w-xl text-lg leading-relaxed text-pretty",
            ENTRANCE_CLASS,
          )}
          style={entranceDelay(160)}
        >
          The AI operating layer for small businesses. Tharros does the busywork
          between the tools you already use, so you can get back to the work that
          matters.
        </p>
        <div className={cn("mt-9 flex flex-wrap items-center justify-center gap-3", ENTRANCE_CLASS)}
  style={entranceDelay(240)}
>
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
        <p className={cn("text-sidebar-muted-foreground type-small mt-6", ENTRANCE_CLASS)}
  style={entranceDelay(300)}
>
          14-day free trial. No credit card to look around.
        </p>
      </section>

      {/* The products */}
      <section aria-labelledby="products-heading" className="relative mx-auto w-full max-w-6xl px-6 pb-20">
        <h2 id="products-heading" className="sr-only">
          What Tharros runs for you
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PRODUCTS.map(({ icon: Icon, name, blurb, headline }) => (
            <div
              key={name}
              className={cn(
                "group rounded-2xl border p-6 transition-[transform,background-color,border-color] duration-200 ease-out motion-reduce:transition-none",
                headline
                  ? "border-primary/40 bg-primary/10 hover:bg-primary/15 hover:-translate-y-1 motion-reduce:hover:translate-y-0"
                  : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07] hover:-translate-y-1 motion-reduce:hover:translate-y-0",
              )}
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-lg",
                  headline
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/10 text-sidebar-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-bold tracking-tight">{name}</h3>
              <p className="text-sidebar-muted-foreground mt-2 text-sm leading-relaxed">{blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section
        aria-labelledby="how-heading"
        className="relative border-t border-white/10 bg-black/20"
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <h2 id="how-heading" className="text-2xl font-bold tracking-tight">
            How it works
          </h2>
          <p className="text-sidebar-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
            Built for owners, not operators of software. Three steps, then it quietly runs.
          </p>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, index) => (
              <li key={title} className="flex gap-4">
                <span className="bg-primary/15 text-primary-soft-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-bold tracking-tight">
                    <span className="text-sidebar-muted-foreground mr-1.5 tabular-nums">
                      {index + 1}.
                    </span>
                    {title}
                  </h3>
                  <p className="text-sidebar-muted-foreground mt-1.5 text-sm leading-relaxed">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="relative border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="space-y-1.5">
            <TharrosWordmark markClassName="size-6" />
            <p className="text-sidebar-muted-foreground type-meta">
              Keep it Local, Keep it Canadian.
            </p>
          </div>
          <nav className="flex items-center gap-5 text-sm" aria-label="Footer">
            <Link
              href="/pricing"
              className="text-sidebar-muted-foreground hover:text-sidebar-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="text-sidebar-muted-foreground hover:text-sidebar-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sidebar-muted-foreground hover:text-sidebar-foreground transition-colors"
            >
              Create an account
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
