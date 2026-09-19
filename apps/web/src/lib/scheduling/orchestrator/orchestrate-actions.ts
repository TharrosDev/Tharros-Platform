"use server";

import { checkQueryCap } from "@/lib/billing/usage";
import { logger } from "@/lib/observability/logger";
import { requireSchedulingAccess } from "@/lib/scheduling/access";

import { optimizeSchedule } from "./orchestrate-handler";
import type { AgentInputs, OptimizeResult } from "./types";

/**
 * Day 48 — manager-side entry point for the optimize-loop. Owner/admin only:
 * unlike the Day-47 forecast/intent actions (which gate via RLS on user-session
 * writes), the orchestrator's audit + thread writes go through the service-role
 * admin client, so the role is checked explicitly here. Returns a PREVIEW
 * `OptimizeResult` — nothing is persisted as a draft (that's Day 49). AI calls
 * inside the handler meter into `ai_usage_events`.
 */

export type OptimizeState =
  | { ok: true; result: OptimizeResult }
  | { ok: false; message: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function runScheduleOptimization(args: {
  periodStart: string;
  periodEnd: string;
  agentInputs?: AgentInputs;
}): Promise<OptimizeState> {
  const access = await requireSchedulingAccess();
  if (!access.ok) return { ok: false, message: access.message };
  const { user, activeOrg } = access;
  if (activeOrg.role !== "owner" && activeOrg.role !== "admin") {
    return { ok: false, message: "Only an owner or admin can build a schedule." };
  }

  if (!DATE_RE.test(args.periodStart) || !DATE_RE.test(args.periodEnd)) {
    return { ok: false, message: "Provide a valid YYYY-MM-DD date range." };
  }
  if (args.periodEnd < args.periodStart) {
    return { ok: false, message: "The end date must be on or after the start date." };
  }

  const cap = await checkQueryCap(activeOrg.id);
  if (!cap.allowed) {
    return { ok: false, message: "You've reached your plan's monthly AI limit." };
  }

  try {
    const result = await optimizeSchedule({
      orgId: activeOrg.id,
      userId: user.id,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      agentInputs: args.agentInputs,
    });
    return { ok: true, result };
  } catch (err) {
    logger.error("runScheduleOptimization: failed", { err, orgId: activeOrg.id });
    return { ok: false, message: "Couldn't build the schedule just now. Please try again." };
  }
}
