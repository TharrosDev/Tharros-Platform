import "server-only";

import { anthropic, CHEAP_MODEL } from "@/lib/anthropic/client";
import { recordUsage } from "@/lib/billing/usage";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordLeadEvent } from "@/lib/leads/events";

export type FollowUpDraft = {
  subject: string;
  body: string;
};

function parseDraft(raw: string): FollowUpDraft {
  const cleaned = raw
    .trim()
    .replace(/^\`\`\`(?:json)?\s*/i, "")
    .replace(/\s*\`\`\`$/i, "");

  try {
    const parsed = JSON.parse(cleaned) as { subject?: unknown; body?: unknown };
    const subject =
      typeof parsed.subject === "string" && parsed.subject.trim()
        ? parsed.subject.trim().slice(0, 200)
        : "Following up";
    const body =
      typeof parsed.body === "string" && parsed.body.trim()
        ? parsed.body.trim().slice(0, 6000)
        : cleaned.slice(0, 6000);
    return { subject, body };
  } catch {
    return {
      subject: "Following up",
      body: cleaned.slice(0, 6000),
    };
  }
}

export async function generateLeadFollowUpDraft(input: {
  orgId: string;
  leadId: string;
  userId: string | null;
}): Promise<FollowUpDraft> {
  const admin = createAdminClient();
  const [{ data: leadData, error: leadError }, { data: orgData, error: orgError }] =
    await Promise.all([
      admin
        .from("leads")
        .select("id, org_id, name, email, phone, company, message, status")
        .eq("id", input.leadId)
        .eq("org_id", input.orgId)
        .maybeSingle(),
      admin.from("organizations").select("name").eq("id", input.orgId).maybeSingle(),
    ]);

  if (leadError) throw leadError;
  if (orgError) throw orgError;
  if (!leadData) throw new Error("Lead not found");
  if (!leadData.email) throw new Error("Lead needs an email address before drafting a follow-up");

  const lead = leadData as {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    company: string | null;
    message: string | null;
    status: string;
  };
  const orgName = (orgData as { name?: string } | null)?.name ?? "the business";

  const response = await anthropic.messages.create({
    model: CHEAP_MODEL,
    max_tokens: 900,
    system:
      "Draft a concise, professional first follow-up email to a prospective customer. Do not invent pricing, availability, promises, discounts, policies, or facts not present in the input. Keep a human business owner in control: do not claim an action has already happened. Return ONLY valid JSON with exactly two string fields: subject and body.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              business: orgName,
              lead: {
                name: lead.name,
                company: lead.company,
                enquiry: lead.message,
                currentStatus: lead.status,
              },
              instruction:
                "Write a warm follow-up that acknowledges the enquiry when one exists, invites a reply, and signs off from the business without inventing a staff member name.",
            }),
          },
        ],
      },
    ],
  });

  const raw = response.content
    .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!raw) throw new Error("AI provider returned an empty follow-up draft");
  const draft = parseDraft(raw);

  const { error: updateError } = await admin
    .from("leads")
    .update({
      follow_up_subject: draft.subject,
      follow_up_draft: draft.body,
      follow_up_drafted_at: new Date().toISOString(),
    })
    .eq("id", input.leadId)
    .eq("org_id", input.orgId);
  if (updateError) throw updateError;

  await Promise.all([
    recordUsage(input.orgId, input.userId, CHEAP_MODEL, response.usage),
    recordLeadEvent(admin, {
      orgId: input.orgId,
      leadId: input.leadId,
      type: "lead.followup_drafted",
      data: { model: CHEAP_MODEL },
      actorUserId: input.userId,
      dispatch: false,
    }),
  ]);

  return draft;
}
