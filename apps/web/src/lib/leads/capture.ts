import "server-only";

import { ACTIVE_STATUSES, type SubscriptionStatus, type Tier } from "@/lib/billing/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/notify";
import { recordLeadEvent } from "@/lib/leads/events";
import { mapCaptureForm, type CaptureForm } from "@/lib/leads/types";
import { logger } from "@/lib/observability/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const FORM_COLUMNS =
  "id, org_id, name, public_token, headline, success_message, active, created_at, updated_at";

export type PublicLeadInput = {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
};

async function orgCanCaptureLeads(orgId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("status, tier")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !data) return false;
  const status = data.status as SubscriptionStatus;
  const tier = data.tier as Tier | null;
  return (
    ACTIVE_STATUSES.includes(status) &&
    (tier === "growth" || tier === "pro" || tier === "enterprise")
  );
}

export async function getPublicCaptureForm(token: string): Promise<CaptureForm | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lead_capture_forms")
    .select(FORM_COLUMNS)
    .eq("public_token", token)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    logger.warn("leads.public_form_lookup_failed", { error: error.message });
    return null;
  }
  if (!data) return null;

  const form = mapCaptureForm(data as Parameters<typeof mapCaptureForm>[0]);
  return (await orgCanCaptureLeads(form.orgId)) ? form : null;
}

export async function capturePublicLead(
  token: string,
  input: PublicLeadInput,
  requesterKey: string,
): Promise<
  | { ok: true; leadId: string }
  | { ok: false; reason: "invalid_form" | "rate_limited" | "inactive_plan" }
> {
  const admin = createAdminClient();
  const { data: formData, error: formError } = await admin
    .from("lead_capture_forms")
    .select("id, org_id, name, active")
    .eq("public_token", token)
    .eq("active", true)
    .maybeSingle();

  if (formError || !formData) return { ok: false, reason: "invalid_form" };

  const form = formData as { id: string; org_id: string; name: string; active: boolean };
  if (!(await orgCanCaptureLeads(form.org_id))) {
    return { ok: false, reason: "inactive_plan" };
  }

  // Two atomic buckets: protect one visitor from hammering the endpoint while
  // keeping a separate form-wide circuit breaker for distributed abuse.
  const [requesterLimit, formLimit] = await Promise.all([
    checkRateLimit(`lead-capture:${form.id}:requester:${requesterKey}`, 10, 600, {
      failOpen: false,
    }),
    checkRateLimit(`lead-capture:${form.id}:form`, 120, 60, { failOpen: false }),
  ]);
  if (!requesterLimit.allowed || !formLimit.allowed) {
    return { ok: false, reason: "rate_limited" };
  }

  const { data: leadData, error: leadError } = await admin
    .from("leads")
    .insert({
      org_id: form.org_id,
      capture_form_id: form.id,
      name: input.name,
      email: input.email,
      phone: input.phone,
      company: input.company,
      message: input.message,
      source: "public_form",
      status: "new",
    })
    .select("id")
    .single();

  if (leadError) throw leadError;
  const leadId = (leadData as { id: string }).id;

  await recordLeadEvent(admin, {
    orgId: form.org_id,
    leadId,
    type: "lead.created",
    data: { source: "public_form", captureFormId: form.id },
  });

  const { data: managers } = await admin
    .from("memberships")
    .select("user_id, role")
    .eq("org_id", form.org_id)
    .in("role", ["owner", "admin"]);

  await Promise.all(
    (managers ?? []).map((manager) =>
      createNotification(admin, {
        orgId: form.org_id,
        userId: String(manager.user_id),
        type: "new_lead",
        title: "New lead captured",
        body: `${input.name} submitted ${form.name}.`,
        data: { url: `/leads/${leadId}`, label: "Open lead", leadId },
        email: true,
      }),
    ),
  );

  return { ok: true, leadId };
}
