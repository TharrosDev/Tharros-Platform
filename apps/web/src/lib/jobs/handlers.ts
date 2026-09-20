import { logger } from "@/lib/observability/logger";

import type { Job, JobHandler } from "@/lib/jobs/types";
import { notificationSendHandler } from "@/lib/notifications/handler";
import { availabilityNudgeHandler } from "@/lib/scheduling/availability-nudge";
import { scheduleDeliveryHandler, shiftReminderHandler } from "@/lib/scheduling/delivery-handler";
import {
  replacementOfferNotifyHandler,
  replacementTimeoutHandler,
} from "@/lib/scheduling/replacement-handlers";
import { swapProposalNotifyHandler, swapResultNotifyHandler } from "@/lib/scheduling/swap-handlers";
import { automationDispatchHandler } from "@/lib/automations/handler";

const noop: JobHandler = async (job: Job) => {
  logger.info("jobs.noop", { id: job.id, payload: job.payload });
};

const HANDLERS: Record<string, JobHandler> = {
  noop,
  "notification-send": notificationSendHandler,
  "availability-nudge": availabilityNudgeHandler,
  "schedule-delivery": scheduleDeliveryHandler,
  "shift-reminder": shiftReminderHandler,
  "replacement-offer-notify": replacementOfferNotifyHandler,
  "replacement-offer-timeout": replacementTimeoutHandler,
  "swap-proposal-notify": swapProposalNotifyHandler,
  "swap-result-notify": swapResultNotifyHandler,
  "automation-dispatch": automationDispatchHandler,
};

export function getHandler(type: string): JobHandler | null {
  return HANDLERS[type] ?? null;
}
