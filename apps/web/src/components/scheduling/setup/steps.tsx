"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_LABOR_RULE_PARAMS,
  LABOR_RULE_DISCLAIMER,
  LABOR_RULE_PRESETS,
} from "@/lib/scheduling/presets";
import type { LaborRulePreset } from "@/lib/scheduling/types";

import {
  DAYS,
  EMPLOYMENT_TYPES,
  TONES,
  rosterRoles,
  type EmployeeRow,
  type EmploymentTypeValue,
  type ToneValue,
  type WizardState,
} from "./model";

export type StepActions = {
  updateEmployee: (key: string, patch: Partial<EmployeeRow>) => void;
  addEmployee: () => void;
  removeEmployee: (key: string) => void;
  updateHours: (
    day: number,
    patch: { opens_at?: string; closes_at?: string; is_closed?: boolean },
  ) => void;
  updateStaffing: (day: number, patch: { min_staff?: string; role?: string }) => void;
  setPreset: (p: LaborRulePreset) => void;
  setTone: (t: ToneValue) => void;
  setPersonaNotes: (v: string) => void;
};

const fieldLabel = "text-xs font-medium";

/* ----------------------------------- Roster ---------------------------------- */

export function RosterStep({ state, actions }: { state: WizardState; actions: StepActions }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {state.employees.map((e, i) => (
          <EmployeeCard
            key={e.key}
            row={e}
            index={i}
            canRemove={state.employees.length > 1}
            onChange={(patch) => actions.updateEmployee(e.key, patch)}
            onRemove={() => actions.removeEmployee(e.key)}
          />
        ))}
      </div>
      <Button type="button" variant="outline" onClick={actions.addEmployee} className="w-full">
        <Plus /> Add team member
      </Button>
      <p className="text-muted-foreground text-sm">
        You can leave a row blank to skip it. Add or edit your team anytime from Settings.
      </p>
    </div>
  );
}

