import type { SupabaseClient } from "@supabase/supabase-js";

import type { JobType } from "@/lib/jobs/types";

/**
 * Day 38 — enqueue a durable job. Takes the service-role client as a parameter
 * (DI) so this stays importable by the Vitest harness; app callers pass
 * `createAdminClient()` (the deny-all `jobs` table's only writer), exactly like
 * the Day-18 webhook writer.
 */

export type EnqueueJobInput = {
  type: JobType;
  payload?: Record<string, unknown>;
  /** When the job becomes due. Defaults to now (run on the next tick). */
  runAt?: Date | string;
  /** Retry budget before the job goes `dead`. Defaults to the column default (5). */
  maxAttempts?: number;
  /** Org the job belongs to; null/omitted = a platform-wide job. */
  orgId?: string | null;
};

/** Insert a pending job. Returns the new job id. */
export async function enqueueJob(
  admin: SupabaseClient,
  input: EnqueueJobInput,
): Promise<string> {
  const row: Record<string, unknown> = {
    type: input.type,
    payload: input.payload ?? {},
  };
  if (input.runAt !== undefined) {
    row.run_at = input.runAt instanceof Date ? input.runAt.toISOString() : input.runAt;
  }
  if (input.maxAttempts !== undefined) row.max_attempts = input.maxAttempts;
  if (input.orgId !== undefined) row.org_id = input.orgId;

  const { data, error } = await admin.from("jobs").insert(row).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}
