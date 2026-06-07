import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";

import { defaultLaborRules } from "./presets";
import { buildSolverInput } from "./solver/build-input";
import type { LaborRulePreset, LaborRules } from "./types";
import type { ValidationContext } from "./validation";

/**
 * Day 42 — read-only access to an org's labor ruleset.
 *
 * `labor_rules` is member-readable via the Day-10/11 RLS helpers, so this never
 * leaks across orgs even though `orgId` is passed explicitly (the solver and
 * eligibility checks call it with a known org). Writes / preset selection are
 * Day 43 (the onboarding wizard). When an org has no row yet, we return the
 * permissive `custom` default so the engine always has a usable ruleset.
 */

// Untyped PostgREST row; `numeric` may arrive as a string, `time`/jsonb as-is.
type LaborRulesRow = {
  org_id: string;
  preset: LaborRulePreset;
  max_daily_hours: number | string;
  max_weekly_hours: number | string;
  min_rest_hours_between_shifts: number | string;
  overtime_threshold_weekly: number | string;
  max_consecutive_days: number | string;
  minor_max_daily_hours: number | string | null;
  minor_earliest_start: string | null;
  minor_latest_end: string | null;
  params: Record<string, unknown> | null;
  updated_at: string;
};

const num = (v: number | string): number => (typeof v === "string" ? Number(v) : v);
const numOrNull = (v: number | string | null): number | null => (v === null ? null : num(v));

function normalizeLaborRules(row: LaborRulesRow): LaborRules {
  return {
    org_id: row.org_id,
    preset: row.preset,
    max_daily_hours: num(row.max_daily_hours),
    max_weekly_hours: num(row.max_weekly_hours),
    min_rest_hours_between_shifts: num(row.min_rest_hours_between_shifts),
    overtime_threshold_weekly: num(row.overtime_threshold_weekly),
    max_consecutive_days: num(row.max_consecutive_days),
    minor_max_daily_hours: numOrNull(row.minor_max_daily_hours),
    minor_earliest_start: row.minor_earliest_start,
    minor_latest_end: row.minor_latest_end,
    params: row.params ?? {},
    updated_at: row.updated_at,
  };
}

export const getLaborRules = cache(async (orgId: string): Promise<LaborRules> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("labor_rules")
    .select(
      "org_id, preset, max_daily_hours, max_weekly_hours, min_rest_hours_between_shifts, overtime_threshold_weekly, max_consecutive_days, minor_max_daily_hours, minor_earliest_start, minor_latest_end, params, updated_at",
    )
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    logger.error("getLaborRules: query failed", { err: error, orgId });
  }
  if (!data) {
    return defaultLaborRules(orgId, new Date().toISOString());
  }
  return normalizeLaborRules(data as unknown as LaborRulesRow);
});

/**
 * Day 43 — whether the scheduling setup wizard has been completed for an org.
 * Drives the `/scheduling` ↔ `/scheduling/setup` redirect gate.
 */
export const getSchedulingStatus = cache(
  async (orgId: string): Promise<{ onboardedAt: string | null }> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("org_settings")
      .select("scheduling_onboarded_at")
      .eq("org_id", orgId)
      .maybeSingle();
    if (error) {
      logger.error("getSchedulingStatus: query failed", { err: error, orgId });
    }
    return { onboardedAt: (data?.scheduling_onboarded_at as string | null) ?? null };
  },
);

export type SchedulingSummary = {
  onboardedAt: string | null;
  employeeCount: number;
  openDays: number;
  preset: LaborRulePreset;
  persona: { tone: string; notes: string };
};

/**
 * Day 43 — read-only summary for the `/scheduling` landing page (counts + the
 * active preset/persona). All sources are member-readable via RLS.
 */
export const getSchedulingSummary = cache(async (orgId: string): Promise<SchedulingSummary> => {
  const supabase = await createClient();
  const [settingsRes, employeesRes, hoursRes, rules] = await Promise.all([
    supabase
      .from("org_settings")
      .select("scheduling_onboarded_at, agent_persona")
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("active", true),
    supabase.from("business_hours").select("is_closed").eq("org_id", orgId).eq("is_closed", false),
    getLaborRules(orgId),
  ]);

  const persona = (settingsRes.data?.agent_persona ?? {}) as {
    tone?: string;
    notes?: string;
  };
  return {
    onboardedAt: (settingsRes.data?.scheduling_onboarded_at as string | null) ?? null,
    employeeCount: employeesRes.count ?? 0,
    openDays: (hoursRes.data ?? []).length,
    preset: rules.preset,
    persona: { tone: persona.tone ?? "professional", notes: persona.notes ?? "" },
  };
});

/* ---------------------------------------------------------------------------
 * Day 44 — employee availability reads (manager surface).
 * ------------------------------------------------------------------------- */

export type PermanentRow = {
  id: string;
  day_of_week: number;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
};

export type TemporaryRow = {
  id: string;
  effective_date: string;
  end_date: string | null;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
};

export type EmployeeAvailability = {
  permanent: PermanentRow[];
  temporary: TemporaryRow[];
};

/**
 * Day 44 — one employee's availability, split into the permanent weekly grid and
 * the dated temporary overrides. Member-readable via RLS, so org-scoped without
 * an explicit org filter; we still pass `employeeId` (an employee belongs to one
 * org). `time` columns come back as `HH:MM:SS` strings.
 */
