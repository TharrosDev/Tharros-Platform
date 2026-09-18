import Link from "next/link";
import { BookOpen, CalendarDays, FileText, MessagesSquare, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  MarketingBackdrop,
  MarketingFooter,
  MarketingHeader,
} from "@/components/marketing/marketing-chrome";

const STEPS = [
  {
    icon: FileText,
    title: "Add your business context",
    body: "Upload the documents your team actually works from and configure how your organization operates.",
  },
  {
    icon: MessagesSquare,
    title: "Use grounded AI",
    body: "Ask questions against your own knowledge base and get answers with source citations instead of generic guesses.",
  },
  {
    icon: Users,
    title: "Run the team",
    body: "Collect availability, generate schedules, publish shifts, and handle changes without losing manager control.",
  },
];

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
          Practical AI for the work behind your business.
        </h1>
        <p
          className={cn(
            "text-sidebar-muted-foreground mt-6 max-w-2xl text-lg leading-relaxed text-pretty sm:text-xl",
            ENTRANCE_CLASS,
          )}
          style={entranceDelay(80)}
        >
          Tharros combines a grounded business assistant with workforce scheduling in one focused
          workspace for small teams.
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
          14-day free trial. Current plan features are listed on the pricing page.
        </p>
      </section>

      <section
        aria-labelledby="products-heading"
        className="relative mx-auto w-full max-w-6xl px-6 pb-24"
      >
        <div className="mb-8 max-w-2xl">
          <h2
            id="products-heading"
            className="text-3xl font-bold tracking-tight text-balance sm:text-4xl"
          >
            Two products, one operating workspace.
          </h2>
          <p className="text-sidebar-muted-foreground mt-3 text-base leading-relaxed text-pretty">
            Built around the work Tharros can perform end to end today.
          </p>
        </div>

        <div className="grid overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] md:grid-cols-2">
          <div className="border-b border-white/10 p-7 sm:p-9 md:border-r md:border-b-0">
            <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl shadow-raised">
              <CalendarDays className="size-5" aria-hidden />
            </span>
            <h3 className="mt-8 text-2xl font-bold tracking-tight">AI Workforce Scheduling</h3>
            <p className="text-sidebar-muted-foreground mt-3 text-base leading-relaxed">
              Collect availability, generate and review schedule candidates, publish shifts, and
              manage sick calls, replacements, swaps and time off.
            </p>
            <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-3">
              {[
                ["Availability", "Collected"],
                ["Schedule", "Reviewed"],
                ["Changes", "Managed"],
              ].map(([label, value]) => (
                <div key={label} className="bg-sidebar px-4 py-3.5">
                  <span className="text-sidebar-muted-foreground type-meta block">{label}</span>
                  <span className="mt-1 block text-sm font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-7 sm:p-9">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-sidebar-foreground">
              <BookOpen className="size-5" aria-hidden />
            </span>
            <h3 className="mt-8 text-2xl font-bold tracking-tight">AI Business Assistant</h3>
            <p className="text-sidebar-muted-foreground mt-3 text-base leading-relaxed">
              Turn your own policies, guides, FAQs and operating documents into a searchable
              knowledge workspace with grounded answers and citations.
            </p>
            <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-3">
              {[
                ["Documents", "Indexed"],
                ["Answers", "Grounded"],
                ["Sources", "Cited"],
              ].map(([label, value]) => (
                <div key={label} className="bg-sidebar px-4 py-3.5">
                  <span className="text-sidebar-muted-foreground type-meta block">{label}</span>
                  <span className="mt-1 block text-sm font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="how-heading"
        className="relative border-t border-white/10 bg-black/20"
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <h2 id="how-heading" className="text-2xl font-bold tracking-tight">
            How it works
          </h2>
          <p className="text-sidebar-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
            Configure the context once, use the live products, and keep a person in control of
            consequential decisions.
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
