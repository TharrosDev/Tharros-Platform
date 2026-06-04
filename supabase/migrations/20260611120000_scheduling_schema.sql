-- Day 41 — Core scheduling schema (Phase 3 / AI Workforce Scheduling)
-- The data model the scheduling product sits on: roster detail, availability,
-- demand/coverage inputs, the labor-rule parameters the Day-42 engine reads, the
-- schedules/shifts the deterministic solver writes, and the disruption events
-- (time-off, sick-calls, swaps, replacement offers) the agent layer drives.
--
-- Tenancy + RLS follow the established Day-10/11 pattern reused everywhere in this
-- app: every table carries org_id; reads are member-scoped via
-- public.current_user_orgs(); writes are owner/admin-gated via
-- public.current_user_role(org_id). Employee-facing writes (a worker calling out
-- sick, accepting a replacement offer, requesting a swap) come from the
-- account-less portal and so land through SECURITY DEFINER RPCs in later days —
-- exactly like the Day-37 portal token RPCs — so anon gets NO direct table access
-- and these tables need no anon policy. The scheduling audit_log is manager-read /
-- service-role-write only.
--
-- Tables already built in earlier Phase-3 days are intentionally NOT recreated
-- here even though the product spec lists them as scheduling entities:
--   employee_portal_tokens (Day 37) · jobs (Day 38) ·
--   ai_conversation_threads / agent_turns / agent_audit_log (Day 39) ·
--   notification_events (Day 40).
-- This migration ALTERs the minimal Day-37 employees table and adds the rest.
--
-- Applied to the live DB via Supabase MCP execute_sql (NOT apply_migration) to keep
-- Supabase's own migration history clean; this file is the repo source of truth.
-- Must also be applied to the CI test project (psunqcyzjcmfgcrnowdl).

-- ===========================================================================
-- employees — extend the Day-37 roster identity with scheduling attributes.
-- (Day 37 created: id, org_id, name, email, active, created_at + its RLS.)
-- ===========================================================================
alter table public.employees
  add column if not exists employment_type    text
    not null default 'part_time'
    check (employment_type in ('full_time', 'part_time', 'casual', 'contract')),
  add column if not exists phone               text,
  add column if not exists seniority_rank      integer,         -- lower = more senior; for union seniority/bidding
  add column if not exists hire_date           date,
  add column if not exists target_hours_weekly numeric(5, 2),   -- desired weekly hours (solver fairness input)
  add column if not exists min_hours_weekly    numeric(5, 2),
  add column if not exists max_hours_weekly    numeric(5, 2),
  add column if not exists is_minor            boolean not null default false, -- triggers minor labor-rule restrictions
  add column if not exists performance_score   numeric(4, 2),   -- manual/optional now; auto-computed is v2
  add column if not exists notes               text,
  add column if not exists updated_at          timestamptz not null default now();

comment on column public.employees.employment_type is
  'Day 41. full_time | part_time | casual | contract. Solver + labor-rule input.';
comment on column public.employees.seniority_rank is
  'Day 41. Lower = more senior. Drives generic seniority-priority / bidding.';
comment on column public.employees.target_hours_weekly is
  'Day 41. Desired weekly hours; solver fairness objective. min/max bound it.';
comment on column public.employees.is_minor is
  'Day 41. Gates the minor restrictions in the Day-42 labor-rules engine.';

-- ===========================================================================
-- roles_certifications — per-org catalog of the roles and certifications a shift
-- can require (e.g. "Barista", "Shift Lead", "Food Handler", "First Aid").
-- ===========================================================================
create table if not exists public.roles_certifications (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  kind        text not null default 'role' check (kind in ('role', 'certification')),
  color       text,                       -- optional UI hint
  description text,
  created_at  timestamptz not null default now()
);

alter table public.roles_certifications enable row level security;

create index if not exists roles_certifications_org_id_idx
  on public.roles_certifications (org_id);
create unique index if not exists roles_certifications_org_name_kind_uidx
  on public.roles_certifications (org_id, lower(name), kind);

comment on table public.roles_certifications is
  'Day 41. Per-org catalog of roles/certifications a shift can require. Member-read, manager-write.';

-- ===========================================================================
-- employee_role_assignments — which employees hold which roles/certifications,
-- with optional certification expiry (the solver only assigns role-matched staff).
-- ===========================================================================
create table if not exists public.employee_role_assignments (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations (id) on delete cascade,
  employee_id           uuid not null references public.employees (id) on delete cascade,
  role_certification_id uuid not null references public.roles_certifications (id) on delete cascade,
  granted_at            date not null default current_date,
  expires_at            date,             -- certs can lapse; null = no expiry
  created_at            timestamptz not null default now(),
  unique (employee_id, role_certification_id)
);

alter table public.employee_role_assignments enable row level security;

