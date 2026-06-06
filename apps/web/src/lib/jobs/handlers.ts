import { logger } from "@/lib/observability/logger";

import type { Job, JobHandler } from "@/lib/jobs/types";
import { notificationSendHandler } from "@/lib/notifications/handler";
import { availabilityNudgeHandler } from "@/lib/scheduling/availability-nudge";

/**
 * Day 38 — the job handler registry. Maps a job `type` to the side effect that
 * runs it. Day 38 shipped the built-in `noop`; Day 40 adds `notification-send`
 * (email delivery for the notification system). More handlers (availability
 * nudge, shift reminder, replacement-offer timeout, escalation) register here as
 * their features land (Days 45/53/55).
 *
 * Handlers must be IDEMPOTENT — delivery is at-least-once (the reaper can re-run a
 * stalled job). Throw to signal failure (→ retry with backoff, then dead).
 *
 * NOTE: handlers registered here must be import-safe under Vitest (the jobs
 * harness imports this module), i.e. no `server-only` at module-eval time —
 * `notification-send` dynamically imports its server-only deps in the handler body.
 */

/** A do-nothing handler: proves the loop end-to-end and is the template for real ones. */
const noop: JobHandler = async (job: Job) => {
  logger.info("jobs.noop", { id: job.id, payload: job.payload });
};

const HANDLERS: Record<string, JobHandler> = {
  noop,
  "notification-send": notificationSendHandler,
  "availability-nudge": availabilityNudgeHandler,
};

/** The handler for a job type, or null if none is registered (→ treated as failure). */
export function getHandler(type: string): JobHandler | null {
  return HANDLERS[type] ?? null;
}
