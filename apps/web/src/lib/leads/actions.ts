"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuthUser } from "@/lib/auth/current-user";
import { getFeatureAccess } from "@/lib/billing/entitlements";
import { checkQueryCap } from "@/lib/billing/usage";
import { getOrgContext } from "@/lib/org/queries";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordLeadEvent } from "@/lib/leads/events";
import { generateLeadFollowUpDraft } from "@/lib/leads/follow-up";
import { LEAD_STATUSES } from "@/lib/leads/types";
import { logger } from "@/lib/observability/logger";

const optionalText = (max: number) =>
  z.preprocess(
    (value) => {
      const text = String(value ?? "").trim();
      return text.length ? text : null;
    },
    z.string().max(max).nullable(),
  );

const leadSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    email: optionalText(320),
    phone: optionalText(80),
    company: optionalText(160),
    message: optionalText(4000),
  })
  .refine((value) => value.email || value.phone || value.message, {
    message: "Add an email, phone number, or message.",
  });

const statusSchema = z.enum(LEAD_STATUSES);

async function requireLeadAccess(manager = false) {
  const [user, { activeOrg }, access] = await Promise.all([
    getAuthUser(),
    getOrgContext(),
    getFeatureAccess("leads"),
  ]);
  if (!user || !activeOrg) redirect("/login");
  if (!access.entitled) redirect("/billing");
  if (manager && activeOrg.role === "member") redirect("/leads?error=permission");
  return { user, activeOrg };
}

export async function createManualLead(formData: FormData): Promise<void> {
  const { user, activeOrg } = await requireLeadAccess();
  const parsed = leadSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    company: formData.get("company"),
    message: formData.get("message"),
  });
  if (!parsed.success) redirect("/leads?error=invalid-lead");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      org_id: activeOrg.id,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      company: parsed.data.company,
      message: parsed.data.message,
      source: "manual",
      status: "new",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    logger.error("leads.create_failed", { err: error, orgId: activeOrg.id });
    redirect("/leads?error=create");
  }

  await recordLeadEvent(createAdminClient(), {
    orgId: activeOrg.id,
    leadId: (data as { id: string }).id,
    type: "lead.created",
    data: { source: "manual" },
    actorUserId: user.id,
  });

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  redirect("/leads?created=1");
}

export async function updateLeadStatus(formData: FormData): Promise<void> {
  const { user, activeOrg } = await requireLeadAccess();
  const leadId = String(formData.get("leadId") ?? "");
  const parsed = statusSchema.safeParse(String(formData.get("status") ?? ""));
  if (!leadId || !parsed.success) redirect("/leads?error=invalid-status");

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("leads")
    .select("status")
    .eq("id", leadId)
    .eq("org_id", activeOrg.id)
    .maybeSingle();

  const from = (current as { status?: string } | null)?.status;
  if (!from) redirect("/leads?error=missing");

  const patch: Record<string, unknown> = { status: parsed.data };
  if (parsed.data === "contacted") patch.last_contacted_at = new Date().toISOString();

  const { error } = await supabase
    .from("leads")
    .update(patch)
    .eq("id", leadId)
    .eq("org_id", activeOrg.id);

  if (error) {
    logger.error("leads.status_update_failed", { err: error, leadId, orgId: activeOrg.id });
    redirect("/leads?error=update");
  }

  if (from !== parsed.data) {
    await recordLeadEvent(createAdminClient(), {
      orgId: activeOrg.id,
      leadId,
      type: "lead.status_changed",
      data: { from, to: parsed.data },
      actorUserId: user.id,
    });
  }

  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function generateLeadFollowUp(formData: FormData): Promise<void> {
  const { user, activeOrg } = await requireLeadAccess();
  const leadId = String(formData.get("leadId") ?? "");
  if (!leadId) redirect("/leads?error=missing");

  const cap = await checkQueryCap(activeOrg.id);
  if (!cap.allowed) redirect("/leads?error=usage-limit");

  try {
    await generateLeadFollowUpDraft({
      orgId: activeOrg.id,
      leadId,
      userId: user.id,
    });
  } catch (err) {
    logger.error("leads.followup_draft_failed", { err, leadId, orgId: activeOrg.id });
    redirect("/leads?error=followup");
  }

  revalidatePath("/leads");
  revalidatePath("/settings/usage");
  redirect("/leads?drafted=1");
}

export async function createCaptureForm(formData: FormData): Promise<void> {
  const { user, activeOrg } = await requireLeadAccess(true);
  const name = String(formData.get("name") ?? "").trim();
  const headline = String(formData.get("headline") ?? "").trim();
  if (!name || name.length > 120) redirect("/leads?error=invalid-form");

  const supabase = await createClient();
  const { error } = await supabase.from("lead_capture_forms").insert({
    org_id: activeOrg.id,
    name,
    headline: headline || "Get in touch",
    created_by: user.id,
  });
  if (error) {
    logger.error("leads.capture_form_create_failed", { err: error, orgId: activeOrg.id });
    redirect("/leads?error=form-create");
  }

  revalidatePath("/leads");
  redirect("/leads?form-created=1");
}

export async function toggleCaptureForm(formData: FormData): Promise<void> {
  const { activeOrg } = await requireLeadAccess(true);
  const id = String(formData.get("formId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("lead_capture_forms")
    .update({ active })
    .eq("id", id)
    .eq("org_id", activeOrg.id);

  if (error) logger.error("leads.capture_form_toggle_failed", { err: error, id });
  revalidatePath("/leads");
}


export async function addLeadNote(formData: FormData): Promise<void> {
  const { user, activeOrg } = await requireLeadAccess();
  const leadId = String(formData.get("leadId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!leadId || !note || note.length > 4000) {
    redirect(leadId ? `/leads/${encodeURIComponent(leadId)}?error=invalid-note` : "/leads?error=invalid-note");
  }

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("org_id", activeOrg.id)
    .maybeSingle();

  if (!lead) redirect("/leads?error=missing");

  try {
    await recordLeadEvent(createAdminClient(), {
      orgId: activeOrg.id,
      leadId,
      type: "lead.note_added",
      data: { note },
      actorUserId: user.id,
      dispatch: false,
    });
  } catch (err) {
    logger.error("leads.note_add_failed", { err, leadId, orgId: activeOrg.id });
    redirect(`/leads/${encodeURIComponent(leadId)}?error=note`);
  }

  revalidatePath(`/leads/${leadId}`);
}
