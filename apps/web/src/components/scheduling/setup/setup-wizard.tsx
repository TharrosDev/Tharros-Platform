"use client";

import * as React from "react";
import { useActionState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/auth/auth-card";
import { completeSchedulingSetup } from "@/lib/scheduling/actions";
import type { LaborRulePreset } from "@/lib/scheduling/types";

import {
  blankEmployee,
  buildPayload,
  defaultState,
  type ToneValue,
  type WizardState,
} from "./model";
import {
  HoursStep,
  LaborStep,
  PersonaStep,
  RosterStep,
  StaffingStep,
  type StepActions,
} from "./steps";

const STEPS = [
  { title: "Your team", blurb: "Add the people you schedule. You can refine details later." },
  { title: "Operating hours", blurb: "When are you open each day?" },
  { title: "Staffing", blurb: "The minimum people you need working each open day." },
  { title: "Labor rules", blurb: "Pick a starting ruleset the scheduler must respect." },
  { title: "Assistant voice", blurb: "How should the scheduling assistant talk to your team?" },
] as const;

export function SchedulingSetupWizard({
  initialState,
  editing = false,
}: {
  /** Prefilled state when reopening the wizard to edit an existing setup. */
  initialState?: WizardState;
  /** Edit mode: lets the user jump straight to any step and relabels the submit. */
  editing?: boolean;
}) {
  const [state, setState] = React.useState<WizardState>(() => initialState ?? defaultState());
  const [step, setStep] = React.useState(0);
  const [formState, formAction, pending] = useActionState(completeSchedulingSetup, undefined);

  const actions: StepActions = React.useMemo(
    () => ({
      updateEmployee: (key, patch) =>
        setState((s) => ({
          ...s,
          employees: s.employees.map((e) => (e.key === key ? { ...e, ...patch } : e)),
        })),
      addEmployee: () => setState((s) => ({ ...s, employees: [...s.employees, blankEmployee()] })),
      removeEmployee: (key) =>
        setState((s) => ({ ...s, employees: s.employees.filter((e) => e.key !== key) })),
      updateHours: (day, patch) =>
        setState((s) => ({
          ...s,
          hours: s.hours.map((h) => (h.day_of_week === day ? { ...h, ...patch } : h)),
        })),
      updateStaffing: (day, patch) =>
        setState((s) => ({
          ...s,
          staffing: {
            ...s.staffing,
            [day]: { ...s.staffing[day], day_of_week: day, ...patch },
          },
        })),
      setPreset: (p: LaborRulePreset) => setState((s) => ({ ...s, preset: p })),
      setTone: (t: ToneValue) => setState((s) => ({ ...s, tone: t })),
      setPersonaNotes: (v: string) => setState((s) => ({ ...s, personaNotes: v })),
    }),
    [],
  );

  const isLast = step === STEPS.length - 1;
  const payload = React.useMemo(() => JSON.stringify(buildPayload(state)), [state]);

  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_1fr]">
      <StepRail
        step={step}
        // In edit mode every step is already filled + valid, so allow free jumps.
        onJump={(i) => (editing || i < step) && setStep(i)}
        allowJumpAhead={editing}
      />

      <form action={formAction} className="min-w-0">
        <input type="hidden" name="payload" value={payload} />

        <div className="space-y-1">
          <h2 className="type-h2">{STEPS[step].title}</h2>
          <p className="text-muted-foreground text-sm">{STEPS[step].blurb}</p>
        </div>

        {formState?.message ? (
          <div className="mt-4">
            <FormMessage>{formState.message}</FormMessage>
          </div>
        ) : null}

        <div className="mt-6">
          <Step step={step} state={state} actions={actions} />
        </div>

        <div className="mt-8 flex items-center justify-between border-t pt-5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || pending}
          >
            <ArrowLeft /> Back
          </Button>

          {isLast ? (
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Finish setup"}
              {!pending ? <Check /> : null}
            </Button>
          ) : (
            <Button type="button" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              Continue <ArrowRight />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Step({
  step,
  state,
  actions,
}: {
  step: number;
  state: WizardState;
  actions: StepActions;
}) {
  switch (step) {
    case 0:
      return <RosterStep state={state} actions={actions} />;
    case 1:
      return <HoursStep state={state} actions={actions} />;
    case 2:
      return <StaffingStep state={state} actions={actions} />;
    case 3:
      return <LaborStep state={state} actions={actions} />;
    default:
      return <PersonaStep state={state} actions={actions} />;
  }
}

function StepRail({
  step,
  onJump,
  allowJumpAhead = false,
}: {
  step: number;
  onJump: (i: number) => void;
  allowJumpAhead?: boolean;
}) {
  return (
    <nav aria-label="Setup steps" className="lg:sticky lg:top-6 lg:self-start">
      <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={s.title} className="min-w-0 flex-1 lg:flex-none">
              <button
                type="button"
                onClick={() => onJump(i)}
                disabled={!allowJumpAhead && i >= step}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  current && "bg-primary-soft/50 text-foreground font-medium",
                  done && "text-foreground hover:bg-accent",
                  !current && !done && "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors",
                    current && "border-primary-edge bg-primary text-primary-foreground",
                    done && "border-primary-edge bg-primary text-primary-foreground",
                    !current && !done && "border-border text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className="hidden truncate lg:inline">{s.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
