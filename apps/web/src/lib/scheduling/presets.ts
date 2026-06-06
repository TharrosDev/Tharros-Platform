/**
 * Day 42 — Labor-rule presets + defaults.
 *
 * These are *starting points* a manager can adopt and then tune — NOT a
 * jurisdiction-compliance guarantee. The engine treats every value as a plain
 * configurable constraint; the law is the user's responsibility.
 */

import type { LaborRuleParams, LaborRulePreset, LaborRules } from "./types";

/**
 * Shown anywhere a preset is offered or a ruleset is edited. Surfaced by the
 * Day-43 onboarding wizard.
 */
export const LABOR_RULE_DISCLAIMER =
  "These labor-rule presets are configurable starting points, not legal advice. " +
  "Employment standards vary by jurisdiction and change over time — confirm the " +
  "values with your own counsel or the relevant labour authority before relying on them.";

/**
 * Preset values. Loosely modeled on Ontario's ESA and the Canada Labour Code
 * (federal), kept conservative and round. Tune freely — the engine doesn't care
 * where the numbers came from.
 *
 * - Ontario: daily rest 11h (ESA), OT after 44h/wk, max 8h/day absent an agreement.
 * - Federal: standard 8h/day & 40h/wk with OT past 40, 8h rest as a baseline.
 * Minor windows are a school-age guardrail (06:00–23:00), not a statutory citation.
 */
export const LABOR_RULE_PRESETS: Record<Exclude<LaborRulePreset, "custom">, LaborRuleParams> = {
  ontario: {
    max_daily_hours: 8,
    max_weekly_hours: 48,
    min_rest_hours_between_shifts: 11,
    overtime_threshold_weekly: 44,
    max_consecutive_days: 6,
    minor_max_daily_hours: 8,
    minor_earliest_start: "06:00",
    minor_latest_end: "23:00",
  },
  canada_federal: {
    max_daily_hours: 8,
    max_weekly_hours: 48,
    min_rest_hours_between_shifts: 8,
    overtime_threshold_weekly: 40,
    max_consecutive_days: 6,
    minor_max_daily_hours: 8,
    minor_earliest_start: "06:00",
    minor_latest_end: "23:00",
  },
};

/**
 * Fallback ruleset when an org has no `labor_rules` row yet. Mirrors the Day-41
 * migration column defaults (the permissive `custom` baseline) so the engine
 * always has a usable ruleset to validate against.
 */
export const DEFAULT_LABOR_RULE_PARAMS: LaborRuleParams = {
  max_daily_hours: 12,
  max_weekly_hours: 48,
  min_rest_hours_between_shifts: 8,
  overtime_threshold_weekly: 44,
  max_consecutive_days: 6,
  minor_max_daily_hours: null,
  minor_earliest_start: null,
  minor_latest_end: null,
};

/** Build a full default ruleset for an org with no stored row. */
export function defaultLaborRules(orgId: string, updatedAt: string): LaborRules {
  return {
    org_id: orgId,
    preset: "custom",
    ...DEFAULT_LABOR_RULE_PARAMS,
    params: {},
    updated_at: updatedAt,
  };
}
