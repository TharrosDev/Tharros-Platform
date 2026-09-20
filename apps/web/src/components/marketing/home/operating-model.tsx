"use client";

import { useRef, useState } from "react";
import { BookOpen, CalendarDays, Check, FileText, Users, Workflow } from "lucide-react";
import { m, useMotionValueEvent, useScroll } from "motion/react";
import { useReducedMotionSafe } from "@/components/motion/reduced-motion";

import { cn } from "@/lib/utils";
import { marketingContainer } from "@/components/marketing/marketing-chrome";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const STAGES = [
  {
    title: "Connect the operating context",
    body: "Upload the documents, configure the organization and set the rules your team already follows.",
  },
  {
    title: "Run the day from one workspace",
    body: "Ask grounded questions, manage the schedule, handle leads and resolve exceptions without switching tools.",
  },
  {
    title: "Automate what repeats",
    body: "Durable workflows carry the routine work. People keep the consequential decisions.",
  },
];

/**
 * Three stages on one rail. The rail fills as the section scrolls and each
 * stage's interface state settles when the signal reaches it.
 */
function OperatingModel() {
  const ref = useRef<HTMLOListElement>(null);
  const reduced = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 55%"] });
  const [reached, setReached] = useState(reduced ? 3 : 0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setReached(v >= 0.95 ? 3 : v >= 0.5 ? 2 : v > 0.02 ? 1 : 0);
  });
  const done = (i: number) => reduced || reached > i;

  return (
    <section
      id="how"
      aria-labelledby="how-heading"
      className="bg-card relative scroll-mt-16 border-y py-24 sm:py-32"
    >
      <div className={marketingContainer}>
        <SectionHeading
          id="how-heading"
          index="II"
          eyebrow="Operating model"
          lines={["Set the context once.", "Let the system carry it forward."]}
        />

        <ol
          ref={ref}
          className="relative mt-20 grid grid-cols-[minmax(0,1fr)] gap-14 pl-10 lg:mt-28 lg:grid-cols-3 lg:gap-10 lg:pt-14 lg:pl-0"
        >
          {/* Rail: vertical on small screens, horizontal from lg. */}
          <span
            aria-hidden
            className="bg-border absolute top-0 bottom-0 left-[0.4375rem] w-px lg:top-[0.4375rem] lg:right-0 lg:bottom-auto lg:left-0 lg:h-px lg:w-auto"
          />
          <m.span
            aria-hidden
            className="bg-primary absolute top-0 bottom-0 left-[0.4375rem] w-px origin-top lg:hidden"
            style={{ scaleY: reduced ? 1 : scrollYProgress }}
          />
          <m.span
            aria-hidden
            className="bg-primary absolute top-[0.4375rem] right-0 left-0 hidden h-px origin-left lg:block"
            style={{ scaleX: reduced ? 1 : scrollYProgress }}
          />

          {STAGES.map((stage, i) => (
            <li key={stage.title} className="relative">
              <span
                aria-hidden
                className={cn(
                  "absolute -left-10 top-1 size-[0.9375rem] rounded-full border-2 transition-colors duration-500 lg:-top-14 lg:left-0",
                  done(i) ? "border-primary-edge bg-primary" : "border-border bg-card",
                )}
              />
              <Reveal delay={i * 0.08}>
                <p
                  aria-hidden
                  className="text-primary-soft-foreground font-mono text-[clamp(3.5rem,6vw,5.5rem)] leading-none font-medium tracking-[-0.06em]"
                >
                  0{i + 1}
                </p>
                <h3 className="mt-6 text-2xl font-[700] tracking-[-0.035em] text-balance">
                  {stage.title}
                </h3>
                <p className="text-muted-foreground mt-3 max-w-sm text-base leading-relaxed">
                  {stage.body}
                </p>
                <div aria-hidden className="bg-background mt-8 rounded-2xl border p-4">
                  <StageState index={i} done={done(i)} />
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function StageState({ index, done }: { index: number; done: boolean }) {
  if (index === 0) {
    return (
      <ul className="space-y-2">
        {["Staff handbook", "Opening procedures"].map((doc) => (
          <Row
            key={doc}
            icon={FileText}
            label={doc}
            status={done ? "Ready" : "Extracting"}
            done={done}
          />
        ))}
      </ul>
    );
  }
  if (index === 1) {
    return (
      <ul className="space-y-2">
        <Row icon={BookOpen} label="Question answered" status="Cited" done={done} />
        <Row icon={CalendarDays} label="Sick call covered" status="Reviewed" done={done} />
        <Row icon={Users} label="Lead moved" status="Contacted" done={done} />
      </ul>
    );
  }
  return (
    <ul className="space-y-2">
      <Row
        icon={Workflow}
        label="Notify a manager"
        status={done ? "Recorded" : "Queued"}
        done={done}
      />
      <Row
        icon={Workflow}
        label="Prepare follow-up draft"
        status={done ? "Recorded" : "Queued"}
        done={done}
      />
    </ul>
  );
}

function Row({
  icon: Icon,
  label,
  status,
  done,
}: {
  icon: typeof FileText;
  label: string;
  status: string;
  done: boolean;
}) {
  return (
    <li className="bg-card flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm">
      <Icon className="text-primary-soft-foreground size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 text-xs font-semibold transition-colors duration-500",
          done ? "text-success" : "text-muted-foreground",
        )}
      >
        {done ? <Check className="size-3.5" /> : null}
        {status}
      </span>
    </li>
  );
}

export { OperatingModel };
