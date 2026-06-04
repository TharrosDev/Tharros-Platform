import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/observability/logger";

import { getHandler } from "@/lib/jobs/handlers";
import { nextRunAt } from "@/lib/jobs/backoff";
import { mapJob, type Job, type JobRow } from "@/lib/jobs/types";

/**
 * Day 38 — the worker. Reaps stalled jobs, atomically claims a batch of due jobs,
 * and dispatches each to its handler. Takes the service-role client as a parameter
 * (DI) so it's importable by the Vitest harness; the cron route passes
 * `createAdminClient()`. The claim is the only contended step (DB-locked via
 * claim_due_jobs); completion/failure are plain updates because the worker owns
 * the claimed row (status already `running`).
 */

export type RunSummary = {
  reaped: number;
  claimed: number;
  succeeded: number;
  failed: number; // failures that will retry
  dead: number; // failures that exhausted max_attempts
};

const DEFAULT_LIMIT = 25;

export async function runDueJobs(
  admin: SupabaseClient,
  opts: { limit?: number } = {},
): Promise<RunSummary> {
  const summary: RunSummary = { reaped: 0, claimed: 0, succeeded: 0, failed: 0, dead: 0 };

  // 1) Recover crashed/timed-out workers before claiming more.
  const { data: reaped, error: reapErr } = await admin.rpc("reap_stuck_jobs");
  if (reapErr) {
    logger.error("jobs.reap_failed", { err: reapErr });
  } else {
    summary.reaped = typeof reaped === "number" ? reaped : 0;
  }

  // 2) Atomically claim a batch (FOR UPDATE SKIP LOCKED inside the RPC).
  const { data, error } = await admin.rpc("claim_due_jobs", {
    p_limit: opts.limit ?? DEFAULT_LIMIT,
  });
  if (error) {
    logger.error("jobs.claim_failed", { err: error });
    return summary;
  }

  const jobs = ((data ?? []) as JobRow[]).map(mapJob);
  summary.claimed = jobs.length;

  // 3) Dispatch each. One failure never aborts the batch.
  for (const job of jobs) {
    try {
      const handler = getHandler(job.type);
      if (!handler) throw new Error(`No handler registered for job type "${job.type}"`);
      await handler(job);
      await markSucceeded(admin, job.id);
      summary.succeeded += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      const outcome = await markFailed(admin, job, message);
      if (outcome === "dead") summary.dead += 1;
      else summary.failed += 1;
      logger.error("jobs.handler_failed", { id: job.id, type: job.type, err: message, outcome });
    }
  }

  return summary;
}

async function markSucceeded(admin: SupabaseClient, id: string): Promise<void> {
  await admin
    .from("jobs")
    .update({ status: "succeeded", locked_at: null, last_error: null })
    .eq("id", id);
}

/** Retry with backoff if attempts remain, else mark dead. Returns which happened. */
async function markFailed(
  admin: SupabaseClient,
  job: Job,
  message: string,
): Promise<"retry" | "dead"> {
  // `job.attempts` already counts the attempt just made (claim_due_jobs incremented it).
  const exhausted = job.attempts >= job.maxAttempts;
  if (exhausted) {
    await admin
      .from("jobs")
      .update({ status: "dead", locked_at: null, last_error: message })
      .eq("id", job.id);
    return "dead";
  }
  await admin
    .from("jobs")
    .update({
      status: "pending",
      run_at: nextRunAt(job.attempts),
      locked_at: null,
      last_error: message,
    })
    .eq("id", job.id);
  return "retry";
}
