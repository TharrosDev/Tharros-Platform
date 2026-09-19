import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  FileText,
  Gauge,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
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
    eyebrow: "Knowledge",
    body: "Turn policies, guides and operating documents into grounded answers with citations.",
    proof: ["Documents indexed", "Answers grounded", "Sources cited"],
    span: "lg:col-span-2",
  },
  {
    icon: CalendarDays,
    title: "AI Workforce Scheduling",
    eyebrow: "Operations",
    body: "Collect availability, build schedules around real constraints, publish shifts and manage disruptions.",
    proof: ["Availability live", "Schedules reviewed", "Changes managed"],
    span: "",
  },
  {
    icon: Users,
    title: "Lead Capture",
    eyebrow: "Growth",
    body: "Create public forms, manage a live pipeline and prepare AI follow-up drafts for human review.",
    proof: ["Forms live", "Pipeline tracked", "Drafts reviewed"],
    span: "",
  },
  {
    icon: Workflow,
    title: "Native Automations",
    eyebrow: "Automation",
    body: "React to lead events with durable workflows that notify managers, update pipeline state or prepare drafts.",
    proof: ["Events triggered", "Runs durable", "History auditable"],
    span: "lg:col-span-2",
  },
];

const STEPS = [
  {
    icon: FileText,
    title: "Connect the operating context",
    body: "Upload the documents, configure the organization and define the real-world rules your team follows.",
  },
  {
    icon: MessagesSquare,
    title: "Run the day from one workspace",
    body: "Ask grounded questions, manage schedules, handle leads and resolve exceptions without bouncing between tools.",
  },
  {
    icon: Workflow,
    title: "Automate what is repeatable",
    body: "Let durable workflows carry repetitive work while keeping people in control of consequential actions.",
  },
];

