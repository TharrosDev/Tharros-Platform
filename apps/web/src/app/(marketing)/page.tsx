import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  FileText,
  MessagesSquare,
  Users,
  Workflow,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  MarketingBackdrop,
  MarketingFooter,
  MarketingHeader,
} from "@/components/marketing/marketing-chrome";

const PRODUCTS = [
  {
    icon: BookOpen,
    title: "AI Business Assistant",
    body: "Turn policies, guides and operating documents into grounded answers with citations.",
    proof: ["Documents indexed", "Answers grounded", "Sources cited"],
  },
  {
    icon: CalendarDays,
    title: "AI Workforce Scheduling",
    body: "Collect availability, generate and review schedules, publish shifts and handle disruptions.",
    proof: ["Availability collected", "Schedules reviewed", "Changes managed"],
  },
  {
    icon: Users,
    title: "Lead Capture",
    body: "Create public capture forms, manage a live lead pipeline, keep notes and prepare AI follow-up drafts for human review.",
    proof: ["Forms live", "Pipeline tracked", "Drafts reviewed"],
  },
  {
    icon: Workflow,
    title: "Native Automations",
    body: "React to lead events with durable workflows that notify managers, update pipeline state or prepare follow-up drafts.",
    proof: ["Events triggered", "Runs durable", "History auditable"],
  },
];

const STEPS = [
  {
    icon: FileText,
    title: "Add your operating context",
    body: "Upload the documents your team works from, configure your organization, and set the rules Tharros should follow.",
  },
  {
    icon: MessagesSquare,
    title: "Run the daily work",
    body: "Ask grounded questions, build schedules, capture enquiries, and keep customer follow-up organized.",
  },
  {
    icon: Workflow,
    title: "Automate repeatable steps",
    body: "Use native event-driven workflows where automation is safe, while keeping managers in control of consequential actions.",
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
          Tharros brings business knowledge, workforce scheduling, lead capture and native
          automation into one operating workspace for small teams.
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
          14-day free trial. Features vary by plan.
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
            Four connected products, one workspace.
          </h2>
          <p className="text-sidebar-muted-foreground mt-3 text-base leading-relaxed text-pretty">
            Each surface runs on the same organization, permissions, billing, notifications and
            durable job infrastructure.
          </p>
        </div>

        <div className="grid overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] md:grid-cols-2">
          {PRODUCTS.map(({ icon: Icon, title, body, proof }, index) => (
            <div
              key={title}
              className={cn(
                "p-7 sm:p-9",
                index % 2 === 0 && "md:border-r md:border-white/10",
                index < 2 && "border-b border-white/10",
              )}
            >
              <span className="bg-primary/15 text-primary-soft-foreground flex size-11 items-center justify-center rounded-xl">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-7 text-2xl font-bold tracking-tight">{title}</h3>
              <p className="text-sidebar-muted-foreground mt-3 text-base leading-relaxed">{body}</p>
              <div className="mt-7 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-3">
                {proof.map((item) => (
                  <div key={item} className="bg-sidebar px-3 py-3 text-center">
                    <span className="text-sidebar-muted-foreground type-meta">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
