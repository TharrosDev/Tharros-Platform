import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEscalatedReplacements, getEscalatedSwaps } from "@/lib/scheduling/queries";
import { getPendingTimeOff } from "@/lib/scheduling/time-off";

/**
 * Manager-facing count of scheduling decisions waiting on a person: escalated
 * swaps, pending time off and escalated replacements. Callers must only use it
 * for owners/admins of `orgId` (it reads time off with the admin client).
 */
export async function countPendingApprovals(orgId: string): Promise<number> {
  const [swaps, timeOff, replacements] = await Promise.all([
    getEscalatedSwaps(orgId),
    getPendingTimeOff(createAdminClient(), orgId),
    getEscalatedReplacements(orgId),
  ]);
  return swaps.length + timeOff.filter((t) => t.status === "pending").length + replacements.length;
}
