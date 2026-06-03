/**
 * Day 33 — pure usage/cap math. No `server-only`, no I/O, so the cap decision
 * and the billing-period boundary can be unit-tested directly (and imported by
 * both the server metering lib and the dashboard).
 */

/** Fraction of the cap at or above which we warn the user they're running low. */
export const NEAR_LIMIT_THRESHOLD = 0.8;

export type CapDecision = {
  /** Whether another query is allowed (used < cap). */
  allowed: boolean;
  /** Queries used this period. */
  used: number;
  /** The period cap for the org's tier. */
  cap: number;
  /** True once usage reaches NEAR_LIMIT_THRESHOLD of the cap (even if allowed). */
  nearLimit: boolean;
};

/**
 * Decide whether an org may run another query given its usage and cap. Hard
 * block at the cap (`used >= cap` → not allowed) per the Day-33 decision. A
 * non-positive cap blocks everything (treat as "no plan / no allowance").
 */
export function capDecision(used: number, cap: number): CapDecision {
  const allowed = cap > 0 && used < cap;
  const nearLimit = cap > 0 && used / cap >= NEAR_LIMIT_THRESHOLD;
  return { allowed, used, cap, nearLimit };
}

/**
 * The start of the current billing period: the first instant of the current
 * calendar month in UTC. Matches the `date_trunc('month', now() at time zone
 * 'utc')` window used by the `ai_usage_summary` RPC so the count the cap reads
 * and the count the dashboard shows always agree.
 */
export function currentUsagePeriodStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
