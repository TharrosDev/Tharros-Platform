-- Day 43 — Scheduling onboarding wizard
-- Adds the persistence the first scheduling UI needs: an agent persona + a
-- setup-complete marker on org_settings, a per-org unique email so the wizard's
-- roster step is idempotent, and one transactional SECURITY DEFINER RPC that
-- writes the whole wizard payload (roster, hours, staffing, labor rules, persona)
-- in a single owner/admin-gated call. Mirrors the Day-12 complete_org_onboarding
-- pattern so RLS stays intact while the wizard has a single authoritative path.
--
-- Applied to the live DB via Supabase MCP execute_sql (NOT apply_migration) to
-- keep Supabase's own migration history clean; this file is the repo source of truth.

-- ---------------------------------------------------------------------------
-- org_settings: the company agent persona/tone (jsonb so the shape can grow) and
-- a scheduling setup marker. NULL scheduling_onboarded_at → the /scheduling area
-- routes the owner to the setup wizard.
-- ---------------------------------------------------------------------------
alter table public.org_settings
  add column if not exists agent_persona          jsonb not null
    default '{"tone": "professional", "notes": ""}'::jsonb,
  add column if not exists scheduling_onboarded_at timestamptz;

comment on column public.org_settings.agent_persona is
  'Day 43. Company agent voice: { tone, notes }. Drives the scheduling agents'' tone.';
comment on column public.org_settings.scheduling_onboarded_at is
  'Day 43. NULL until the scheduling setup wizard is completed; gates /scheduling.';

-- ---------------------------------------------------------------------------
-- Per-org unique email so the wizard roster upsert (on conflict) is idempotent.
-- Case-insensitive to match how the app lowercases emails.
-- ---------------------------------------------------------------------------
create unique index if not exists employees_org_email_key
  on public.employees (org_id, lower(email));

