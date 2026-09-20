"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { marketingContainer } from "@/components/marketing/marketing-chrome";
import { useReducedMotionSafe } from "@/components/motion/reduced-motion";

/** CSS entrance delay; the animation itself lives in globals.css. */
const delay = (s: number) => ({ animationDelay: `${s}s` });

const PROOF = ["14-day free trial", "Human-controlled AI", "Answers cite their sources"];

/*
  The opening is the mechanism, not a picture of it: a rack with work in it,
  where the machine prints a strip and a person puts their initials on it
  before it moves. Sample board, illustrative content only. No customers, no
  counts, no metrics.
*/
const STRIPS = [
  {
    what: "Schedule draft, two weeks",
    who: "Generated",
    hint: "Nothing reaches staff until it is initialled.",
  },
  {
    what: "Lead from the website form",
    who: "Captured",
    hint: "The follow-up is drafted, never sent on its own.",
  },
  {
    what: "Sunday close, sick call",
    who: "Escalated",
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
          <LiveBay />
        </div>
      </div>
    </section>
  );
}

/**
 * The signature interaction, demonstrated rather than described: a strip is
 * printed, a person initials it, and it clears. Rests at the initialled state
 * under reduced motion rather than cycling.
 */
function LiveBay() {
  const reduced = useReducedMotionSafe();
  const [signed, setSigned] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setSigned((n) => (n + 1) % (STRIPS.length + 1)), 2200);
    return () => window.clearInterval(id);
  }, [reduced]);

  const done = reduced ? STRIPS.length : signed;

  return (
    <div className="bg-rack-deep border-rack-edge border">
      <div className="border-rack-edge flex items-baseline justify-between gap-3 border-b px-4 py-3">
        <p className="type-meta text-rack-foreground">Needs your initials</p>
        <p className="type-meta text-rack-muted-foreground">Sample board</p>
      </div>

      <ul>
        {STRIPS.map((strip, index) => {
          const isSigned = index < done;
          return (
            <li
              key={strip.what}
              className={cn(
                "on-stock border-border relative flex items-stretch border-b transition-colors last:border-b-0",
                isSigned ? "bg-stock-cleared" : "bg-stock-pending",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "w-1 shrink-0 transition-colors",
                  isSigned ? "bg-success" : "bg-warning",
                )}
              />
              <div className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3.5">
                <span className="min-w-0 flex-1">
                  <span className="type-strip text-foreground block truncate font-semibold">
                    {strip.what}
                  </span>
                  <span className="type-small text-muted-foreground block">{strip.hint}</span>
                </span>
                <span className="type-meta text-muted-foreground hidden shrink-0 sm:block">
                  {isSigned ? "Cleared" : strip.who}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "type-meta flex h-7 min-w-11 shrink-0 items-center justify-center border transition-colors",
                    isSigned
                      ? "border-primary-edge bg-primary text-primary-foreground"
                      : "border-foreground/60 bg-card text-foreground",
                  )}
                >
                  {isSigned ? <Check className="size-4" strokeWidth={3} /> : <span>Sign</span>}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-rack-muted-foreground type-meta border-rack-edge border-t px-4 py-3">
        {done === STRIPS.length
          ? "Board clear. Every move was recorded."
          : "Nothing moves until a person signs it off."}
      </p>
    </div>
  );
}

export { Hero };
