"use server";

import { getOrgContext } from "@/lib/org/queries";
import { getAuthUser } from "@/lib/auth/current-user";
import { logger } from "@/lib/observability/logger";
import { checkQueryCap } from "@/lib/billing/usage";

import { runSchedulePanelHandler } from "./panel-handler";
import type { AgentInputs } from "../orchestrator/types";
import type { PanelResult } from "./types";

/**
 * Day 49 — manager entry point for the candidate panel. Owner/admin only (the
 * persistence + audit writes go through the service-role admin client, so the role
 * is checked explicitly, like the Day-48 orchestrator action). Runs the 4-candidate
 * panel, persists the winning draft + all versions, and returns the result. AI usage
 * (the judge) meters into `ai_usage_events`.
 */

export type PanelState =
  | { ok: true; result: PanelResult }
  | { ok: false; message: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function runSchedulePanel(args: {
  periodStart: string;
  periodEnd: string;
  agentInputs?: AgentInputs;
}): Promise<PanelState> {
  const [user, { activeOrg }] = await Promise.all([getAuthUser(), getOrgContext()]);
  if (!user || !activeOrg) return { ok: false, message: "Not authenticated." };
  if (activeOrg.role !== "owner" && activeOrg.role !== "admin") {
    return { ok: false, message: "Only an owner or admin can build a schedule." };
  }

  if (!DATE_RE.test(args.periodStart) || !DATE_RE.test(args.periodEnd)) {
    return { ok: false, message: "Provide a valid YYYY-MM-DD date range." };
  }
  if (args.periodEnd < args.periodStart) {
    return { ok: false, message: "The end date must be on or after the start date." };
  }

  // Cost control (Day 61): schedule generation is the heaviest AI spend (the
  // candidate panel + optimize-loop), so it counts against the org's monthly AI
  // cap like an assistant query. Block before spending any tokens when over cap.
  const cap = await checkQueryCap(activeOrg.id);
  if (!cap.allowed) {
    return {
      ok: false,
      message:
        "You've reached your plan's monthly AI limit. It resets at the start of next month — or upgrade your plan for a higher limit.",
    };
  }

  try {
    const result = await runSchedulePanelHandler({
      orgId: activeOrg.id,
      userId: user.id,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      agentInputs: args.agentInputs,
    });
    return { ok: true, result };
  } catch (err) {
    logger.error("runSchedulePanel: failed", { err, orgId: activeOrg.id });
    return { ok: false, message: "Couldn't build the schedule just now. Please try again." };
  }
}