export const getEmployeeAvailability = cache(
  async (employeeId: string): Promise<EmployeeAvailability> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("availability")
      .select(
        "id, kind, day_of_week, effective_date, end_date, start_time, end_time, is_available, notes",
      )
      .eq("employee_id", employeeId)
      .order("day_of_week", { ascending: true })
      .order("effective_date", { ascending: true });

    if (error) {
      logger.error("getEmployeeAvailability: query failed", { err: error, employeeId });
    }

    const rows = (data ?? []) as Array<{
      id: string;
      kind: "permanent" | "temporary";
      day_of_week: number | null;
      effective_date: string | null;
      end_date: string | null;
      start_time: string | null;
      end_time: string | null;
      is_available: boolean;
      notes: string | null;
    }>;

    return {
      permanent: rows
        .filter((r) => r.kind === "permanent" && r.day_of_week !== null)
        .map((r) => ({
          id: r.id,
          day_of_week: r.day_of_week as number,
          is_available: r.is_available,
          start_time: r.start_time,
          end_time: r.end_time,
        })),
      temporary: rows
        .filter((r) => r.kind === "temporary" && r.effective_date !== null)
        .map((r) => ({
          id: r.id,
          effective_date: r.effective_date as string,
          end_date: r.end_date,
          is_available: r.is_available,
          start_time: r.start_time,
          end_time: r.end_time,
          notes: r.notes,
        })),
    };
  },
);

/* ---------------------------------------------------------------------------
 * Day 50 — schedule calendar reads (the draft + its shifts + edit-validation
 * context). All member-readable via the Day-41 RLS, so org-scoped without an
 * explicit filter where the id already pins the org.
 * ------------------------------------------------------------------------- */

export type DraftSchedule = {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "published" | "archived";
  optimizationSummary: string | null;
};

/** The shift shape the calendar UI renders + edits (camelCase, client-safe). */
export type CalendarShift = {
  id: string;
  employeeId: string | null;
  roleId: string | null;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  status: "draft" | "published" | "open" | "cancelled";
  locked: boolean;
  notes: string | null;
};

/**
 * The most recent draft schedule for an org, or null if none has been generated.
 * Day 50 edits the latest draft; Day 51 adds version/period selection + publish.
 */
export const getLatestDraftSchedule = cache(
  async (orgId: string): Promise<DraftSchedule | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("schedules")
      .select("id, name, period_start, period_end, status, optimization_summary")
      .eq("org_id", orgId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error("getLatestDraftSchedule: query failed", { err: error, orgId });
    }
    if (!data) return null;
    return {
      id: data.id as string,
      name: data.name as string,
      periodStart: data.period_start as string,
      periodEnd: data.period_end as string,
      status: data.status as DraftSchedule["status"],
      optimizationSummary: (data.optimization_summary as string | null) ?? null,
    };
  },
);

/** All shifts on a schedule, ordered chronologically. Member-readable via RLS. */
export const getScheduleShifts = cache(async (scheduleId: string): Promise<CalendarShift[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shifts")
    .select(
      "id, employee_id, role_certification_id, starts_at, ends_at, break_minutes, status, locked, notes",
    )
    .eq("schedule_id", scheduleId)
    .order("starts_at", { ascending: true });

  if (error) {
    logger.error("getScheduleShifts: query failed", { err: error, scheduleId });
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    employeeId: (r.employee_id as string | null) ?? null,
    roleId: (r.role_certification_id as string | null) ?? null,
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
    breakMinutes: Number(r.break_minutes ?? 0),
    status: r.status as CalendarShift["status"],
    locked: Boolean(r.locked),
    notes: (r.notes as string | null) ?? null,
  }));
});

export type RoleCertification = { id: string; name: string };

/** The org's role/certification catalog — labels + the add-shift role picker. */
export const getRoleCertifications = cache(async (orgId: string): Promise<RoleCertification[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles_certifications")
    .select("id, name")
    .eq("org_id", orgId)
    .order("name", { ascending: true });
  if (error) {
    logger.error("getRoleCertifications: query failed", { err: error, orgId });
  }
  return ((data ?? []) as Array<{ id: string; name: string }>).map((r) => ({
    id: r.id,
    name: r.name,
  }));
});

/**
 * Assemble the {@link ValidationContext} for live edit re-validation: each
 * employee's minor flag, valid role/cert ids, and resolved availability, plus the
 * org's labor ruleset. Reuses the Day-46 {@link buildSolverInput} (the same
 * RLS-scoped fetch + resolution) and drops the soft-objective fields the edit
 * checks don't need. Role-cert expiry is evaluated against the schedule period.
 */
export async function getScheduleValidationContext(
  orgId: string,
  periodStart: string,
  periodEnd: string,
): Promise<ValidationContext> {
  const supabase = await createClient();
  const input = await buildSolverInput(orgId, periodStart, periodEnd, supabase);
  return {
    laborRules: input.laborRules,
    employees: input.employees.map((e) => ({
      id: e.id,
      isMinor: e.isMinor,
      roleIds: e.roleIds,
      permanent: e.permanent,
      temporary: e.temporary,
    })),
  };
}
