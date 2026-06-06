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