create index if not exists employee_role_assignments_org_id_idx
  on public.employee_role_assignments (org_id);
create index if not exists employee_role_assignments_employee_idx
  on public.employee_role_assignments (employee_id);
create index if not exists employee_role_assignments_role_idx
  on public.employee_role_assignments (role_certification_id);

comment on table public.employee_role_assignments is
  'Day 41. Join: employee <-> role/certification (+ optional cert expiry). Member-read, manager-write.';

-- ===========================================================================
-- availability — when an employee can/cannot work. Permanent = recurring weekly
-- (day_of_week + time window); temporary = a dated override window. is_available
-- distinguishes a declared availability from a declared unavailability.
-- ===========================================================================
create table if not exists public.availability (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  employee_id    uuid not null references public.employees (id) on delete cascade,
  kind           text not null default 'permanent' check (kind in ('permanent', 'temporary')),
  day_of_week    smallint check (day_of_week between 0 and 6),  -- 0=Sun; required for permanent
  effective_date date,                    -- temporary: window start (inclusive)
  end_date       date,                    -- temporary: window end (inclusive)
  start_time     time,                    -- null start+end = the whole day
  end_time       time,
  is_available   boolean not null default true,
  notes          text,
  created_at     timestamptz not null default now(),
  -- permanent rows are keyed by weekday; temporary rows by a date window
  check (
    (kind = 'permanent' and day_of_week is not null)
    or (kind = 'temporary' and effective_date is not null)
  )
);

alter table public.availability enable row level security;

create index if not exists availability_org_id_idx on public.availability (org_id);
create index if not exists availability_employee_idx on public.availability (employee_id);

comment on table public.availability is
  'Day 41. Employee availability: permanent (recurring weekday) + temporary (dated). Member-read, manager-write; employee edits via portal RPC (later day).';

-- ===========================================================================
-- business_hours — when the org operates, per weekday. Multiple rows per weekday
-- allowed (split hours); is_closed marks a dark day. Feeds coverage windows.
-- ===========================================================================
create table if not exists public.business_hours (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),  -- 0=Sun
  opens_at    time,
  closes_at   time,
  is_closed   boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.business_hours enable row level security;

create index if not exists business_hours_org_id_idx on public.business_hours (org_id);

comment on table public.business_hours is
  'Day 41. Org operating hours per weekday (split rows allowed; is_closed = dark day). Member-read, manager-write.';

-- ===========================================================================
-- staffing_requirements — how many of a role are needed in a window. SOFT input
-- (the forecasting agent suggests, the manager confirms); source records origin.
-- Keyed by recurring weekday OR a specific date (one of the two).
-- ===========================================================================
create table if not exists public.staffing_requirements (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations (id) on delete cascade,
  role_certification_id uuid references public.roles_certifications (id) on delete set null,
  day_of_week           smallint check (day_of_week between 0 and 6),
  specific_date         date,
  start_time            time not null,
  end_time              time not null,
  min_staff             integer not null default 1 check (min_staff >= 0),
  max_staff             integer check (max_staff is null or max_staff >= min_staff),
  source                text not null default 'manual' check (source in ('manual', 'forecast')),
  notes                 text,
  created_at            timestamptz not null default now(),
  check (day_of_week is not null or specific_date is not null)
);

alter table public.staffing_requirements enable row level security;

create index if not exists staffing_requirements_org_id_idx on public.staffing_requirements (org_id);

comment on table public.staffing_requirements is
  'Day 41. Coverage demand per role/window (soft; forecast agent feeds it). Member-read, manager-write.';

-- ===========================================================================
-- labor_rules — one configurable ruleset per org. The Day-42 engine reads these
-- (hard/soft constraints). Ontario/Canada presets + a free-form params jsonb for
-- forward-compat. NOT a legal-compliance engine — "not legal advice" disclaimer
-- lives in the product surface, per the spec.
-- ===========================================================================
create table if not exists public.labor_rules (
  org_id                       uuid primary key references public.organizations (id) on delete cascade,
  preset                       text not null default 'custom'
    check (preset in ('ontario', 'canada_federal', 'custom')),
  max_daily_hours              numeric(4, 2) not null default 12,
  max_weekly_hours             numeric(5, 2) not null default 48,
  min_rest_hours_between_shifts numeric(4, 2) not null default 8,
  overtime_threshold_weekly    numeric(5, 2) not null default 44,
  max_consecutive_days         integer not null default 6,
  minor_max_daily_hours        numeric(4, 2),       -- restrictions applied when employees.is_minor
  minor_earliest_start         time,
  minor_latest_end             time,
  params                       jsonb not null default '{}'::jsonb,  -- forward-compat extra knobs
  updated_at                   timestamptz not null default now()
);

alter table public.labor_rules enable row level security;

