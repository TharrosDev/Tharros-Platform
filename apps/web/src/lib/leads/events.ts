import type { SupabaseClient } from "@supabase/supabase-js";

import { enqueueJob } from "@/lib/jobs/enqueue";

export type LeadEventType =
  | "lead.created"
  | "lead.status_changed"
  | "lead.note_added"
  | "automation.action";

export async function recordLeadEvent(
  admin: SupabaseClient,
  input: {
    orgId: string;
    leadId: string;
    type: LeadEventType;
    data?: Record<string, unknown>;
    actorUserId?: string | null;
    dispatch?: boolean;
  },
): Promise<string> {
  const { data, error } = await admin
    .from("lead_events")
    .insert({
      org_id: input.orgId,
      lead_id: input.leadId,
      type: input.type,
      data: input.data ?? {},
      actor_user_id: input.actorUserId ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  const eventId = (data as { id: string }).id;

  if (input.dispatch !== false && input.type !== "automation.action") {
    await enqueueJob(admin, {
      type: "automation-dispatch",
      payload: { eventId },
      orgId: input.orgId,
    });
  }

  return eventId;
}
