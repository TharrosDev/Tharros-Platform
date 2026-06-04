import { logger } from "@/lib/observability/logger";

import type { Job, JobHandler } from "@/lib/jobs/types";

/**
 * Day 38 — the job handler registry. Maps a job `type` to the side effect that
 * runs it. Day 38 ships only the built-in `noop` so the runtime is exercisable;
 * real handlers (availability nudge, shift reminder, replacement-offer timeout,
 * escalation) register here as their features land (Days 40/45/53/55).
 *
 * Handlers must be IDEMPOTENT — delivery is at-least-once (the reaper can re-run a
 * stalled job). Throw to signal failure (→ retry with backoff, then dead).
 */

/** A do-nothing handler: proves the loop end-to-end and is the template for real ones. */
const noop: JobHandler = async (job: Job) => {
  logger.info("jobs.noop", { id: job.id, payload: job.payload });
};

const HANDLERS: Record<string, JobHandler> = {
  noop,
};

/** The handler for a job type, or null if none is registered (→ treated as failure). */
export function getHandler(type: string): JobHandler | null {
  return HANDLERS[type] ?? null;
}
