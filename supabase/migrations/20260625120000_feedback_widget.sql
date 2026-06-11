-- Feedback widget (Suggestions/Questions): user-submitted suggestions, bugs,
-- and wishes, triaged by the in-app DeepSeek feedback agent.
--
-- feedback_submissions — one row per finalized submission. The agent's private
-- ai_summary must never be readable by the submitting user, so the table is
-- DENY-ALL (RLS enabled, no policies): every write goes through the service-role
-- admin client inside the server action, and only the platform admin surface
-- reads it (also via the admin client, behind an email allowlist).
--
-- usage_bonuses — extra monthly AI queries awarded for approved submissions.
-- Also deny-all; checkQueryCap reads it via the admin client.

create table if not exists public.feedback_submissions (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  kind               text not null check (kind in ('suggestion', 'bug', 'wish')),
  severity           text not null default 'minor' check (severity in ('minor', 'major')),
  user_text          text not null,
  transcript         jsonb not null default '[]'::jsonb,
  ai_summary         text not null,
  recommended_reward text not null default 'none'
    check (recommended_reward in ('none', 'usage_bonus')),
  reward_status      text not null default 'pending'
    check (reward_status in ('pending', 'approved', 'denied')),
  reward_note        text,
  status             text not null default 'new' check (status in ('new', 'reviewed')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.feedback_submissions enable row level security;

create index if not exists feedback_submissions_org_idx
  on public.feedback_submissions (org_id);
create index if not exists feedback_submissions_user_idx
  on public.feedback_submissions (user_id);
create index if not exists feedback_submissions_review_idx
  on public.feedback_submissions (status, created_at desc);

comment on table public.feedback_submissions is
  'Suggestions/bugs/wishes from the in-app feedback widget. Deny-all RLS: service-role writes from the feedback action; platform-admin reads only. ai_summary is internal and never shown to the submitter.';

create table if not exists public.usage_bonuses (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  submission_id uuid references public.feedback_submissions (id) on delete set null,
  queries       int not null check (queries > 0),
  -- First day of the UTC month the bonus applies to.
  month         date not null,
  created_at    timestamptz not null default now()
);

alter table public.usage_bonuses enable row level security;

create index if not exists usage_bonuses_org_month_idx
  on public.usage_bonuses (org_id, month);

comment on table public.usage_bonuses is
  'Extra monthly AI queries awarded for approved feedback submissions. Deny-all RLS; written by the platform-admin approval action, read by checkQueryCap (both service-role).';
