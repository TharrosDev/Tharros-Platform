"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { m, useReducedMotion, useScroll, useTransform } from "motion/react";

import { cn } from "@/lib/utils";
import { marketingContainer } from "@/components/marketing/marketing-chrome";
import { Reveal } from "./reveal";

/** The one inverted cobalt moment: the proposition returns at full scale. */
function Finale() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 25%"] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.86, 1]);
  const x = useTransform(scrollYProgress, [0, 1], ["-4%", "0%"]);

  return (
    <section
      ref={ref}
      aria-labelledby="finale-heading"
      className="bg-primary text-primary-foreground relative overflow-hidden py-28 sm:py-44"
    >
      {/* Four lines converge on one point: the operating layer, abstracted. */}
      <svg
        aria-hidden
        viewBox="0 0 1200 600"
        preserveAspectRatio="xMidYMid slice"
        className="stroke-primary-foreground pointer-events-none absolute inset-0 size-full opacity-[0.14]"
        fill="none"
      >
        <path d="M-50 40 C 400 40 700 300 1250 300" strokeWidth="1" />
        <path d="M-50 560 C 400 560 700 300 1250 300" strokeWidth="1" />
        <path d="M-50 200 C 450 200 750 300 1250 300" strokeWidth="1" />
        <path d="M-50 420 C 450 420 750 300 1250 300" strokeWidth="1" />
      </svg>

      <div className={cn(marketingContainer, "relative")}>
        <p className="type-meta flex items-center gap-3">
          <span aria-hidden className="bg-primary-foreground h-px w-8" />
          Start today
        </p>
        <m.h2
          id="finale-heading"
          style={reduced ? undefined : { scale, x }}
          className="mt-8 origin-left text-[clamp(3.25rem,9vw,9rem)] leading-[0.86] font-[760] tracking-[-0.065em]"
        >
          Run the business.
        </m.h2>

        <Reveal className="mt-14 grid gap-10 border-t border-primary-foreground/25 pt-10 lg:grid-cols-12">
          <p className="text-xl leading-relaxed font-medium text-pretty lg:col-span-6">
            Start with the product you need today. The rest of the operating layer is already
            connected.
          </p>
          <div className="flex flex-wrap items-center gap-3 lg:col-span-6 lg:justify-end">
            <Link
              href="/signup"
              className="bg-card text-primary group focus-visible:ring-primary-foreground/60 inline-flex h-13 items-center gap-2 rounded-xl px-7 text-base font-semibold shadow-raised outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-[4px]"
            >
              Start your 14-day trial
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/pricing"
              className="focus-visible:ring-primary-foreground/60 inline-flex h-13 items-center rounded-xl px-1 text-base sm:px-5 font-semibold underline decoration-primary-foreground/40 underline-offset-[6px] outline-none transition-[text-decoration-color] hover:decoration-primary-foreground focus-visible:ring-[4px]"
            >
              Compare plans
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export { Finale };