-- ---------------------------------------------------------------------------
-- complete_scheduling_setup(): owner/admin-only, transactional, idempotent.
-- Writes the full wizard payload. JSON shapes (all org_id is taken from p_org,
-- never trusted from the client):
--   p_employees: [{ name, email, employment_type, seniority_rank, is_minor,
--                   target_hours_weekly, min_hours_weekly, max_hours_weekly, role }]
--   p_business_hours: [{ day_of_week, opens_at, closes_at, is_closed }]  (7 rows)
--   p_staffing: [{ day_of_week, start_time, end_time, min_staff, role }]
--   p_labor: { preset, max_daily_hours, max_weekly_hours, min_rest_hours_between_shifts,
--              overtime_threshold_weekly, max_consecutive_days,
--              minor_max_daily_hours, minor_earliest_start, minor_latest_end }
--   p_persona: { tone, notes }
-- ---------------------------------------------------------------------------
create or replace function public.complete_scheduling_setup(
  p_org            uuid,
  p_employees      jsonb default '[]'::jsonb,
  p_business_hours jsonb default '[]'::jsonb,
  p_staffing       jsonb default '[]'::jsonb,
  p_labor          jsonb default '{}'::jsonb,
  p_persona        jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_emp jsonb;
  v_bh  jsonb;
  v_st  jsonb;
  v_role_name text;
  v_role_id   uuid;
  v_emp_id    uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if public.current_user_role(p_org) not in ('owner', 'admin') then
    raise exception 'Only an owner or admin can set up scheduling for organization %', p_org
      using errcode = 'insufficient_privilege';
  end if;

  -- Roster: upsert each employee by (org_id, lower(email)); refresh detail fields.
  for v_emp in select * from jsonb_array_elements(coalesce(p_employees, '[]'::jsonb))
  loop
    if coalesce(btrim(v_emp ->> 'email'), '') = '' then
      continue;
    end if;

    insert into public.employees (
      org_id, name, email, employment_type, seniority_rank, is_minor,
      target_hours_weekly, min_hours_weekly, max_hours_weekly
    )
    values (
      p_org,
      btrim(v_emp ->> 'name'),
      lower(btrim(v_emp ->> 'email')),
      coalesce(nullif(v_emp ->> 'employment_type', ''), 'part_time'),
      nullif(v_emp ->> 'seniority_rank', '')::integer,
      coalesce((v_emp ->> 'is_minor')::boolean, false),
      nullif(v_emp ->> 'target_hours_weekly', '')::numeric,
      nullif(v_emp ->> 'min_hours_weekly', '')::numeric,
      nullif(v_emp ->> 'max_hours_weekly', '')::numeric
    )
    on conflict (org_id, lower(email)) do update set
      name                = excluded.name,
      employment_type     = excluded.employment_type,
      seniority_rank      = excluded.seniority_rank,
      is_minor            = excluded.is_minor,
      target_hours_weekly = excluded.target_hours_weekly,
      min_hours_weekly    = excluded.min_hours_weekly,
      max_hours_weekly    = excluded.max_hours_weekly
    returning id into v_emp_id;

    -- Optional role: upsert the role and assign it to the employee.
    v_role_name := nullif(btrim(v_emp ->> 'role'), '');
    if v_role_name is not null then
      insert into public.roles_certifications (org_id, name, kind)
      values (p_org, v_role_name, 'role')
      on conflict (org_id, lower(name), kind) do update set name = excluded.name
      returning id into v_role_id;

      insert into public.employee_role_assignments (org_id, employee_id, role_certification_id)
      values (p_org, v_emp_id, v_role_id)
      on conflict (employee_id, role_certification_id) do nothing;
    end if;
  end loop;

  -- Business hours: replace the whole week.
  delete from public.business_hours where org_id = p_org;
  for v_bh in select * from jsonb_array_elements(coalesce(p_business_hours, '[]'::jsonb))
  loop
    insert into public.business_hours (org_id, day_of_week, opens_at, closes_at, is_closed)
    values (
      p_org,
      (v_bh ->> 'day_of_week')::smallint,
      nullif(v_bh ->> 'opens_at', '')::time,
      nullif(v_bh ->> 'closes_at', '')::time,
      coalesce((v_bh ->> 'is_closed')::boolean, false)
    );
  end loop;

  -- Staffing: replace the wizard-sourced (manual) requirements only.
  delete from public.staffing_requirements where org_id = p_org and source = 'manual';
  for v_st in select * from jsonb_array_elements(coalesce(p_staffing, '[]'::jsonb))
  loop
    v_role_name := nullif(btrim(v_st ->> 'role'), '');
    v_role_id := null;
    if v_role_name is not null then
      select id into v_role_id
      from public.roles_certifications
      where org_id = p_org and lower(name) = lower(v_role_name) and kind = 'role'
      limit 1;
    end if;

    insert into public.staffing_requirements (
      org_id, role_certification_id, day_of_week, start_time, end_time, min_staff, source
    )
    values (
      p_org,
      v_role_id,
      (v_st ->> 'day_of_week')::smallint,
      (v_st ->> 'start_time')::time,
      (v_st ->> 'end_time')::time,
      greatest(coalesce((v_st ->> 'min_staff')::integer, 1), 0),
      'manual'
    );
  end loop;

  -- Labor rules: one ruleset per org.
  insert into public.labor_rules (
    org_id, preset, max_daily_hours, max_weekly_hours, min_rest_hours_between_shifts,
    overtime_threshold_weekly, max_consecutive_days,
    minor_max_daily_hours, minor_earliest_start, minor_latest_end, updated_at
  )
  values (
    p_org,
    coalesce(nullif(p_labor ->> 'preset', ''), 'custom'),
    coalesce((p_labor ->> 'max_daily_hours')::numeric, 12),
    coalesce((p_labor ->> 'max_weekly_hours')::numeric, 48),
    coalesce((p_labor ->> 'min_rest_hours_between_shifts')::numeric, 8),
    coalesce((p_labor ->> 'overtime_threshold_weekly')::numeric, 44),
    coalesce((p_labor ->> 'max_consecutive_days')::integer, 6),
    nullif(p_labor ->> 'minor_max_daily_hours', '')::numeric,
    nullif(p_labor ->> 'minor_earliest_start', '')::time,
    nullif(p_labor ->> 'minor_latest_end', '')::time,
    now()
  )
  on conflict (org_id) do update set
    preset                        = excluded.preset,
    max_daily_hours               = excluded.max_daily_hours,
    max_weekly_hours              = excluded.max_weekly_hours,
    min_rest_hours_between_shifts  = excluded.min_rest_hours_between_shifts,
    overtime_threshold_weekly     = excluded.overtime_threshold_weekly,
    max_consecutive_days          = excluded.max_consecutive_days,
    minor_max_daily_hours         = excluded.minor_max_daily_hours,
    minor_earliest_start          = excluded.minor_earliest_start,
    minor_latest_end              = excluded.minor_latest_end,
    updated_at                    = now();

  -- Persona + completion marker.
  update public.org_settings
  set agent_persona           = coalesce(p_persona, '{}'::jsonb),
      scheduling_onboarded_at = now()
  where org_id = p_org;
end;
$$;

comment on function public.complete_scheduling_setup(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) is
  'Day 43. Owner/admin-only, transactional, idempotent: persist the scheduling setup wizard payload.';

revoke execute on function public.complete_scheduling_setup(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) from anon, public;
grant  execute on function public.complete_scheduling_setup(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