function EmployeeCard({
  row,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  row: EmployeeRow;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<EmployeeRow>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl bg-card border p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium tabular-nums">
          Team member {index + 1}
        </span>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive inline-flex items-center gap-1 text-xs transition-colors"
          >
            <Trash2 className="size-3.5" /> Remove
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className={fieldLabel} htmlFor={`name-${row.key}`}>
            Name
          </Label>
          <Input
            id={`name-${row.key}`}
            value={row.name}
            onChange={(ev) => onChange({ name: ev.target.value })}
            placeholder="Jordan Lee"
          />
        </div>
        <div className="space-y-1">
          <Label className={fieldLabel} htmlFor={`email-${row.key}`}>
            Email
          </Label>
          <Input
            id={`email-${row.key}`}
            type="email"
            value={row.email}
            onChange={(ev) => onChange({ email: ev.target.value })}
            placeholder="jordan@example.com"
          />
        </div>
        <div className="space-y-1">
          <Label className={fieldLabel}>Employment</Label>
          <Select
            value={row.employment_type}
            onValueChange={(v) => onChange({ employment_type: v as EmploymentTypeValue })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYMENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className={fieldLabel} htmlFor={`role-${row.key}`}>
            Role <span className="font-normal">(optional)</span>
          </Label>
          <Input
            id={`role-${row.key}`}
            value={row.role}
            onChange={(ev) => onChange({ role: ev.target.value })}
            placeholder="Server, Barista, Nurse…"
          />
        </div>
        <div className="space-y-1">
          <Label className={fieldLabel} htmlFor={`target-${row.key}`}>
            Target hours / week <span className="font-normal">(optional)</span>
          </Label>
          <Input
            id={`target-${row.key}`}
            inputMode="numeric"
            value={row.target_hours_weekly}
            onChange={(ev) => onChange({ target_hours_weekly: ev.target.value })}
            placeholder="32"
          />
        </div>
        <label className="flex items-center gap-2.5 sm:self-end sm:pb-2.5">
          <Checkbox
            checked={row.is_minor}
            onCheckedChange={(checked) => onChange({ is_minor: checked === true })}
          />
          <span className="text-sm">Under 18 (applies minor labor rules)</span>
        </label>
      </div>
    </div>
  );
}

/* ------------------------------- Operating hours ------------------------------ */

export function HoursStep({ state, actions }: { state: WizardState; actions: StepActions }) {
  const byDay = new Map(state.hours.map((h) => [h.day_of_week, h]));
  return (
    <div className="space-y-1.5">
      {DAYS.map((d) => {
        const h = byDay.get(d.value)!;
        return (
          <div
            key={d.value}
            className="grid grid-cols-[5.5rem_1fr] items-center gap-3 px-1 py-1.5 sm:grid-cols-[7rem_auto_1fr]"
          >
            <span className="text-sm font-medium">{d.label}</span>
            {h.is_closed ? (
              <span className="text-muted-foreground text-sm sm:col-span-1">Closed</span>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  aria-label={`${d.label} opens at`}
                  value={h.opens_at}
                  onChange={(ev) => actions.updateHours(d.value, { opens_at: ev.target.value })}
                  className="w-[7.5rem]"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="time"
                  aria-label={`${d.label} closes at`}
                  value={h.closes_at}
                  onChange={(ev) => actions.updateHours(d.value, { closes_at: ev.target.value })}
                  className="w-[7.5rem]"
                />
              </div>
            )}
            <label className="flex items-center justify-self-end gap-2 text-sm sm:col-start-3">
              <span className="text-muted-foreground">Open</span>
              <Switch
                checked={!h.is_closed}
                onCheckedChange={(open) => actions.updateHours(d.value, { is_closed: !open })}
              />
            </label>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ Staffing minimums ----------------------------- */

export function StaffingStep({ state, actions }: { state: WizardState; actions: StepActions }) {
  const roles = rosterRoles(state.employees);

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm">
        The fewest people you need working on a typical day. Closed days (like weekends, by default)
        can be opened right here. You can fine-tune time blocks later.
      </p>
      {DAYS.map((d) => {
        const hoursRow = state.hours.find((h) => h.day_of_week === d.value);
        if (hoursRow?.is_closed) {
          return (
            <div
              key={d.value}
              className="border-border flex flex-wrap items-center gap-3 border border-dashed px-4 py-3"
            >
              <span className="text-muted-foreground w-24 text-sm font-medium">{d.label}</span>
              <span className="text-muted-foreground text-sm">Closed</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => actions.updateHours(d.value, { is_closed: false })}
              >
                Open this day
              </Button>
            </div>
          );
        }
        const row = state.staffing[d.value];
        return (
          <div
            key={d.value}
            className="rounded-xl bg-card flex flex-wrap items-center gap-3 border px-4 py-3"
          >
            <span className="w-24 text-sm font-medium">{d.label}</span>
            <div className="flex items-center gap-2">
              <Input
                inputMode="numeric"
                aria-label={`${d.label} minimum staff`}
                value={row?.min_staff ?? "1"}
                onChange={(ev) => actions.updateStaffing(d.value, { min_staff: ev.target.value })}
                className="w-16 text-center"
              />
              <span className="text-muted-foreground text-sm">on shift</span>
            </div>
            {roles.length > 0 ? (
              <div className="ml-auto flex items-center gap-2">
                <span className={fieldLabel}>Role</span>
                <Select
                  value={row?.role || "any"}
                  onValueChange={(v) =>
                    actions.updateStaffing(d.value, {
                      role: v && v !== "any" ? String(v) : "",
                    })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any role</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------- Labor rules -------------------------------- */

const PRESET_OPTIONS: { value: LaborRulePreset; label: string; hint: string }[] = [
  { value: "ontario", label: "Ontario (ESA)", hint: "Ontario Employment Standards Act defaults" },
  { value: "canada_federal", label: "Canada (federal)", hint: "Canada Labour Code defaults" },
  { value: "custom", label: "Custom", hint: "Start from a neutral baseline and adjust later" },
];

export function LaborStep({ state, actions }: { state: WizardState; actions: StepActions }) {
  const params =
    state.preset === "custom" ? DEFAULT_LABOR_RULE_PARAMS : LABOR_RULE_PRESETS[state.preset];

  return (
    <div className="space-y-4">
      <RadioGroup
        value={state.preset}
        onValueChange={(v) => actions.setPreset(v as LaborRulePreset)}
        className="gap-2"
      >
        {PRESET_OPTIONS.map((opt) => {
          const active = state.preset === opt.value;
          return (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 border p-4 transition-colors",
                active ? "border-primary-edge bg-primary-soft/40" : "bg-card hover:bg-accent",
              )}
            >
              <RadioGroupItem value={opt.value} className="mt-0.5" />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">{opt.label}</span>
                <span className="text-muted-foreground block text-sm">{opt.hint}</span>
              </span>
            </label>
          );
        })}
      </RadioGroup>

      <dl className="bg-secondary/60 grid grid-cols-2 gap-x-4 gap-y-2 p-4 text-sm sm:grid-cols-3">
        <Rule label="Max daily" value={`${params.max_daily_hours} h`} />
        <Rule label="Max weekly" value={`${params.max_weekly_hours} h`} />
        <Rule label="Min rest" value={`${params.min_rest_hours_between_shifts} h`} />
        <Rule label="Overtime after" value={`${params.overtime_threshold_weekly} h/wk`} />
        <Rule label="Max consecutive" value={`${params.max_consecutive_days} days`} />
        <Rule
          label="Minor daily cap"
          value={params.minor_max_daily_hours ? `${params.minor_max_daily_hours} h` : "—"}
        />
      </dl>

      <p className="text-muted-foreground text-xs leading-relaxed">{LABOR_RULE_DISCLAIMER}</p>
    </div>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/* --------------------------------- Agent persona ------------------------------ */

export function PersonaStep({ state, actions }: { state: WizardState; actions: StepActions }) {
  return (
    <div className="space-y-4">
      <RadioGroup
        value={state.tone}
        onValueChange={(v) => actions.setTone(v as ToneValue)}
        className="grid gap-2 sm:grid-cols-2"
      >
        {TONES.map((t) => {
          const active = state.tone === t.value;
          return (
            <label
              key={t.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 border p-4 transition-colors",
                active ? "border-primary-edge bg-primary-soft/40" : "bg-card hover:bg-accent",
              )}
            >
              <RadioGroupItem value={t.value} className="mt-0.5" />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">{t.label}</span>
                <span className="text-muted-foreground block text-sm">{t.hint}</span>
              </span>
            </label>
          );
        })}
      </RadioGroup>

      <div className="space-y-1.5">
        <Label htmlFor="persona-notes">Anything else about how it should talk to your team?</Label>
        <Textarea
          id="persona-notes"
          value={state.personaNotes}
          onChange={(ev) => actions.setPersonaNotes(ev.target.value)}
          rows={4}
          placeholder="e.g. Always greet people by first name. Keep messages short. Mention that managers are available if they have questions."
        />
        <p className="text-muted-foreground text-xs">Optional. You can change this anytime.</p>
      </div>
    </div>
  );
}