comment on table public.labor_rules is
  'Day 41. One ruleset per org for the Day-42 labor-rules engine (Ontario/Canada presets + custom). Member-read, manager-write. Not legal advice.';

-- ===========================================================================
-- schedules — a draft/published schedule covering a date range. Shifts hang off
-- one schedule. status drives the draft -> review -> publish lifecycle.
-- ===========================================================================
create table if not exists public.schedules (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  name         text,
  period_start date not null,
  period_end   date not null,
  status       text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (period_end >= period_start)
);

alter table public.schedules enable row level security;

create index if not exists schedules_org_id_idx on public.schedules (org_id);
create index if not exists schedules_org_period_idx on public.schedules (org_id, period_start, period_end);

comment on table public.schedules is
  'Day 41. A schedule for a date range (draft/published/archived). Solver writes shifts onto it. Member-read, manager-write.';

-- ===========================================================================
-- shifts — a single assignment within a schedule. employee_id null = an OPEN
-- shift (no one assigned yet / vacated by a sick-call). The deterministic solver
-- is the writer; the LLM never emits these directly.
-- ===========================================================================
create table if not exists public.shifts (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations (id) on delete cascade,
  schedule_id           uuid not null references public.schedules (id) on delete cascade,
  employee_id           uuid references public.employees (id) on delete set null,  -- null = open shift
  role_certification_id uuid references public.roles_certifications (id) on delete set null,
  starts_at             timestamptz not null,
  ends_at               timestamptz not null,
  break_minutes         integer not null default 0 check (break_minutes >= 0),
  status                text not null default 'draft'
    check (status in ('draft', 'published', 'open', 'cancelled')),
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.shifts enable row level security;

create index if not exists shifts_org_id_idx on public.shifts (org_id);
create index if not exists shifts_schedule_idx on public.shifts (schedule_id);
create index if not exists shifts_employee_idx on public.shifts (employee_id);
create index if not exists shifts_starts_at_idx on public.shifts (org_id, starts_at);

comment on table public.shifts is
  'Day 41. A single assignment in a schedule; employee_id null = open shift. Written by the deterministic solver. Member-read, manager-write.';

-- ===========================================================================
-- time_off_requests — employee-initiated leave. Manager (or auto-rule) approves.
-- ===========================================================================
create table if not exists public.time_off_requests (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  reason      text,
  status      text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'cancelled')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.time_off_requests enable row level security;

create index if not exists time_off_requests_org_id_idx on public.time_off_requests (org_id);
create index if not exists time_off_requests_employee_idx on public.time_off_requests (employee_id);

comment on table public.time_off_requests is
  'Day 41. Employee leave requests (portal-initiated via RPC later). Member-read, manager-write/approve.';

-- ===========================================================================
-- sick_call_events — an employee calling out. Links the affected shift (if any);
-- triggers the replacement flow. status tracks resolution.
-- ===========================================================================
create table if not exists public.sick_call_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  shift_id    uuid references public.shifts (id) on delete set null,
  reported_at timestamptz not null default now(),
  status      text not null default 'open'
    check (status in ('open', 'filling', 'resolved', 'escalated')),
  resolution  text,
  notes       text,
  created_at  timestamptz not null default now()
);

alter table public.sick_call_events enable row level security;

create index if not exists sick_call_events_org_id_idx on public.sick_call_events (org_id);
create index if not exists sick_call_events_shift_idx on public.sick_call_events (shift_id);

comment on table public.sick_call_events is
  'Day 41. A worker calling out of a shift; triggers the replacement flow. Member-read, manager-write; employee-reported via portal RPC later.';

-- ===========================================================================
-- shift_swap_requests — employee A asks to swap a shift, optionally targeting
-- employee B. Agent validates labor/hours; auto-approve or manager-escalate.
-- ===========================================================================
create table if not exists public.shift_swap_requests (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations (id) on delete cascade,
  shift_id              uuid not null references public.shifts (id) on delete cascade,
  requesting_employee_id uuid not null references public.employees (id) on delete cascade,
  target_employee_id    uuid references public.employees (id) on delete set null,  -- null = open offer
  status                text not null default 'pending'
    check (status in ('pending', 'accepted', 'approved', 'denied', 'cancelled')),
  reviewed_by           uuid references auth.users (id) on delete set null,
  reviewed_at           timestamptz,
  notes                 text,
  created_at            timestamptz not null default now()
);

alter table public.shift_swap_requests enable row level security;

create index if not exists shift_swap_requests_org_id_idx on public.shift_swap_requests (org_id);
create index if not exists shift_swap_requests_shift_idx on public.shift_swap_requests (shift_id);

comment on table public.shift_swap_requests is
  'Day 41. Shift-swap requests (portal-initiated via RPC later). Member-read, manager-write/approve.';

