import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getOrgContext, type UserOrg } from "@/lib/org/queries";
import { logger } from "@/lib/observability/logger";
import { summarizeHours, type HoursSummary } from "./hours";

/**
 * Day 37 — employee roster reads for the manager surface. Both the employees and
 * the portal-token rows are RLS-scoped (members read employees; owners/admins
 * read tokens), so this never leaks across orgs. `cache()` dedupes within a render.
 */

export type Employee = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  /** Whether a live (un-revoked) portal token exists — i.e. a link has been sent. */
  hasPortalAccess: boolean;
  /** When the live token was last used to open the portal, if ever. */
  lastUsedAt: string | null;
};

export type Roster = {
  activeOrg: UserOrg | null;
  /** The viewer's role — drives whether management controls show. */
  viewerRole: "owner" | "admin" | "member" | null;
  employees: Employee[];
};

type EmployeeRow = {
  id: string;
  name: string;
  email: string;
  active: boolean;
};

type TokenRow = {
  employee_id: string;
  last_used_at: string | null;
};

export const getRoster = cache(async (): Promise<Roster> => {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) {
    return { activeOrg: null, viewerRole: null, employees: [] };
  }

  const supabase = await createClient();
  const [employeesRes, tokensRes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, name, email, active")
      .eq("org_id", activeOrg.id)
      .order("created_at", { ascending: true }),
    // Live tokens only (revoked_at is null). Manager-readable via RLS; returns
    // nothing for a plain member, which is fine — they don't see the controls.
    supabase
      .from("employee_portal_tokens")
      .select("employee_id, last_used_at")
      .eq("org_id", activeOrg.id)
      .is("revoked_at", null),
  ]);

  if (employeesRes.error) {
    logger.error("getRoster: employees query failed", {
      err: employeesRes.error,
      orgId: activeOrg.id,
    });
  }
  if (tokensRes.error) {
    logger.error("getRoster: tokens query failed", {
      err: tokensRes.error,
      orgId: activeOrg.id,
    });
  }

  const liveTokens = new Map(
    ((tokensRes.data ?? []) as unknown as TokenRow[]).map((t) => [t.employee_id, t]),
  );

  const employees: Employee[] = ((employeesRes.data ?? []) as unknown as EmployeeRow[]).map((e) => {
    const token = liveTokens.get(e.id);
    return {
      id: e.id,
      name: e.name,
      email: e.email,
      active: e.active,
      hasPortalAccess: Boolean(token),
      lastUsedAt: token?.last_used_at ?? null,
    };
  });

  return { activeOrg, viewerRole: activeOrg.role, employees };
});

/* ---------------------------------------------------------------------------
 * Day 52 — employee profiles + roster management.
 * ------------------------------------------------------------------------- */

export type EmploymentType = "full_time" | "part_time" | "casual" | "contract";

export type ProfileRole = {
  /** employee_role_assignments.id — the row to remove. */
  assignmentId: string;
  roleCertificationId: string;
  name: string;
  kind: "role" | "certification";
  expiresAt: string | null;
};

export type EmployeeProfile = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  phone: string | null;
  employmentType: EmploymentType;
  seniorityRank: number | null;
  hireDate: string | null;
  isMinor: boolean;
  targetHoursWeekly: number | null;
  minHoursWeekly: number | null;
  maxHoursWeekly: number | null;
  performanceScore: number | null;
  notes: string | null;
  roles: ProfileRole[];
};

const num = (v: number | string | null): number | null =>
  v === null || v === undefined ? null : typeof v === "string" ? Number(v) : v;

/**
 * One employee's full scheduling profile (all Day-41 columns) + their role/cert
 * assignments joined to the catalog. RLS-scoped (member-read), so a foreign-org id
 * returns null. `cache()` dedupes within a render.
 */
