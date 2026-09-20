import { ACTIVE_STATUSES, type SubscriptionStatus, type Tier } from "@/lib/billing/schemas";

export type AutomationSubscription = {
  status?: SubscriptionStatus | null;
  tier?: Tier | null;
} | null;

export const AUTOMATION_RUN_STALE_MS = 5 * 60 * 1000;

export type AutomationRunLease = {
  status?: string | null;
  started_at?: string | null;
};

/**
 * Durable workers have no user session, so automation entitlement must be
 * rechecked against the organization subscription at execution time.
 */
export function canExecuteAutomations(subscription: AutomationSubscription): boolean {
  return (
    subscription?.status !== undefined &&
    subscription.status !== null &&
    ACTIVE_STATUSES.includes(subscription.status) &&
    subscription.tier === "pro"
  );
}

/**
 * A failed run is retryable immediately. A running run is reclaimable only
 * after the durable-job worker's five-minute stale lease has elapsed, preventing
 * overlapping duplicate dispatch jobs from executing the same side effects.
 */
export function canReclaimAutomationRun(run: AutomationRunLease, now = Date.now()): boolean {
  if (run.status === "failed") return true;
  if (run.status !== "running" || !run.started_at) return false;

  const startedAt = Date.parse(run.started_at);
  return Number.isFinite(startedAt) && now - startedAt >= AUTOMATION_RUN_STALE_MS;
}
