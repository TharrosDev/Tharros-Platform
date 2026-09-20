"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { Check, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { spring } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button";
import { marketingContainer } from "@/components/marketing/marketing-chrome";
import { useReducedMotionSafe } from "@/components/motion/reduced-motion";

/** CSS entrance delay; the animation itself lives in globals.css. */
const delay = (s: number) => ({ animationDelay: `${s}s` });

const PROOF = ["14-day free trial", "Human-controlled AI", "Answers cite their sources"];

/*
  The opening is the mechanism, operable, not a picture of it: real strips the
  visitor signs, which then travel out of the pending bay and seat in the
  cleared one. Sample board, illustrative content only. No customers, no
  counts, no metrics.
*/
const STRIPS = [
  {
    id: "schedule",
    what: "Schedule draft, two weeks",
    from: "Generated",
    hint: "Nothing reaches staff until it is initialled.",
  },
  {
    id: "lead",
    what: "Lead from the website form",
    from: "Captured",
    hint: "The follow-up is drafted, never sent on its own.",
  },
  {
    id: "sick",
    what: "Sunday close, sick call",
    from: "Escalated",
    hint: "Replacement offers go out once you approve them.",
  },
];

function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="relative pt-14 pb-20 sm:pt-20 lg:pb-28">
      <div
        className={cn(
          marketingContainer,
          "grid grid-cols-[minmax(0,1fr)] gap-y-12 lg:grid-cols-12 lg:gap-x-12",
        )}
      >
        <div className="lg:col-span-6 lg:pt-6">
          <h1
            id="hero-heading"
            style={delay(0)}
            className="animate-fade-up type-hero text-rack-foreground"
          >
            Run the business.
            <br />
            <span className="text-primary">Not the busywork.</span>
          </h1>

          <p
            style={delay(0.12)}
            className="animate-fade-up text-rack-muted-foreground type-body mt-7 max-w-md text-pretty sm:text-lg"
          >
            Tharros brings your knowledge, scheduling, lead capture and automations into one
            workspace. AI does the groundwork. Your team stays in control of every decision.
          </p>

          <div
            style={delay(0.2)}
            className="animate-fade-up mt-9 flex flex-wrap items-center gap-3"
          >
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Start free
            </Link>
            <Link href="/pricing" className={buttonVariants({ size: "lg", variant: "outline" })}>
              Explore plans
            </Link>
          </div>

          <ul style={delay(0.28)} className="animate-fade-up seam-t mt-10 space-y-2.5 pt-6">
            {PROOF.map((item) => (
              <li
                key={item}
                className="text-rack-muted-foreground type-meta flex items-center gap-3"
              >
                <span className="bg-primary h-px w-4" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div style={delay(0.16)} className="animate-fade-up lg:col-span-6">
          <LiveBoard />
        </div>
      </div>
    </section>
  );
}

/**
 * The signature interaction, operable rather than performed: sign a strip and
 * it travels out of the pending bay and seats in the cleared one. Real
 * buttons, real keyboard operation, the result announced. Under reduced motion
 * the strip changes bay without travelling.
 */
function LiveBoard() {
  const reduced = useReducedMotionSafe();
  const [cleared, setCleared] = useState<string[]>([]);

  const pending = STRIPS.filter((s) => !cleared.includes(s.id));
  const done = STRIPS.filter((s) => cleared.includes(s.id));
  const transition = reduced ? { duration: 0 } : spring.snappy;

  return (
    <div className="bg-rack-deep border-rack-edge border">
      <div className="border-rack-edge flex items-baseline justify-between gap-3 border-b px-4 py-3">
        <p className="type-meta text-rack-foreground" id="live-board-label">
          Needs your initials
        </p>
        <p className="type-meta text-rack-muted-foreground">Sample board</p>
      </div>

      <m.ul layout aria-labelledby="live-board-label" transition={transition}>
        <AnimatePresence initial={false} mode="popLayout">
          {pending.map((strip) => (
            <m.li
              key={strip.id}
              layout
              layoutId={`strip-${strip.id}`}
              transition={transition}
              className="on-stock bg-stock-pending border-border relative flex items-stretch border-b last:border-b-0"
            >
              <span aria-hidden className="bg-warning w-1 shrink-0" />
              <div className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3.5">
                <span className="min-w-0 flex-1">
                  <span className="type-strip text-foreground block truncate font-semibold">
                    {strip.what}
                  </span>
                  <span className="type-small text-muted-foreground block">{strip.hint}</span>
                </span>
                <span className="type-meta text-muted-foreground hidden shrink-0 sm:block">
                  {strip.from}
                </span>
                <button
                  type="button"
                  onClick={() => setCleared((ids) => [...ids, strip.id])}
                  className="border-foreground/60 bg-card text-foreground type-meta hover:border-primary-edge hover:bg-primary hover:text-primary-foreground flex h-7 min-w-11 shrink-0 cursor-pointer items-center justify-center border transition-colors active:translate-y-px"
                >
                  Sign
                  <span className="sr-only"> off {strip.what}</span>
                </button>
              </div>
            </m.li>
          ))}
        </AnimatePresence>
      </m.ul>

      {done.length ? (
        <>
          <div className="border-rack-edge border-y px-4 py-2">
            <p className="type-meta text-rack-muted-foreground" id="live-board-cleared">
              Cleared
            </p>
          </div>
          <m.ul layout aria-labelledby="live-board-cleared" transition={transition}>
            <AnimatePresence initial={false} mode="popLayout">
              {done.map((strip) => (
                <m.li
                  key={strip.id}
                  layout
                  layoutId={`strip-${strip.id}`}
                  transition={transition}
                  className="on-stock bg-stock-cleared border-border relative flex items-stretch border-b last:border-b-0"
                >
                  <span aria-hidden className="bg-success w-1 shrink-0" />
                  <div className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3.5">
                    <span className="type-strip text-foreground min-w-0 flex-1 truncate font-semibold">
                      {strip.what}
                    </span>
                    <span className="type-meta text-muted-foreground hidden shrink-0 sm:block">
                      Recorded
                    </span>
                    <span
                      aria-hidden
                      className="border-primary-edge bg-primary text-primary-foreground flex h-7 min-w-11 shrink-0 items-center justify-center border"
                    >
                      <Check className="size-4" strokeWidth={3} />
                    </span>
                  </div>
                </m.li>
              ))}
            </AnimatePresence>
          </m.ul>
        </>
      ) : null}

      <div className="border-rack-edge flex items-center justify-between gap-3 border-t px-4 py-3">
        <p aria-live="polite" className="type-meta text-rack-muted-foreground">
          {done.length === STRIPS.length
            ? "Board clear. Every move was recorded."
            : "Nothing moves until a person signs it off."}
        </p>
        {done.length ? (
          <button
            type="button"
            onClick={() => setCleared([])}
            className="type-meta text-rack-muted-foreground hover:text-rack-foreground inline-flex cursor-pointer items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}

export { Hero };
