-- Assistant 1C — actions the assistant proposes and a person confirms.
-- The assistant never changes data itself: it writes a pending proposal, the
-- chat renders a confirm card, and confirming runs the normal server action as
-- the confirming user (so its permission + plan checks still apply).
--
-- Apply to BOTH prod (inxhrijqyxvwoeqczbrl) and test (psunqcyzjcmfgcrnowdl).

create table if not exists public.assistant_proposals (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  message_id      uuid references public.messages (id) on delete cascade,
  created_by      uuid not null references auth.users (id) on delete cascade,
  kind            text not null
                    check (kind in ('lead_status', 'follow_up_draft', 'notify_team')),
  payload         jsonb not null check (jsonb_typeof(payload) = 'object'),
  summary         text not null check (char_length(summary) between 1 and 500),
  status          text not null default 'pending'
                    check (status in ('pending', 'confirmed', 'dismissed', 'failed')),
  decided_by      uuid references auth.users (id) on delete set null,
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.assistant_proposals enable row level security;

create index if not exists assistant_proposals_conversation_idx
  on public.assistant_proposals (conversation_id, created_at);

-- Members see their org's proposals. Writes go through the service-role seam
-- (created by the assistant turn, decided by the confirm action), so clients
-- get no insert/update grant at all.
drop policy if exists assistant_proposals_select_member on public.assistant_proposals;
create policy assistant_proposals_select_member
  on public.assistant_proposals for select to authenticated
  using (org_id in (select public.current_user_orgs()));

revoke insert, update, delete on table public.assistant_proposals from anon, authenticated;

drop trigger if exists enforce_immutable_org_id on public.assistant_proposals;
create trigger enforce_immutable_org_id before update of org_id on public.assistant_proposals
  for each row execute function public.prevent_org_id_change();

comment on table public.assistant_proposals is
  'Assistant 1C. Changes the AI proposed; applied only when a person confirms.';
