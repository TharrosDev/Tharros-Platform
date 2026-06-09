import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import {
  DAYS,
  blankEmployee,
  type EmployeeRow,
  type HoursRow,
  type StaffingRow,
  type ToneValue,
  type WizardState,
} from "@/components/scheduling/setup/model";

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

/**
 * Bugfix — load the saved scheduling setup back into the wizard's state shape so
 * the onboarding wizard can be reopened to EDIT (it otherwise always started from
 * blank defaults, which would clobber real hours/staffing/persona on save). This
 * mirrors the simplified picture the wizard authors (one role per employee, one
 * staffing requirement per day); the `complete_scheduling_setup` RPC is
 * idempotent, so re-saving this state updates in place. Member-readable via RLS.
 */
export async function getSchedulingSetup(orgId: string): Promise<WizardState> {
  const supabase = await createClient();
  const [settingsRes, employeesRes, hoursRes, staffingRes, rules] = await Promise.all([
    supabase.from("org_settings").select("agent_persona").eq("org_id", orgId).maybeSingle(),
    supabase
      .from("employees")
      .select(
        "name, email, employment_type, is_minor, target_hours_weekly, employee_role_assignments(roles_certifications(name))",
      )
      .eq("org_id", orgId)
      .eq("active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("business_hours")
      .select("day_of_week, opens_at, closes_at, is_closed")
      .eq("org_id", orgId),
    supabase
      .from("staffing_requirements")
      .select("day_of_week, min_staff, roles_certifications(name)")
      .eq("org_id", orgId)
      .eq("source", "manual"),
    getLaborRules(orgId),
  ]);

  const persona = (settingsRes.data?.agent_persona ?? {}) as { tone?: string; notes?: string };

  // PostgREST nested embeds come back as either an object or a 1-element array
  // depending on inferred cardinality; normalize to the first name (mirrors the
  // Day-52 getEmployeeProfile pattern).
  type RoleRef = { name: string } | { name: string }[] | null | undefined;
  const roleNameOf = (rc: RoleRef): string => (Array.isArray(rc) ? rc[0]?.name : rc?.name) ?? "";

  const empRows = (employeesRes.data ?? []) as unknown as Array<{
    name: string | null;
    email: string | null;
    employment_type: string | null;
    is_minor: boolean | null;
    target_hours_weekly: number | string | null;
    employee_role_assignments: Array<{ roles_certifications: RoleRef }> | null;
  }>;
  const employees: EmployeeRow[] = empRows.map((e, i) => ({
    key: `emp-${i}`,
    name: e.name ?? "",
    email: e.email ?? "",
    employment_type: (e.employment_type as EmployeeRow["employment_type"]) ?? "part_time",
    role: roleNameOf(e.employee_role_assignments?.[0]?.roles_certifications),
    is_minor: e.is_minor ?? false,
    target_hours_weekly: e.target_hours_weekly == null ? "" : String(e.target_hours_weekly),
  }));

  const hoursByDay = new Map(
    (
      (hoursRes.data ?? []) as Array<{
        day_of_week: number;
        opens_at: string | null;
        closes_at: string | null;
        is_closed: boolean;
      }>
    ).map((h) => [h.day_of_week, h]),
  );
  const hours: HoursRow[] = DAYS.map((d) => {
    const row = hoursByDay.get(d.value);
    return {
      day_of_week: d.value,
      opens_at: (row?.opens_at ?? "09:00").slice(0, 5),
      closes_at: (row?.closes_at ?? "17:00").slice(0, 5),
      is_closed: row ? row.is_closed : d.value === 0 || d.value === 6,
    };
  });

  // One staffing row per day (the wizard's model); first manual requirement wins.
  const staffByDay = new Map<number, { min_staff: number | string; role: string }>();
  for (const s of (staffingRes.data ?? []) as unknown as Array<{
    day_of_week: number;
    min_staff: number | string;
    roles_certifications: RoleRef;
  }>) {
    if (!staffByDay.has(s.day_of_week)) {
      staffByDay.set(s.day_of_week, {
        min_staff: s.min_staff,
        role: roleNameOf(s.roles_certifications),
      });
    }
  }
  const staffing: Record<number, StaffingRow> = {};
  for (const d of DAYS) {
    const row = staffByDay.get(d.value);
    staffing[d.value] = {
      day_of_week: d.value,
      min_staff: row ? String(row.min_staff) : "1",
      role: row?.role ?? "",
    };
  }

  return {
    employees: employees.length > 0 ? employees : [blankEmployee()],
    hours,
    staffing,
    preset: rules.preset,
    tone: (persona.tone as ToneValue) ?? "professional",
    personaNotes: persona.notes ?? "",
  };
}

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
  publishedAt: string | null;
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
 * The most recent schedule for an org (any status), or null if none exists. Day 50
 * edited only the latest draft; Day 51 publishes + reopens, so the calendar must
 * keep showing a schedule after it's published (the old draft-only filter hid it).
 */
export const getLatestSchedule = cache(async (orgId: string): Promise<DraftSchedule | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedules")
    .select("id, name, period_start, period_end, status, published_at, optimization_summary")
    .eq("org_id", orgId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error("getLatestSchedule: query failed", { err: error, orgId });
  }
  if (!data) return null;
  return {
    id: data.id as string,
    name: data.name as string,
    periodStart: data.period_start as string,
    periodEnd: data.period_end as string,
    status: data.status as DraftSchedule["status"],
    publishedAt: (data.published_at as string | null) ?? null,
    optimizationSummary: (data.optimization_summary as string | null) ?? null,
  };
});

