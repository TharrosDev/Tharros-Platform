import {
  ArrowDown,
  BellRing,
  BookOpen,
  CalendarDays,
  CircleCheck,
  FileText,
  PenLine,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

/*
  Illustrative product states for the marketing story. Content is sample UI,
  not data: no counts, customers or metrics (PRODUCT.md "Real data only").
*/

const PRODUCTS = [
  {
    key: "knowledge",
    index: "01",
    label: "Knowledge",
    title: "AI Business Assistant",
    icon: BookOpen,
    body: "Upload your policies, guides and operating documents. Ask in plain words and get answers grounded in your own material, with the sources cited. When the documents don't cover it, the assistant says so.",
    tags: ["Grounded answers", "Citations", "Your documents only"],
  },
  {
    key: "scheduling",
    index: "02",
    label: "Scheduling",
    title: "AI Workforce Scheduling",
    icon: CalendarDays,
    body: "Collect availability, generate a schedule around real constraints, then review it before anything is published. Sick calls, replacements, swaps and time off are handled in the same place.",
    tags: ["Manager review", "Self-service", "Sick-call coverage"],
  },
  {
    key: "leads",
    index: "03",
    label: "Lead Capture",
    title: "Lead Capture",
    icon: Users,
    body: "Publish capture forms, add leads by hand and move them through a live pipeline with timelines and notes. AI prepares follow-up drafts. A person reviews every one.",
    tags: ["Public forms", "Pipeline", "Reviewed drafts"],
  },
  {
    key: "automations",
    index: "04",
    label: "Automations",
    title: "Native Automations",
    icon: Workflow,
    body: "When a lead arrives or changes status, durable workflows notify a manager, update the pipeline or prepare a follow-up draft. Every run is recorded, and you can pause or test any workflow.",
    tags: ["Lead events", "Durable runs", "Full history"],
  },
] as const;

type ProductKey = (typeof PRODUCTS)[number]["key"];

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "cobalt" | "ok";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.72rem] font-medium whitespace-nowrap",
        tone === "neutral" && "bg-surface-2 text-muted-foreground",
        tone === "cobalt" && "border-primary/15 bg-primary-soft text-primary-soft-foreground",
        tone === "ok" && "border-success/20 bg-card text-success",
      )}
    >
      {children}
    </span>
  );
}

function PanelTitle({
  icon: Icon,
  crumb,
  title,
  aside,
}: {
  icon: typeof BookOpen;
  crumb: string;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="type-meta text-muted-foreground flex items-center gap-1.5">
          <Icon className="text-primary size-3.5" aria-hidden />
          {crumb}
        </p>
        <p className="mt-1.5 truncate text-base font-semibold tracking-tight sm:text-lg">{title}</p>
      </div>
      {aside}
    </div>
  );
}

