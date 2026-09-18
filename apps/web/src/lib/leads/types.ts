export const LEAD_STATUSES = ["new", "contacted", "qualified", "won", "lost"] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LeadSource = "manual" | "public_form" | "api";

export type Lead = {
  id: string;
  orgId: string;
  captureFormId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  source: LeadSource;
  status: LeadStatus;
  createdBy: string | null;
  lastContactedAt: string | null;
  followUpSubject: string | null;
  followUpDraft: string | null;
  followUpDraftedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadEvent = {
  id: string;
  orgId: string;
  leadId: string;
  type:
    | "lead.created"
    | "lead.status_changed"
    | "lead.note_added"
    | "lead.followup_drafted"
    | "lead.followup_sent"
    | "automation.action";
  data: Record<string, unknown>;
  actorUserId: string | null;
  createdAt: string;
};

export type CaptureForm = {
  id: string;
  orgId: string;
  name: string;
  publicToken: string;
  headline: string;
  successMessage: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type LeadRow = {
  id: string;
  org_id: string;
  capture_form_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  source: LeadSource;
  status: LeadStatus;
  created_by: string | null;
  last_contacted_at: string | null;
  follow_up_subject: string | null;
  follow_up_draft: string | null;
  follow_up_drafted_at: string | null;
  created_at: string;
  updated_at: string;
};

type CaptureFormRow = {
  id: string;
  org_id: string;
  name: string;
  public_token: string;
  headline: string;
  success_message: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export function mapLead(row: LeadRow): Lead {
  return {
    id: row.id,
    orgId: row.org_id,
    captureFormId: row.capture_form_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    message: row.message,
    source: row.source,
    status: row.status,
    createdBy: row.created_by,
    lastContactedAt: row.last_contacted_at,
    followUpSubject: row.follow_up_subject,
    followUpDraft: row.follow_up_draft,
    followUpDraftedAt: row.follow_up_drafted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCaptureForm(row: CaptureFormRow): CaptureForm {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    publicToken: row.public_token,
    headline: row.headline,
    successMessage: row.success_message,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
