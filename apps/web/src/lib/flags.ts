import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";

/**
 * Feature flags — minimal global V1 (Day 7). Server-side only.
 *
 * Flags gate in-progress features. There is no org model yet (Phase 1), so these
 * are global on/off switches backed by `public.feature_flags`. Read them in
 * Server Components / Route Handlers via `isEnabled("leads")`.
 *
 * Resilience: if the table doesn't exist yet (migration not applied) or the read
 * fails, every flag reports OFF — the safe default for gating unfinished work —
 * and we log it once rather than throwing. The app must boot before the schema
 * does.
 *
 * Caching: `cache()` dedupes the fetch to a single query per request (React
 * request memoization), so reading many flags in one render hits the DB once.
 */

/** The known flag keys. Keep in sync with the seed in the Day 7 migration. */
export type FeatureFlag = "assistant" | "leads" | "automations";

const ALL_OFF: Record<FeatureFlag, boolean> = {
  assistant: false,
  leads: false,
  automations: false,
};

/** Fetch every flag once per request. */
const loadFlags = cache(async (): Promise<Record<string, boolean>> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("feature_flags")
      .select("key, enabled");

    if (error) {
      logger.warn("Feature flags unreadable; defaulting all OFF", {
        code: error.code,
        msg: error.message,
      });
      return {};
    }

    return Object.fromEntries(data.map((row) => [row.key, row.enabled]));
  } catch (err) {
    logger.error("Feature flags load threw; defaulting all OFF", { err });
    return {};
  }
});

/** Is this flag on? Unknown/unset keys are OFF. */
export async function isEnabled(flag: FeatureFlag): Promise<boolean> {
  const flags = await loadFlags();
  return flags[flag] ?? ALL_OFF[flag];
}

/** All known flags as a resolved map (handy for passing to client components). */
export async function getFlags(): Promise<Record<FeatureFlag, boolean>> {
  const flags = await loadFlags();
  return {
    assistant: flags.assistant ?? false,
    leads: flags.leads ?? false,
    automations: flags.automations ?? false,
  };
}