/** How many published snapshots a schedule already has — for the next `v{n}` label. */
export const getPublishedVersionCount = cache(async (scheduleId: string): Promise<number> => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("schedule_versions")
    .select("id", { count: "exact", head: true })
    .eq("schedule_id", scheduleId)
    .eq("source", "published");
  if (error) {
    logger.error("getPublishedVersionCount: query failed", { err: error, scheduleId });
  }
  return count ?? 0;
});

export type AuditEntry = {
  id: string;
  actorType: "manager" | "employee" | "agent" | "system";
  action: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

/**
 * The change history for a schedule — `scheduling_audit_log` rows for the schedule
 * itself OR any of its shifts (shift events carry `schedule_id` in `detail`).
 * Member-readable via RLS, newest first.
 */
export const getScheduleAuditTrail = cache(
  async (scheduleId: string, limit = 100): Promise<AuditEntry[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("scheduling_audit_log")
      .select("id, actor_type, action, detail, created_at")
      .or(`entity_id.eq.${scheduleId},detail->>schedule_id.eq.${scheduleId}`)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      logger.error("getScheduleAuditTrail: query failed", { err: error, scheduleId });
    }
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      actorType: r.actor_type as AuditEntry["actorType"],
      action: r.action as string,
      detail: (r.detail as Record<string, unknown>) ?? {},
      createdAt: r.created_at as string,
    }));
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

/** A swap escalated to the manager for approval (Day 56). */
export type EscalatedSwap = {
  requestId: string;
  requesterName: string;
  claimantName: string;
  shiftLabel: string;
  tradeForLabel: string | null;
  createdAt: string;
};

/** "Mon Jun 15, 9:00 AM – 5:00 PM" from local-as-UTC ISO strings (UTC accessors). */
function swapShiftLabel(startsAt: string, endsAt: string): string {
  const fmtDay = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const fmtTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${fmtDay.format(new Date(Date.parse(startsAt)))}, ${fmtTime.format(new Date(Date.parse(startsAt)))} – ${fmtTime.format(new Date(Date.parse(endsAt)))}`;
}

/** Swaps awaiting manager approval (status 'accepted'). Member-readable via RLS. */
export async function getEscalatedSwaps(orgId: string): Promise<EscalatedSwap[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shift_swap_requests")
    .select("id, shift_id, requesting_employee_id, target_employee_id, target_shift_id, created_at")
    .eq("org_id", orgId)
    .eq("status", "accepted")
    .order("created_at", { ascending: true });
  if (error) {
    logger.error("getEscalatedSwaps: query failed", { err: error, orgId });
    return [];
  }
  const rows = (data ?? []) as Array<{
    id: string;
    shift_id: string;
    requesting_employee_id: string;
    target_employee_id: string | null;
    target_shift_id: string | null;
    created_at: string;
  }>;
  if (rows.length === 0) return [];

  const shiftIds = [
    ...new Set(
      rows.flatMap((r) => [r.shift_id, r.target_shift_id]).filter((v): v is string => !!v),
    ),
  ];
  const empIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.requesting_employee_id, r.target_employee_id])
        .filter((v): v is string => !!v),
    ),
  ];
  const [{ data: shiftRows }, { data: empRows }] = await Promise.all([
    supabase.from("shifts").select("id, starts_at, ends_at").eq("org_id", orgId).in("id", shiftIds),
    supabase.from("employees").select("id, name").eq("org_id", orgId).in("id", empIds),
  ]);
  const shiftById = new Map(
    ((shiftRows ?? []) as Array<{ id: string; starts_at: string; ends_at: string }>).map((s) => [
      s.id,
      s,
    ]),
  );
  const nameById = new Map(
    ((empRows ?? []) as Array<{ id: string; name: string }>).map((e) => [e.id, e.name]),
  );

  return rows.map((r) => {
    const x = shiftById.get(r.shift_id);
    const y = r.target_shift_id ? shiftById.get(r.target_shift_id) : null;
    return {
      requestId: r.id,
      requesterName: nameById.get(r.requesting_employee_id) ?? "An employee",
      claimantName: r.target_employee_id
        ? (nameById.get(r.target_employee_id) ?? "A coworker")
        : "A coworker",
      shiftLabel: x ? swapShiftLabel(x.starts_at, x.ends_at) : "a shift",
      tradeForLabel: y ? swapShiftLabel(y.starts_at, y.ends_at) : null,
      createdAt: r.created_at,
    };
  });
}