function KnowledgePanel() {
  return (
    <div className="flex h-full flex-col gap-4">
      <PanelTitle icon={BookOpen} crumb="Assistant" title="Ask your business" />
      <div className="bg-surface-2 ml-auto max-w-[85%] rounded-2xl rounded-br-md px-4 py-3 text-sm leading-relaxed">
        What do we do when someone calls in sick before an opening shift?
      </div>
      <div className="bg-card max-w-[92%] rounded-2xl rounded-bl-md border p-4 shadow-xs">
        <p className="text-sm leading-relaxed">
          The staff member calls the manager on duty before the shift starts
          <sup className="text-primary ml-0.5 font-semibold">1</sup>. The manager opens the shift
          for replacement and records the absence
          <sup className="text-primary ml-0.5 font-semibold">2</sup>.
        </p>
        <div className="mt-3.5 flex flex-wrap gap-1.5 border-t pt-3">
          <Chip tone="cobalt">
            <FileText className="size-3" aria-hidden />1 Staff handbook
          </Chip>
          <Chip tone="cobalt">
            <FileText className="size-3" aria-hidden />2 Opening procedures
          </Chip>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2 rounded-xl border bg-card px-3.5 py-2.5 text-sm text-muted-foreground">
        <span className="flex-1 truncate">Ask about a policy, procedure or guide</span>
        <span className="bg-primary size-2 rounded-full" />
      </div>
    </div>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const ROLES = [
  { role: "Open", shifts: [1, 1, 1, 0, 1] },
  { role: "Floor", shifts: [1, 0, 1, 1, 1] },
  { role: "Close", shifts: [0, 1, 1, 1, 2] },
];

function SchedulingPanel() {
  return (
    <div className="flex h-full flex-col gap-4">
      <PanelTitle
        icon={CalendarDays}
        crumb="Scheduling"
        title="Next week"
        aside={<Chip tone="cobalt">Draft · needs review</Chip>}
      />
      <div className="grid grid-cols-[3.25rem_repeat(5,minmax(0,1fr))] gap-1.5 text-[0.72rem]">
        <span />
        {DAYS.map((day) => (
          <span key={day} className="text-muted-foreground text-center font-medium">
            {day}
          </span>
        ))}
        {ROLES.map(({ role, shifts }) => (
          <div key={role} className="contents">
            <span className="text-muted-foreground self-center font-medium">{role}</span>
            {shifts.map((kind, i) => (
              <span
                key={i}
                className={cn(
                  "h-9 rounded-lg border sm:h-11",
                  kind === 1 && "border-primary/15 bg-primary-soft",
                  kind === 0 && "bg-surface-2 border-dashed",
                  kind === 2 && "border-primary bg-primary/10 border-dashed",
                )}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="bg-card flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm shadow-xs">
        <CircleCheck className="text-success size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">Built from submitted availability</span>
      </div>
      <div className="mt-auto flex items-center justify-end gap-2">
        <span className="rounded-lg border bg-card px-3 py-2 text-xs font-semibold">Adjust</span>
        <span className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-xs font-semibold">
          Review &amp; publish
        </span>
      </div>
    </div>
  );
}

const STAGES = [
  { name: "New", cards: ["Website form", "Catering inquiry"] },
  { name: "Contacted", cards: ["Manual lead"] },
  { name: "Qualified", cards: [] as string[] },
];

function LeadsPanel() {
  return (
    <div className="flex h-full flex-col gap-4">
      <PanelTitle icon={Users} crumb="Lead Capture" title="Pipeline" />
      <div className="grid grid-cols-3 gap-2">
        {STAGES.map((stage, s) => (
          <div key={stage.name} className="bg-surface-2 min-h-24 rounded-xl p-2">
            <p className="type-meta text-muted-foreground px-1">{stage.name}</p>
            <div className="mt-2 space-y-1.5">
              {stage.cards.map((card, c) => (
                <div
                  key={card}
                  className={cn(
                    "bg-card rounded-lg border px-2 py-2 text-[0.72rem] leading-tight font-medium break-words shadow-xs",
                    s === 0 && c === 0 && "border-primary/40 ring-primary/15 ring-2",
                  )}
                >
                  {card}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="bg-card rounded-xl border p-3.5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <PenLine className="text-primary size-3.5" aria-hidden />
            Follow-up draft
          </p>
          <Chip tone="cobalt">Awaiting your review</Chip>
        </div>
        <p className="text-muted-foreground mt-2.5 text-sm leading-relaxed">
          Thanks for reaching out about catering. Here is what we can offer for your date...
        </p>
      </div>
    </div>
  );
}

function AutomationsPanel() {
  return (
    <div className="flex h-full flex-col gap-3">
      <PanelTitle
        icon={Workflow}
        crumb="Automations"
        title="New lead follow-up"
        aside={<Chip tone="ok">Active</Chip>}
      />
      <div className="flex flex-col items-stretch gap-1.5">
        <FlowStep icon={Zap} label="When" value="A lead is created" strong />
        <ArrowDown className="text-muted-foreground mx-auto size-3.5" aria-hidden />
        <FlowStep icon={BellRing} label="Then" value="Notify a manager" />
        <ArrowDown className="text-muted-foreground mx-auto size-3.5" aria-hidden />
        <FlowStep icon={PenLine} label="Then" value="Prepare a follow-up draft" />
      </div>
      <div className="mt-auto rounded-xl border bg-card px-3.5 py-2.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="type-meta text-muted-foreground">Run history</span>
          <span className="flex items-center gap-1.5 text-success text-xs font-semibold">
            <CircleCheck className="size-3.5" aria-hidden />
            Recorded
          </span>
        </div>
      </div>
    </div>
  );
}

function FlowStep({
  icon: Icon,
  label,
  value,
  strong,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3.5 py-2.5",
        strong ? "border-primary/25 bg-primary-soft" : "bg-card shadow-xs",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg",
          strong ? "bg-primary text-primary-foreground" : "bg-surface-2 text-primary",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="type-meta text-muted-foreground w-9">{label}</span>
      <span
        className={cn(
          "min-w-0 truncate text-sm font-medium",
          strong && "text-primary-soft-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

const PANELS: Record<ProductKey, () => React.JSX.Element> = {
  knowledge: KnowledgePanel,
  scheduling: SchedulingPanel,
  leads: LeadsPanel,
  automations: AutomationsPanel,
};

export { PANELS, PRODUCTS, type ProductKey };
