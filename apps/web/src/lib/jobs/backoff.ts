/**
 * Day 38 — retry backoff schedule (pure, unit-tested). Exponential from a 1-minute
 * base, capped at 1 hour, keyed on the number of attempts already made.
 */

const BASE_SECONDS = 60;
const MAX_SECONDS = 3600;

/** Delay before the next retry after `attempts` failed tries (attempts >= 1). */
export function backoffSeconds(attempts: number): number {
  const n = Math.max(attempts - 1, 0);
  return Math.min(BASE_SECONDS * 2 ** n, MAX_SECONDS);
}

/** ISO timestamp for the next retry, `backoffSeconds` after `from`. */
export function nextRunAt(attempts: number, from: Date = new Date()): string {
  return new Date(from.getTime() + backoffSeconds(attempts) * 1000).toISOString();
}
