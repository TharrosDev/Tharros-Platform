import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";

import { defaultLaborRules } from "./presets";
import type { LaborRulePreset, LaborRules } from "./types";

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
