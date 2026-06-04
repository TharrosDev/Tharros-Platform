import "server-only";

import { anthropic } from "@/lib/anthropic/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { recordUsage } from "@/lib/billing/usage";

import { recordAuditEvent } from "@/lib/agents/audit";
import { appendTurn, getThread, listThreadTurns, touchThread } from "@/lib/agents/threads";
import { createToolRegistry, type ToolContext, type ToolRegistry } from "@/lib/agents/tools";
import { runTurnLoop, type TurnLoopResult } from "@/lib/agents/turn-loop";

/**
 * Day 39 — server-only wrapper that wires the real side effects into the pure
 * `runTurnLoop`. This is the secret-holding leaf (imports the Anthropic client +
 * admin Supabase client), so the loop logic stays unit-testable on its own.
 *
 * The agent runs as a SYSTEM actor (typically driven by the Day-38 job runtime),
 * so reads + writes use the service-role admin client — there's no user session
 * in a cron tick. Tenancy is enforced in code by always scoping to `orgId`. The
 * tool `ToolContext` still carries the RLS user-session client for tools that
 * legitimately want a user-scoped read.
 *
 * No real scheduling tools exist yet (Day 46–48); the default registry is just
 * the trivial `echo`. Callers may pass their own registry.
 */
export type RunAgentTurnInput = {
  threadId: string;
  orgId: string;
  userId?: string | null;
  /** A new inbound message to append before running the agent. */
  userMessage?: string;
  registry?: ToolRegistry;
  maxSteps?: number;
  model?: string;
};

export async function runAgentTurn(input: RunAgentTurnInput): Promise<TurnLoopResult> {
  const admin = createAdminClient();
  const supabase = await createClient();
  const registry = input.registry ?? createToolRegistry();
  const userId = input.userId ?? null;

  const ctx: ToolContext = { orgId: input.orgId, userId, supabase, admin };

  return runTurnLoop({
    registry,
    userMessage: input.userMessage,
    maxSteps: input.maxSteps,
    model: input.model,
    io: {
      getThread: () => getThread(admin, input.threadId),
      listTurns: () => listThreadTurns(admin, input.threadId),
      appendTurn: (turn) =>
        appendTurn(admin, { threadId: input.threadId, orgId: input.orgId, ...turn }),
      callModel: (req) => anthropic.messages.create(req),
      executeTool: (tool, toolInput) => tool.handler(ctx, toolInput),
      recordUsage: (model, usage) => recordUsage(input.orgId, userId, model, usage),
      audit: (event) =>
        recordAuditEvent(admin, { orgId: input.orgId, threadId: input.threadId, ...event }),
      touchThread: () => touchThread(admin, input.threadId),
    },
  });
}
