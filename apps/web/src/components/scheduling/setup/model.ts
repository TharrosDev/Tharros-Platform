import type { EmploymentType } from "@/lib/scheduling/schemas";
import type { LaborRulePreset } from "@/lib/scheduling/types";
import type { SchedulingSetupPayload } from "@/lib/scheduling/schemas";

/**
 * Day 43 — client-side state model for the scheduling setup wizard. Inputs are
 * kept as strings (the natural form value); {@link buildPayload} normalizes them
 * into the shape the server action validates. Days use 0=Sun…6=Sat to match the
 * `business_hours.day_of_week` column; the UI orders them Monday-first.
 */

export type EmploymentTypeValue = EmploymentType;

export type EmployeeRow = {
  key: string;
  name: string;
  email: string;
  employment_type: EmploymentTypeValue;
  role: string;
  is_minor: boolean;
  target_hours_weekly: string;
};

export type HoursRow = {
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
};

export type StaffingRow = {
  day_of_week: number;
  min_staff: string;
  role: string;
};

export type ToneValue = "friendly" | "professional" | "casual" | "direct";

export type WizardState = {
  employees: EmployeeRow[];
  hours: HoursRow[];
  staffing: Record<number, StaffingRow>;
  preset: LaborRulePreset;
  tone: ToneValue;
  personaNotes: string;
};

/** 0=Sun…6=Sat. Display order is Monday-first. */
export const DAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
];

export const EMPLOYMENT_TYPES: { value: EmploymentTypeValue; label: string }[] = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "casual", label: "Casual" },
  { value: "contract", label: "Contract" },
];

export const TONES: { value: ToneValue; label: string; hint: string }[] = [
  { value: "friendly", label: "Friendly", hint: "Warm and personable" },
  { value: "professional", label: "Professional", hint: "Polished and clear" },
  { value: "casual", label: "Casual", hint: "Relaxed and conversational" },
  { value: "direct", label: "Direct", hint: "Brief and to the point" },
];

export function blankEmployee(): EmployeeRow {
  return {
    key: cryptoKey(),
    name: "",
    email: "",
    employment_type: "part_time",
    role: "",
    is_minor: false,
    target_hours_weekly: "",
  };
}

// A stable-enough row key without pulling in a uuid dep (client-only, not persisted).
let counter = 0;
function cryptoKey(): string {
  counter += 1;
  return `row-${counter}`;
}

export function defaultState(): WizardState {
  const hours: HoursRow[] = DAYS.map((d) => ({
    day_of_week: d.value,
    opens_at: "09:00",
    closes_at: "17:00",
    is_closed: d.value === 0 || d.value === 6, // weekends closed by default
  }));
  const staffing: Record<number, StaffingRow> = {};
  for (const d of DAYS) {
    staffing[d.value] = { day_of_week: d.value, min_staff: "1", role: "" };
  }
  return {
    employees: [blankEmployee()],
    hours,
    staffing,
    preset: "ontario",
    tone: "professional",
    personaNotes: "",
  };
}

/** Distinct, non-empty role names entered across the roster (for staffing reuse). */
export function rosterRoles(employees: EmployeeRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of employees) {
    const r = e.role.trim();
    if (r && !seen.has(r.toLowerCase())) {
      seen.add(r.toLowerCase());
      out.push(r);
    }
  }
  return out;
}

/** Normalize the wizard state into the payload the server action validates. */
export function buildPayload(state: WizardState): SchedulingSetupPayload {
  const employees = state.employees
    .filter((e) => e.name.trim() && e.email.trim())
    .map((e) => ({
      name: e.name.trim(),
      email: e.email.trim().toLowerCase(),
      employment_type: e.employment_type,
      role: e.role.trim() || undefined,
      is_minor: e.is_minor,
      target_hours_weekly: e.target_hours_weekly.trim() || undefined,
    }));

  const businessHours = state.hours.map((h) => ({
    day_of_week: h.day_of_week,
    opens_at: h.is_closed ? "" : h.opens_at,
    closes_at: h.is_closed ? "" : h.closes_at,
    is_closed: h.is_closed,
  }));

  const staffing = state.hours
    .filter((h) => !h.is_closed)
    .map((h) => {
      const row = state.staffing[h.day_of_week];
      return {
        day_of_week: h.day_of_week,
        start_time: h.opens_at,
        end_time: h.closes_at,
        min_staff: Number(row?.min_staff || "0"),
        role: row?.role.trim() || undefined,
      };
    });

  return {
    employees,
    businessHours,
    staffing,
    labor: { preset: state.preset },
    persona: { tone: state.tone, notes: state.personaNotes.trim() },
  } as SchedulingSetupPayload;
}
