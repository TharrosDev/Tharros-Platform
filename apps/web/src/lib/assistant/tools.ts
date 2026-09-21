import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { createToolRegistry, type AgentTool, type ToolRegistry } from "@/lib/agents/tools";
import { hasFeature } from "@/lib/billing/plans";
import type { Tier } from "@/lib/billing/schemas";
import { retrieveGroundingChunks } from "@/lib/documents/rag";
import { buildContextBlock, type GroundingChunk } from "@/lib/documents/rag-prompt";
import { getLead, listLeads } from "@/lib/leads/queries";
import { LEAD_STATUSES } from "@/lib/leads/types";
import { listAutomationRuns } from "@/lib/automations/queries";
import type { ProposalView } from "@/lib/assistant/types";

/**
 * Assistant 1C — the tools the assistant can call. Reads go through the RLS
 * user client (the assistant sees only what the asker can see). Nothing here
 * changes business data: the propose_* tools write a pending proposal that a
 * person confirms in the chat. Tools register only for products on the org's
 * plan.
 */

type ProposalKind = ProposalView["kind"];

type Ctx = {
  orgId: string;
  userId: string;
  conversationId: string;
  tier: Tier | null;
  role: string;
  supabase: SupabaseClient;
  admin: SupabaseClient;
  /** Every chunk surfaced this turn, in first-seen order — drives citation numbering. */
  sources: GroundingChunk[];
  onProposal: (p: ProposalView) => void;
};

const json = (v: unknown) => ({ content: JSON.stringify(v) });
const bad = (message: string) => ({ content: message, isError: true });

function tool<S extends z.ZodType>(
  name: string,
  description: string,
  schema: S,
  inputSchema: Record<string, unknown>,
  run: (input: z.infer<S>) => Promise<{ content: string; isError?: boolean }>,
): AgentTool {
  return {
    definition: {
      name,
      description,
      input_schema: { type: "object", additionalProperties: false, ...inputSchema },
    },
    async handler(_ctx, raw) {
      const parsed = schema.safeParse(raw ?? {});
      if (!parsed.success) return bad(`Invalid input: ${parsed.error.issues[0]?.message}`);
      return run(parsed.data);
    },
  };
}

async function propose(
  ctx: Ctx,
  kind: ProposalKind,
  payload: Record<string, unknown>,
  summary: string,
) {
  const { data, error } = await ctx.admin
    .from("assistant_proposals")
    .insert({
      org_id: ctx.orgId,
      conversation_id: ctx.conversationId,
      created_by: ctx.userId,
      kind,
      payload,
      summary: summary.slice(0, 500),
    })
    .select("id")
    .single();
  if (error) return bad("Couldn't create the proposal.");
  ctx.onProposal({ id: (data as { id: string }).id, kind, summary, status: "pending" });
  return {
    content:
      "Proposal shown to the user as a confirm card. It has NOT been applied; tell the user to confirm it.",
  };
}

