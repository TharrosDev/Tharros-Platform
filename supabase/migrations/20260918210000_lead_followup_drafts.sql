alter table public.leads
  add column if not exists follow_up_subject text,
  add column if not exists follow_up_draft text,
  add column if not exists follow_up_drafted_at timestamptz;

comment on column public.leads.follow_up_subject is
  'Latest human-reviewable AI follow-up subject drafted for the lead.';
comment on column public.leads.follow_up_draft is
  'Latest human-reviewable AI follow-up body drafted for the lead. Never auto-sent by Lead Capture.';
comment on column public.leads.follow_up_drafted_at is
  'When the latest follow-up draft was generated.';