export const getEmployeeProfile = cache(
  async (employeeId: string): Promise<EmployeeProfile | null> => {
    const supabase = await createClient();
    const [{ data: emp, error: empErr }, { data: roleRows, error: roleErr }] = await Promise.all([
      supabase
        .from("employees")
        .select(
          "id, name, email, active, phone, employment_type, seniority_rank, hire_date, is_minor, target_hours_weekly, min_hours_weekly, max_hours_weekly, performance_score, notes",
        )
        .eq("id", employeeId)
        .maybeSingle(),
      supabase
        .from("employee_role_assignments")
        .select("id, expires_at, role_certification_id, roles_certifications(name, kind)")
        .eq("employee_id", employeeId),
    ]);

    if (empErr)
      logger.error("getEmployeeProfile: employee query failed", { err: empErr, employeeId });
    if (roleErr)
      logger.error("getEmployeeProfile: roles query failed", { err: roleErr, employeeId });
    if (!emp) return null;

    type CatalogRef = { name: string; kind: "role" | "certification" };
    const roles: ProfileRole[] = (
      (roleRows ?? []) as unknown as Array<{
        id: string;
        expires_at: string | null;
        role_certification_id: string;
        roles_certifications: CatalogRef | CatalogRef[] | null;
      }>
    ).map((r) => {
      const rc = Array.isArray(r.roles_certifications)
        ? r.roles_certifications[0]
        : r.roles_certifications;
      return {
        assignmentId: r.id,
        roleCertificationId: r.role_certification_id,
        name: rc?.name ?? "(removed)",
        kind: rc?.kind ?? "role",
        expiresAt: r.expires_at,
      };
    });

    return {
      id: emp.id as string,
      name: emp.name as string,
      email: emp.email as string,
      active: Boolean(emp.active),
      phone: (emp.phone as string | null) ?? null,
      employmentType: (emp.employment_type as EmploymentType) ?? "part_time",
      seniorityRank: num(emp.seniority_rank as number | string | null),
      hireDate: (emp.hire_date as string | null) ?? null,
      isMinor: Boolean(emp.is_minor),
      targetHoursWeekly: num(emp.target_hours_weekly as number | string | null),
      minHoursWeekly: num(emp.min_hours_weekly as number | string | null),
      maxHoursWeekly: num(emp.max_hours_weekly as number | string | null),
      performanceScore: num(emp.performance_score as number | string | null),
      notes: (emp.notes as string | null) ?? null,
      roles,
    };
  },
);

/**
 * Net PUBLISHED hours an employee has worked since `sinceISO` (default ~28 days
 * back). Pure aggregation in {@link summarizeHours}; this is the RLS-scoped fetch.
 */
export const getEmployeeHours = cache(
  async (employeeId: string, sinceISO?: string): Promise<HoursSummary> => {
    const since = sinceISO ?? new Date(Date.now() - 28 * 86_400_000).toISOString();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("shifts")
      .select("starts_at, ends_at, break_minutes")
      .eq("employee_id", employeeId)
      .eq("status", "published")
      .gte("starts_at", since)
      .order("starts_at", { ascending: true });
    if (error) logger.error("getEmployeeHours: query failed", { err: error, employeeId });
    return summarizeHours(
      ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        startsAt: r.starts_at as string,
        endsAt: r.ends_at as string,
        breakMinutes: Number(r.break_minutes ?? 0),
      })),
    );
  },
);

export type TimeOffRow = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: "pending" | "approved" | "denied" | "cancelled";
  createdAt: string;
};
export type SickCallRow = {
  id: string;
  reportedAt: string;
  status: "open" | "filling" | "resolved" | "escalated";
  notes: string | null;
};
export type SwapRow = {
  id: string;
  status: "pending" | "accepted" | "approved" | "denied" | "cancelled";
  createdAt: string;
};
export type AttendanceHistory = {
  timeOff: TimeOffRow[];
  sickCalls: SickCallRow[];
  swaps: SwapRow[];
};

/**
 * Read-only attendance history for an employee — time-off, sick-calls, and swap
 * requests (newest first, capped). The tables exist (Day 41) but stay empty until
 * the Day 54-57 portal workflows write them; member-readable via RLS.
 */
export const getEmployeeAttendance = cache(
  async (employeeId: string, limit = 20): Promise<AttendanceHistory> => {
    const supabase = await createClient();
    const [timeOffRes, sickRes, swapRes] = await Promise.all([
      supabase
        .from("time_off_requests")
        .select("id, start_date, end_date, reason, status, created_at")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("sick_call_events")
        .select("id, reported_at, status, notes")
        .eq("employee_id", employeeId)
        .order("reported_at", { ascending: false })
        .limit(limit),
      supabase
        .from("shift_swap_requests")
        .select("id, status, created_at")
        .eq("requesting_employee_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

    return {
      timeOff: ((timeOffRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: r.id as string,
        startDate: r.start_date as string,
        endDate: r.end_date as string,
        reason: (r.reason as string | null) ?? null,
        status: r.status as TimeOffRow["status"],
        createdAt: r.created_at as string,
      })),
      sickCalls: ((sickRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: r.id as string,
        reportedAt: r.reported_at as string,
        status: r.status as SickCallRow["status"],
        notes: (r.notes as string | null) ?? null,
      })),
      swaps: ((swapRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: r.id as string,
        status: r.status as SwapRow["status"],
        createdAt: r.created_at as string,
      })),
    };
  },
);
