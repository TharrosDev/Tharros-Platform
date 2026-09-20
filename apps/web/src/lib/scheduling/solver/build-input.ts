import "server-only";

/**
 * Day 46 — fetch an org's scheduling data and assemble it into a SolverInput.
 *
 * The thin DB layer over the pure {@link assembleSolverInput}. Reads are
 * member-scoped via RLS (the same posture as lib/scheduling/queries), so callers
 * pass the user-session Supabase client; nothing here writes. `getLaborRules`
 * brings its own request-cached client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/observability/logger";

import { getLaborRules } from "../queries";
import { assembleSolverInput } from "./assemble-input";
import type {
  RawAvailability,
  RawBusinessHours,
  RawEmployee,
  RawRoleAssignment,
  RawStaffing,
} from "./assemble-input";
import type { SolverInput, SolverWeights } from "./types";

export async function buildSolverInput(
  orgId: string,
  periodStart: string,
  periodEnd: string,
  supabase: SupabaseClient,
  weights?: SolverWeights,
): Promise<SolverInput> {
  const [employeesRes, rolesRes, availabilityRes, hoursRes, staffingRes, laborRules] =
    await Promise.all([
      supabase
        .from("employees")
        .select(
          "id, is_minor, employment_type, seniority_rank, target_hours_weekly, min_hours_weekly, max_hours_weekly, performance_score",
        )
        .eq("org_id", orgId)
        .eq("active", true),
      supabase
        .from("employee_role_assignments")
        .select("employee_id, role_certification_id, expires_at")
        .eq("org_id", orgId),
      supabase
        .from("availability")
        .select(
          "employee_id, kind, day_of_week, effective_date, end_date, start_time, end_time, is_available",
        )
        .eq("org_id", orgId),
      supabase
        .from("business_hours")
        .select("day_of_week, opens_at, closes_at, is_closed")
        .eq("org_id", orgId),
      supabase
        .from("staffing_requirements")
        .select(
          "id, role_certification_id, day_of_week, specific_date, start_time, end_time, min_staff",
        )
        .eq("org_id", orgId),
      getLaborRules(orgId),
    ]);

  for (const [label, res] of [
    ["employees", employeesRes],
    ["employee_role_assignments", rolesRes],
    ["availability", availabilityRes],
    ["business_hours", hoursRes],
    ["staffing_requirements", staffingRes],
  ] as const) {
    if (res.error)
      logger.error(`buildSolverInput: ${label} query failed`, { err: res.error, orgId });
  }

  return assembleSolverInput({
    periodStart,
    periodEnd,
    employees: (employeesRes.data ?? []) as RawEmployee[],
    roleAssignments: (rolesRes.data ?? []) as RawRoleAssignment[],
    availability: (availabilityRes.data ?? []) as RawAvailability[],
    businessHours: (hoursRes.data ?? []) as RawBusinessHours[],
    staffing: (staffingRes.data ?? []) as RawStaffing[],
    laborRules,
    weights,
  });
}