export function buildAssistantTools(ctx: Ctx): ToolRegistry {
  const tools: AgentTool[] = [
    tool(
      "search_knowledge",
      "Search the business's uploaded documents (policies, SOPs, manuals, imported pages). Returns numbered SOURCES; cite them as [n]. Call again with different wording if the first search misses.",
      z.object({ query: z.string().min(1).max(500) }),
      {
        properties: { query: { type: "string", description: "What to look for." } },
        required: ["query"],
      },
      async ({ query }) => {
        const found = await retrieveGroundingChunks(ctx.orgId, query);
        for (const c of found) if (!ctx.sources.some((s) => s.id === c.id)) ctx.sources.push(c);
        if (found.length === 0) return { content: "No matching documents." };
        // The full block every time keeps [n] numbering stable across searches.
        return { content: buildContextBlock(ctx.sources) };
      },
    ),
  ];

  if (hasFeature(ctx.tier, "leads")) {
    tools.push(
      tool(
        "list_leads",
        "List recent leads in the pipeline, optionally filtered by status or a search term (name, email, phone, company).",
        z.object({
          status: z.enum(LEAD_STATUSES).optional(),
          query: z.string().max(100).optional(),
          limit: z.number().int().min(1).max(50).optional(),
        }),
        {
          properties: {
            status: { type: "string", enum: [...LEAD_STATUSES] },
            query: { type: "string" },
            limit: { type: "integer", minimum: 1, maximum: 50 },
          },
        },
        async ({ status, query, limit }) => {
          const leads = await listLeads(ctx.orgId, { status, query, limit: limit ?? 20 });
          return json(
            leads.map((l) => ({
              id: l.id,
              name: l.name,
              company: l.company,
              email: l.email,
              status: l.status,
              source: l.source,
              createdAt: l.createdAt,
              lastContactedAt: l.lastContactedAt,
            })),
          );
        },
      ),
      tool(
        "get_lead",
        "Get one lead's full details, including their message and any follow-up draft.",
        z.object({ lead_id: z.string().uuid() }),
        { properties: { lead_id: { type: "string" } }, required: ["lead_id"] },
        async ({ lead_id }) => {
          const lead = await getLead(ctx.orgId, lead_id);
          return lead ? json(lead) : bad("Lead not found.");
        },
      ),
      tool(
        "propose_lead_status",
        "Propose moving a lead to a new pipeline status. The user must confirm; this does not change anything by itself.",
        z.object({
          lead_id: z.string().uuid(),
          status: z.enum(LEAD_STATUSES),
          reason: z.string().max(200).optional(),
        }),
        {
          properties: {
            lead_id: { type: "string" },
            status: { type: "string", enum: [...LEAD_STATUSES] },
            reason: { type: "string" },
          },
          required: ["lead_id", "status"],
        },
        async ({ lead_id, status, reason }) => {
          const lead = await getLead(ctx.orgId, lead_id);
          if (!lead) return bad("Lead not found.");
          return propose(
            ctx,
            "lead_status",
            { leadId: lead_id, status },
            `Move ${lead.name} from ${lead.status} to ${status}${reason ? ` (${reason})` : ""}`,
          );
        },
      ),
      tool(
        "propose_follow_up_draft",
        "Propose preparing an AI follow-up email draft for a lead. The user confirms; the draft is then saved on the lead for review (never sent automatically).",
        z.object({ lead_id: z.string().uuid() }),
        { properties: { lead_id: { type: "string" } }, required: ["lead_id"] },
        async ({ lead_id }) => {
          const lead = await getLead(ctx.orgId, lead_id);
          if (!lead) return bad("Lead not found.");
          return propose(
            ctx,
            "follow_up_draft",
            { leadId: lead_id },
            `Draft a follow-up email for ${lead.name}`,
          );
        },
      ),
    );
  }

  if (hasFeature(ctx.tier, "scheduling")) {
    tools.push(
      tool(
        "get_schedule",
        "Get shifts between two dates (inclusive, YYYY-MM-DD), with employee names and status.",
        z.object({
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        }),
        {
          properties: { from: { type: "string" }, to: { type: "string" } },
          required: ["from", "to"],
        },
        async ({ from, to }) => {
          const { data, error } = await ctx.supabase
            .from("shifts")
            .select("starts_at, ends_at, status, notes, employees(name)")
            .eq("org_id", ctx.orgId)
            .gte("starts_at", `${from}T00:00:00Z`)
            .lte("starts_at", `${to}T23:59:59Z`)
            .neq("status", "cancelled")
            .order("starts_at")
            .limit(200);
          return error ? bad("Couldn't read the schedule.") : json(data);
        },
      ),
      tool(
        "list_employees",
        "List active employees on the roster.",
        z.object({}),
        { properties: {} },
        async () => {
          const { data, error } = await ctx.supabase
            .from("employees")
            .select("id, name, email")
            .eq("org_id", ctx.orgId)
            .eq("active", true)
            .order("name")
            .limit(200);
          return error ? bad("Couldn't read employees.") : json(data);
        },
      ),
      tool(
        "list_time_off",
        "List time-off requests, optionally filtered by status.",
        z.object({ status: z.enum(["pending", "approved", "denied", "cancelled"]).optional() }),
        {
          properties: {
            status: { type: "string", enum: ["pending", "approved", "denied", "cancelled"] },
          },
        },
        async ({ status }) => {
          let q = ctx.supabase
            .from("time_off_requests")
            .select("start_date, end_date, reason, status, employees(name)")
            .eq("org_id", ctx.orgId)
            .order("start_date", { ascending: false })
            .limit(50);
          if (status) q = q.eq("status", status);
          const { data, error } = await q;
          return error ? bad("Couldn't read time off.") : json(data);
        },
      ),
    );
  }

  if (hasFeature(ctx.tier, "automations")) {
    tools.push(
      tool(
        "list_automation_runs",
        "List recent automation runs with their status and any error.",
        z.object({ limit: z.number().int().min(1).max(50).optional() }),
        { properties: { limit: { type: "integer", minimum: 1, maximum: 50 } } },
        async ({ limit }) => json(await listAutomationRuns(ctx.orgId, limit ?? 20)),
      ),
    );
  }

  if (ctx.role === "owner" || ctx.role === "admin") {
    tools.push(
      tool(
        "propose_notify_team",
        "Propose sending an in-app notification to the org's owners and admins. The user must confirm.",
        z.object({ message: z.string().min(1).max(300) }),
        { properties: { message: { type: "string" } }, required: ["message"] },
        async ({ message }) =>
          propose(ctx, "notify_team", { message }, `Notify managers: "${message}"`),
      ),
    );
  }

  return createToolRegistry(tools);
}