export default function MarketingHome() {
  return (
    <main className="bg-sidebar text-sidebar-foreground relative flex min-h-screen flex-col overflow-hidden">
      <MarketingBackdrop />
      <MarketingHeader showPricing />

      <section className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 pb-24 pt-20 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:pt-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-sm text-sidebar-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            <span>One operating layer for the work behind your business</span>
          </div>

          <h1 className="max-w-3xl text-5xl font-bold tracking-[-0.055em] text-balance sm:text-6xl xl:text-7xl">
            Run the business.
            <span className="mt-1 block bg-gradient-to-r from-white via-white to-primary bg-clip-text text-transparent">
              Not the busywork.
            </span>
          </h1>

          <p className="text-sidebar-muted-foreground mt-6 max-w-2xl text-lg leading-relaxed text-pretty">
            Tharros connects knowledge, scheduling, lead capture and automation in one command
            surface built for small teams that need leverage without losing control.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "group")}>
              Start free
              <ArrowRight className="transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/pricing"
              className="focus-visible:ring-sidebar-ring/40 inline-flex h-12 items-center justify-center rounded-xl border border-white/12 bg-white/[0.045] px-6 text-sm font-semibold text-sidebar-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition-[background-color,border-color,transform] hover:-translate-y-px hover:border-white/20 hover:bg-white/[0.08] focus-visible:ring-[4px]"
            >
              Explore plans
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-sidebar-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" aria-hidden />
              14-day free trial
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              Human-controlled AI
            </span>
            <span className="inline-flex items-center gap-2">
              <Gauge className="size-4 text-primary" aria-hidden />
              Built for daily operations
            </span>
          </div>
        </div>

        <CommandSurfacePreview />
      </section>

      <section className="relative border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-5">
          <span className="type-meta text-sidebar-muted-foreground">A connected operating system</span>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm font-medium text-sidebar-foreground/85">
            <span>Knowledge</span>
            <span>Scheduling</span>
            <span>Lead Capture</span>
            <span>Automations</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="products-heading" className="relative mx-auto w-full max-w-6xl px-6 py-24">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="type-meta text-primary">Connected products</p>
            <h2 id="products-heading" className="mt-3 text-3xl font-bold tracking-[-0.04em] text-balance sm:text-5xl">
              Less tool switching.
              <span className="block text-sidebar-muted-foreground">More operating leverage.</span>
            </h2>
          </div>
          <p className="text-sidebar-muted-foreground max-w-xl text-base leading-relaxed lg:justify-self-end">
            Every product shares the same organization, permissions, billing, notifications and
            durable job infrastructure. Work flows between surfaces instead of dying in silos.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {PRODUCTS.map(({ icon: Icon, title, eyebrow, body, proof, span }) => (
            <article
              key={title}
              className={cn(
                "group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] backdrop-blur-sm transition-[border-color,background-color,transform] hover:-translate-y-1 hover:border-primary/25 hover:bg-white/[0.065]",
                span,
              )}
            >
              <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-primary/0 blur-3xl transition-colors group-hover:bg-primary/12" aria-hidden />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/15 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="type-meta text-sidebar-muted-foreground">{eyebrow}</span>
                </div>
                <h3 className="mt-8 text-2xl font-bold tracking-[-0.035em]">{title}</h3>
                <p className="text-sidebar-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">{body}</p>
                <div className="mt-8 grid gap-2 sm:grid-cols-3">
                  {proof.map((item) => (
                    <div key={item} className="rounded-xl border border-white/8 bg-black/10 px-3 py-2.5">
                      <span className="text-sidebar-muted-foreground text-xs font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="how-heading" className="relative border-y border-white/10 bg-black/15">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="max-w-2xl">
            <p className="type-meta text-primary">Operating model</p>
            <h2 id="how-heading" className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
              Set the context once. Let the system carry it forward.
            </h2>
          </div>

          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, index) => (
              <li key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <span className="font-mono text-xs font-semibold tracking-[0.12em] text-sidebar-muted-foreground">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-7 text-lg font-bold tracking-tight">{title}</h3>
                <p className="text-sidebar-muted-foreground mt-2 text-sm leading-relaxed">{body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-16 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/18 via-white/[0.045] to-white/[0.02] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="type-meta text-primary">Ready when you are</p>
                <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
                  Replace operational drag with a system your team can actually use.
                </h2>
                <p className="text-sidebar-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">
                  Start with the product you need today. The rest of the operating layer is already connected.
                </p>
              </div>
              <Link href="/signup" className={buttonVariants({ size: "lg" })}>
                Start your trial
                <ArrowRight aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}

function CommandSurfacePreview() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-8 rounded-full bg-primary/25 blur-[90px]" aria-hidden />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-[#10131d]/90 p-3 shadow-[0_36px_110px_-42px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
        <div className="rounded-[1.45rem] border border-white/8 bg-[#151925]">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary shadow-[0_0_12px_rgba(90,110,255,0.85)]" />
              <span className="text-xs font-semibold">Tharros command center</span>
            </div>
            <span className="rounded-md border border-white/8 bg-white/[0.04] px-2 py-1 font-mono text-[0.6rem] tracking-[0.12em] text-sidebar-muted-foreground">
              LIVE
            </span>
          </div>

          <div className="grid min-h-[28rem] grid-cols-[5rem_1fr]">
            <div className="border-r border-white/8 p-2.5">
              <div className="mb-4 size-8 rounded-lg bg-primary/25" />
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className={cn(
                      "h-9 rounded-lg border",
                      item === 0
                        ? "border-primary/25 bg-primary/20"
                        : "border-white/[0.04] bg-white/[0.025]",
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[0.6rem] font-semibold tracking-[0.12em] text-primary">OPERATIONS</p>
                  <p className="mt-1 text-xl font-bold tracking-tight">Good morning.</p>
                </div>
                <div className="h-8 w-20 rounded-lg border border-white/8 bg-white/[0.04]" />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  ["32", "Documents"],
                  ["Live", "Schedule"],
                  ["4", "Signals"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                    <p className="text-lg font-bold tracking-tight">{value}</p>
                    <p className="mt-1 text-[0.65rem] text-sidebar-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Recent activity</span>
                    <span className="size-2 rounded-full bg-emerald-400" />
                  </div>
                  <div className="mt-4 space-y-3">
                    {[70, 92, 58, 78].map((width, index) => (
                      <div key={width} className="flex items-center gap-2.5">
                        <span className={cn("size-7 rounded-lg", index === 1 ? "bg-primary/25" : "bg-white/[0.06]")} />
                        <div className="flex-1">
                          <div className="h-1.5 rounded-full bg-white/10" style={{ width: `${width}%` }} />
                          <div className="mt-1.5 h-1 w-1/2 rounded-full bg-white/[0.045]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-primary/15 bg-primary/[0.07] p-3.5">
                  <p className="text-xs font-semibold">Schedule health</p>
                  <div className="mt-5 flex items-end gap-1.5">
                    {[42, 68, 54, 84, 72, 92, 62].map((height) => (
                      <div key={height} className="flex-1 rounded-t bg-primary/70" style={{ height: `${height}px` }} />
                    ))}
                  </div>
                  <div className="mt-3 h-px bg-white/8" />
                  <p className="mt-3 text-[0.65rem] text-sidebar-muted-foreground">Coverage stable across 7 days</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
