/**
 * Day 38 — durable job runtime types. Pure (no `server-only`) so the runner +
 * handlers stay importable by the Vitest harness, which injects its own
 * service-role client (mirrors lib/billing/webhook).
 */

export type JobStatus = "pending" | "running" | "succeeded" | "failed" | "dead";

/** Known job types. New handlers add their type here as their feature lands. */
export type JobType =
  | "noop"
  | "notification-send"
  | "availability-nudge"
  | "schedule-delivery"
  | "shift-reminder";

/** A claimed job, mapped from the DB row to camelCase for handlers. */
export type Job = {
  id: string;
  type: string; // DB column is free text; dispatch narrows to a known JobType
  payload: Record<string, unknown>;
  status: JobStatus;
  runAt: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  lockedAt: string | null;
  orgId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A job handler runs the side effect for one job. Throw to fail (→ retry/dead). */
export type JobHandler = (job: Job) => Promise<void>;

/** The raw PostgREST row shape (snake_case) returned by claim_due_jobs. */
export type JobRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  run_at: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  locked_at: string | null;
  org_id: string | null;
  created_at: string;
  updated_at: string;
};

export function mapJob(row: JobRow): Job {
  return {
    id: row.id,
    type: row.type,
    payload: row.payload ?? {},
    status: row.status,
    runAt: row.run_at,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    lastError: row.last_error,
    lockedAt: row.locked_at,
    orgId: row.org_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
