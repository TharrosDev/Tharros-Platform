import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import {
  mapCaptureForm,
  mapLead,
  type CaptureForm,
  type Lead,
  type LeadEvent,
  type LeadStatus,
} from "@/lib/leads/types";

const LEAD_COLUMNS =
  "id, org_id, capture_form_id, name, email, phone, company, message, source, status, created_by, last_contacted_at, follow_up_subject, follow_up_draft, follow_up_drafted_at, created_at, updated_at";
const FORM_COLUMNS =
  "id, org_id, name, public_token, headline, success_message, active, created_at, updated_at";

export async function listLeads(
  orgId: string,
  opts: { status?: LeadStatus | null; query?: string | null; limit?: number } = {},
): Promise<Lead[]> {
  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.status) query = query.eq("status", opts.status);
  const search = opts.query?.trim();
  if (search) {
    const escaped = search.replace(/[,%()]/g, " ").trim();
    if (escaped) {
      query = query.or(
        `name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%,company.ilike.%${escaped}%`,
      );
    }
  }

  const { data, error } = await query;
  if (error) {
    logger.error("leads.list_failed", { err: error, orgId });
    return [];
  }
  return ((data ?? []) as Parameters<typeof mapLead>[0][]).map(mapLead);
}

export async function getLead(orgId: string, leadId: string): Promise<Lead | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", leadId)
    .maybeSingle();

  if (error) {
    logger.error("leads.get_failed", { err: error, orgId, leadId });
    return null;
  }
  return data ? mapLead(data as Parameters<typeof mapLead>[0]) : null;
}

export async function listLeadEvents(
  orgId: string,
  leadId: string,
  limit = 100,
): Promise<LeadEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_events")
    .select("id, org_id, lead_id, type, data, actor_user_id, created_at")
    .eq("org_id", orgId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error("leads.events_list_failed", { err: error, orgId, leadId });
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    orgId: String(row.org_id),
    leadId: String(row.lead_id),
    type: row.type as LeadEvent["type"],
    data: (row.data ?? {}) as Record<string, unknown>,
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    createdAt: String(row.created_at),
  }));
}

export async function countNewLeads(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "new");

  if (error) {
    logger.warn("leads.count_new_failed", { error: error.message, orgId });
    return 0;
  }
  return count ?? 0;
}

export async function listCaptureForms(orgId: string): Promise<CaptureForm[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_capture_forms")
    .select(FORM_COLUMNS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("leads.forms_list_failed", { err: error, orgId });
    return [];
  }
  return ((data ?? []) as Parameters<typeof mapCaptureForm>[0][]).map(mapCaptureForm);
}
