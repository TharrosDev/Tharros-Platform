-- Lead Capture + native Automation Hub.
-- These products deliberately use the existing tenant/RLS and durable-jobs
-- infrastructure. Public form submissions are accepted only through the
-- server-side service-role capture seam after validating an active form token.

create table if not exists public.lead_capture_forms (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 120),
  public_token    uuid not null default gen_random_uuid() unique,
  headline        text not null default 'Get in touch',
  success_message text not null default 'Thanks. We received your message and will be in touch.',
  active          boolean not null default true,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.leads (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations (id) on delete cascade,
  capture_form_id   uuid references public.lead_capture_forms (id) on delete set null,
  name              text not null check (char_length(name) between 1 and 160),
  email             text,
  phone             text,
  company           text,
  message           text,
  source            text not null default 'manual'
                      check (source in ('manual', 'public_form', 'api')),
  status            text not null default 'new'
                      check (status in ('new', 'contacted', 'qualified', 'won', 'lost')),
  created_by        uuid references auth.users (id) on delete set null,
  last_contacted_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (email is not null or phone is not null or message is not null)
);

create table if not exists public.lead_events (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  lead_id       uuid not null references public.leads (id) on delete cascade,
  type          text not null,
  data          jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists public.automations (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 120),
  enabled        boolean not null default true,
  trigger_type   text not null
                   check (trigger_type in ('lead.created', 'lead.status_changed')),
  trigger_config jsonb not null default '{}'::jsonb,
  action_type    text not null
                   check (action_type in ('notify_team', 'set_lead_status')),
  action_config  jsonb not null default '{}'::jsonb,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.automation_runs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  automation_id uuid not null references public.automations (id) on delete cascade,
  event_id      uuid references public.lead_events (id) on delete set null,
  lead_id       uuid references public.leads (id) on delete set null,
  status        text not null default 'running'
                  check (status in ('running', 'succeeded', 'failed', 'skipped')),
  result        jsonb not null default '{}'::jsonb,
  error         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.lead_capture_forms enable row level security;
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;

create index if not exists lead_capture_forms_org_idx
  on public.lead_capture_forms (org_id, created_at desc);
create index if not exists leads_org_created_idx
  on public.leads (org_id, created_at desc);
create index if not exists leads_org_status_idx
  on public.leads (org_id, status, created_at desc);
create index if not exists lead_events_lead_created_idx
  on public.lead_events (lead_id, created_at desc);
create index if not exists lead_events_org_type_idx
  on public.lead_events (org_id, type, created_at desc);
create index if not exists automations_org_enabled_trigger_idx
  on public.automations (org_id, enabled, trigger_type);
create index if not exists automation_runs_org_created_idx
  on public.automation_runs (org_id, created_at desc);
create unique index if not exists automation_runs_event_once_idx
  on public.automation_runs (automation_id, event_id)
  where event_id is not null;

drop trigger if exists lead_capture_forms_set_updated_at on public.lead_capture_forms;
create trigger lead_capture_forms_set_updated_at
  before update on public.lead_capture_forms
  for each row execute function public.set_updated_at();

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

drop trigger if exists automations_set_updated_at on public.automations;
create trigger automations_set_updated_at
  before update on public.automations
  for each row execute function public.set_updated_at();

drop policy if exists lead_capture_forms_select_member on public.lead_capture_forms;
create policy lead_capture_forms_select_member
  on public.lead_capture_forms for select to authenticated
  using (org_id in (select public.current_user_orgs()));

drop policy if exists lead_capture_forms_insert_manager on public.lead_capture_forms;
create policy lead_capture_forms_insert_manager
  on public.lead_capture_forms for insert to authenticated
  with check (
    org_id in (select public.current_user_orgs())
    and public.current_user_role(org_id) in ('owner', 'admin')
  );

drop policy if exists lead_capture_forms_update_manager on public.lead_capture_forms;
create policy lead_capture_forms_update_manager
  on public.lead_capture_forms for update to authenticated
  using (public.current_user_role(org_id) in ('owner', 'admin'))
  with check (public.current_user_role(org_id) in ('owner', 'admin'));

drop policy if exists lead_capture_forms_delete_manager on public.lead_capture_forms;
create policy lead_capture_forms_delete_manager
  on public.lead_capture_forms for delete to authenticated
  using (public.current_user_role(org_id) in ('owner', 'admin'));

drop policy if exists leads_select_member on public.leads;
create policy leads_select_member
  on public.leads for select to authenticated
  using (org_id in (select public.current_user_orgs()));

drop policy if exists leads_insert_member on public.leads;
create policy leads_insert_member
  on public.leads for insert to authenticated
  with check (org_id in (select public.current_user_orgs()));

drop policy if exists leads_update_member on public.leads;
create policy leads_update_member
  on public.leads for update to authenticated
  using (org_id in (select public.current_user_orgs()))
  with check (org_id in (select public.current_user_orgs()));

drop policy if exists leads_delete_manager on public.leads;
create policy leads_delete_manager
  on public.leads for delete to authenticated
  using (public.current_user_role(org_id) in ('owner', 'admin'));

drop policy if exists lead_events_select_member on public.lead_events;
create policy lead_events_select_member
  on public.lead_events for select to authenticated
  using (org_id in (select public.current_user_orgs()));

drop policy if exists automations_select_member on public.automations;
create policy automations_select_member
  on public.automations for select to authenticated
  using (org_id in (select public.current_user_orgs()));

drop policy if exists automations_insert_manager on public.automations;
create policy automations_insert_manager
  on public.automations for insert to authenticated
  with check (
    org_id in (select public.current_user_orgs())
    and public.current_user_role(org_id) in ('owner', 'admin')
  );

drop policy if exists automations_update_manager on public.automations;
create policy automations_update_manager
  on public.automations for update to authenticated
  using (public.current_user_role(org_id) in ('owner', 'admin'))
  with check (public.current_user_role(org_id) in ('owner', 'admin'));

drop policy if exists automations_delete_manager on public.automations;
create policy automations_delete_manager
  on public.automations for delete to authenticated
  using (public.current_user_role(org_id) in ('owner', 'admin'));

drop policy if exists automation_runs_select_member on public.automation_runs;
create policy automation_runs_select_member
  on public.automation_runs for select to authenticated
  using (org_id in (select public.current_user_orgs()));

comment on table public.lead_capture_forms is
  'Shareable public lead forms. Token lookup is service-role only for anonymous visitors; org members manage forms through RLS.';
comment on table public.leads is
  'Organization-scoped lead pipeline for manual and public-form capture.';
comment on table public.lead_events is
  'Immutable lead lifecycle events. Service-created and used as automation triggers.';
comment on table public.automations is
  'Native organization automations over supported Tharros domain events.';
comment on table public.automation_runs is
  'Idempotent execution history for native automations. Service-role writes, member reads.';
