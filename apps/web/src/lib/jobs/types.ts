export type JobStatus = "pending" | "running" | "succeeded" | "failed" | "dead";

export type JobType =
  | "noop"
  | "notification-send"
  | "availability-nudge"
  | "schedule-delivery"
  | "shift-reminder"
  | "replacement-offer-notify"
  | "replacement-offer-timeout"
  | "swap-proposal-notify"
  | "swap-result-notify"
  | "automation-dispatch";

export type Job = {
  id: string;
  type: string;
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

export type JobHandler = (job: Job) => Promise<void>;

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
