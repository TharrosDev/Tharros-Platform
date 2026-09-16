import Link from "next/link";
import { CalendarDays, FileText, MessagesSquare, Sparkles, Users, Workflow } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  MarketingBackdrop,
  MarketingFooter,
  MarketingHeader,
} from "@/components/marketing/marketing-chrome";

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
      <MarketingBackdrop />
      <MarketingHeader showPricing />

      <section className="relative mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-20 pb-20 text-center sm:pt-28 sm:pb-24">
        <h1
          className={cn(
            "max-w-3xl text-5xl font-bold tracking-[-0.035em] text-balance sm:text-7xl",
            ENTRANCE_CLASS,
          )}
          style={entranceDelay(0)}
        >
          Your business, running itself.
        </h1>
        <p
          className={cn(
            "text-sidebar-muted-foreground mt-6 max-w-2xl text-lg leading-relaxed text-pretty sm:text-xl",
            ENTRANCE_CLASS,
          )}
          style={entranceDelay(80)}
        >
          The AI operating layer for small businesses. Tharros does the busywork between the tools
          you already use, so you can get back to the work that matters.
        </p>
        <div
          className={cn("mt-10 flex flex-wrap items-center justify-center gap-3", ENTRANCE_CLASS)}
          style={entranceDelay(160)}
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
        <p
          className={cn("text-sidebar-muted-foreground type-small mt-6", ENTRANCE_CLASS)}
          style={entranceDelay(240)}
        >
          14-day free trial. No credit card to look around.
        </p>
      </section>

      {/* The products */}
      <section
        aria-labelledby="products-heading"
        className="relative mx-auto w-full max-w-6xl px-6 pb-24"
      >
        <div className="mb-8 max-w-2xl">
          <h2
            id="products-heading"
            className="text-3xl font-bold tracking-tight text-balance sm:text-4xl"
          >
            One place to keep the day moving.
          </h2>
          <p className="text-sidebar-muted-foreground mt-3 text-base leading-relaxed text-pretty">
            Tharros brings the work that usually disappears between inboxes, spreadsheets, and
            conversations into one calm operating view.
          </p>
        </div>

        <div className="grid overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] md:grid-cols-[1.15fr_0.85fr]">
          <div className="border-b border-white/10 p-7 sm:p-9 md:border-r md:border-b-0">
            <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl shadow-raised">
              <CalendarDays className="size-5" aria-hidden />
            </span>
            <h3 className="mt-8 max-w-md text-3xl font-bold tracking-tight text-balance">
              AI Workforce Scheduling
            </h3>
            <p className="text-sidebar-muted-foreground mt-3 max-w-xl text-base leading-relaxed">
              Collects availability, builds a labor-valid schedule, and handles sick calls, swaps,
              and time off. Only exceptions reach you.
            </p>
            <div className="mt-9 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-3">
              {[
                ["Availability", "Collected"],
                ["Schedule", "Built"],
                ["Exceptions", "Ready"],
              ].map(([label, value]) => (
                <div key={label} className="bg-sidebar px-4 py-3.5">
                  <span className="text-sidebar-muted-foreground type-meta block">{label}</span>
                  <span className="mt-1 block text-sm font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="divide-y divide-white/10">
            {PRODUCTS.filter((product) => !product.headline).map(({ icon: Icon, name, blurb }) => (
              <div key={name} className="flex min-h-52 flex-col justify-center p-7 sm:p-9">
                <span className="flex size-10 items-center justify-center rounded-lg bg-white/10 text-sidebar-foreground">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-lg font-bold tracking-tight">{name}</h3>
                <p className="text-sidebar-muted-foreground mt-2 text-sm leading-relaxed">
                  {blurb}
                </p>
              </div>
            ))}
          </div>
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

      <MarketingFooter />
    </main>
  );
}