-- ===========================================================================
-- replacement_pool_events — an offer sent to an eligible employee to fill an
-- open/vacated shift. First-accept-wins (the atomic accept lock is a later-day
-- RPC); expires_at drives the timeout/escalation job.
-- ===========================================================================
create table if not exists public.replacement_pool_events (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  shift_id      uuid not null references public.shifts (id) on delete cascade,
  sick_call_id  uuid references public.sick_call_events (id) on delete set null,
  employee_id   uuid not null references public.employees (id) on delete cascade,  -- offered to
  status        text not null default 'offered'
    check (status in ('offered', 'accepted', 'declined', 'expired', 'withdrawn')),
  offered_at    timestamptz not null default now(),
  responded_at  timestamptz,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.replacement_pool_events enable row level security;

create index if not exists replacement_pool_events_org_id_idx on public.replacement_pool_events (org_id);
create index if not exists replacement_pool_events_shift_idx on public.replacement_pool_events (shift_id);
create index if not exists replacement_pool_events_employee_idx on public.replacement_pool_events (employee_id);

comment on table public.replacement_pool_events is
  'Day 41. Replacement offers to fill an open/vacated shift; first-accept-wins (atomic RPC later). Member-read, manager-write; employee responds via portal RPC.';

-- ===========================================================================
-- scheduling_audit_log — append-only trail of scheduling actions (who/what/when),
-- including agent + system actors. Manager-read; written by service role / RPCs
-- only (no write policy). Mirrors the Day-39 agent_audit_log posture.
-- ===========================================================================
create table if not exists public.scheduling_audit_log (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  actor_type  text not null default 'system'
    check (actor_type in ('manager', 'employee', 'agent', 'system')),
  actor_id    uuid,                      -- auth.users id, employee id, or null (system/agent)
  action      text not null,             -- e.g. 'schedule.published', 'shift.reassigned'
  entity_type text,                      -- e.g. 'schedule', 'shift', 'sick_call'
  entity_id   uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.scheduling_audit_log enable row level security;

create index if not exists scheduling_audit_log_org_id_idx on public.scheduling_audit_log (org_id);
create index if not exists scheduling_audit_log_entity_idx on public.scheduling_audit_log (entity_type, entity_id);

comment on table public.scheduling_audit_log is
  'Day 41. Append-only scheduling action trail (manager/employee/agent/system actors). Manager-read; service-role/RPC-write only.';

-- ===========================================================================
-- RLS policies — applied uniformly:
--   * SELECT  : any member of the org (org_id in current_user_orgs())
--   * INSERT/UPDATE/DELETE : owner/admin of the org (current_user_role in (...))
-- Employee-facing writes arrive through SECURITY DEFINER portal RPCs in later
-- days, so no anon policies are needed here. scheduling_audit_log is the lone
-- exception: member-read, no write policy (service-role / RPC writes only).
-- ===========================================================================
do $$
declare
  t text;
  manager_write_tables text[] := array[
    'roles_certifications',
    'employee_role_assignments',
    'availability',
    'business_hours',
    'staffing_requirements',
    'labor_rules',
    'schedules',
    'shifts',
    'time_off_requests',
    'sick_call_events',
    'shift_swap_requests',
    'replacement_pool_events'
  ];
begin
  foreach t in array manager_write_tables loop
    -- member read
    execute format('drop policy if exists %1$s_select_member on public.%1$s;', t);
    execute format($f$
      create policy %1$s_select_member on public.%1$s
        for select to authenticated
        using (org_id in (select public.current_user_orgs()));
    $f$, t);

    -- manager insert
    execute format('drop policy if exists %1$s_insert_manager on public.%1$s;', t);
    execute format($f$
      create policy %1$s_insert_manager on public.%1$s
        for insert to authenticated
        with check (public.current_user_role(org_id) in ('owner', 'admin'));
    $f$, t);

    -- manager update (both USING + WITH CHECK so org_id can't be reassigned)
    execute format('drop policy if exists %1$s_update_manager on public.%1$s;', t);
    execute format($f$
      create policy %1$s_update_manager on public.%1$s
        for update to authenticated
        using (public.current_user_role(org_id) in ('owner', 'admin'))
        with check (public.current_user_role(org_id) in ('owner', 'admin'));
    $f$, t);

    -- manager delete
    execute format('drop policy if exists %1$s_delete_manager on public.%1$s;', t);
    execute format($f$
      create policy %1$s_delete_manager on public.%1$s
        for delete to authenticated
        using (public.current_user_role(org_id) in ('owner', 'admin'));
    $f$, t);
  end loop;
end $$;

-- scheduling_audit_log: member-read only; no write policy (service role / RPC writes).
drop policy if exists scheduling_audit_log_select_member on public.scheduling_audit_log;
create policy scheduling_audit_log_select_member
  on public.scheduling_audit_log
  for select to authenticated
  using (org_id in (select public.current_user_orgs()));
