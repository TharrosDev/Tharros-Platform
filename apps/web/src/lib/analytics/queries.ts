import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import {
  dailyAssignedHours,
  deriveEmployeeAnalytics,
  deriveOrgAnalytics,
  type DailyHours,
  type EmployeeAnalytics,
  type EmployeeRaw,
  type OrgAnalytics,
  type OverviewRaw,
  type ShiftHoursRow,
} from "@/lib/analytics/metrics";

/**
 * Day 59 — scheduling-analytics reads. Both RPCs are member-readable SECURITY
 * DEFINER (Day-33 pattern) and self-enforce org membership via
 * current_user_orgs(), so these call them through the RLS user-session client
 * with the active org id. The raw aggregates are turned into derived scores by
 * the pure metrics module.
 */

/** Allowed trailing windows (days). Anything else is clamped to the default. */
export const ANALYTICS_WINDOWS = [7, 30, 90] as const;
export type AnalyticsWindow = (typeof ANALYTICS_WINDOWS)[number];
export const DEFAULT_WINDOW: AnalyticsWindow = 30;

/** Coerce an untrusted `?days=` value to one of the allowed windows. */
export function resolveWindow(value: string | number | undefined): AnalyticsWindow {
  const n = typeof value === "string" ? Number(value) : value;
  return (ANALYTICS_WINDOWS as readonly number[]).includes(n as number)
    ? (n as AnalyticsWindow)
    : DEFAULT_WINDOW;
}

const ZERO_OVERVIEW: OverviewRaw = {
  assigned_shifts: 0,
  open_shifts: 0,
  assigned_hours: 0,
  open_hours: 0,
  sick_calls: 0,
  offers: 0,
  offers_accepted: 0,
  swaps: 0,
  time_off: 0,
};

export async function getOrgAnalytics(orgId: string, days: number): Promise<OrgAnalytics> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("scheduling_analytics_overview", { p_org: orgId, p_days: days })
    .single();

  if (error) {
    logger.error("analytics.overview_failed", { org_id: orgId, error: error.message });
    return deriveOrgAnalytics(ZERO_OVERVIEW);
  }
  return deriveOrgAnalytics((data as OverviewRaw) ?? ZERO_OVERVIEW);
}

/**
 * Net staffed hours per day over the trailing window, for the trend strip.
 * Reads the member-readable `shifts` table directly (same RLS the calendar
 * relies on) and derives in pure TS — no new RPC or schema.
 */
export async function getDailyStaffedHours(orgId: string, days: number): Promise<DailyHours[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .from("shifts")
    .select("starts_at, ends_at, employee_id, break_minutes")
    .eq("org_id", orgId)
    .gte("starts_at", `${from}T00:00:00Z`)
    .lt("starts_at", `${today}T23:59:59Z`);

  if (error) {
    logger.error("analytics.daily_hours_failed", { org_id: orgId, error: error.message });
    return [];
  }
  return dailyAssignedHours((data ?? []) as ShiftHoursRow[], today, days);
}

export async function getEmployeeAnalytics(
  orgId: string,
  days: number,
): Promise<EmployeeAnalytics[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("scheduling_analytics_by_employee", {
    p_org: orgId,
    p_days: days,
  });

  if (error) {
    logger.error("analytics.by_employee_failed", { org_id: orgId, error: error.message });
    return [];
  }
  return ((data ?? []) as EmployeeRaw[]).map(deriveEmployeeAnalytics);
}
