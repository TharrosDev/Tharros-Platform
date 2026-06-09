-- Day 59 — Scheduling analytics (Phase 3H / oversight).
-- Two org-scoped, member-readable SECURITY DEFINER RPCs that roll up the raw
-- counts the analytics dashboard needs over a trailing window. The DERIVED
-- metrics (labor utilization, schedule efficiency, staffing gap, acceptance
-- rate, attendance reliability) are computed in pure, unit-tested TS
-- (lib/analytics/metrics.ts) from these raw aggregates — the same split as
-- ai_usage_summary (Day 33) + usage-math.ts: SQL sums, TS derives.
--
-- Both functions follow the Day-32/33 convention:
--   * membership guard: `p_org in (select public.current_user_orgs())` — a
--     non-member gets no rows even under SECURITY DEFINER (auth.uid() is the
--     caller's), mirroring ai_usage_summary / document_citation_counts;
--   * `set search_path = ''`, everything schema-qualified;
--   * execute revoked from anon/public, granted to authenticated.
--
-- Net worked hours match lib/scheduling/labor-rules.shiftHours: shift span minus
-- the unpaid break. Window = shifts whose `starts_at` falls in the trailing
-- p_days days (the schedule as worked); call-out / offer / swap / time-off
-- frequencies count their own rows over the same trailing window.
--
-- Apply via Supabase MCP execute_sql (NOT apply_migration) to BOTH prod
-- (inxhrijqyxvwoeqczbrl) and the CI test project (psunqcyzjcmfgcrnowdl) so the
-- schemas stay in lockstep. This file is the repo source of truth.

-- ---------------------------------------------------------------------------
-- scheduling_analytics_overview: one aggregate row for the whole org.
--   assigned_*  → published shifts with an employee (worked).
--   open_*      → status='open' shifts (the staffing gap — unfilled demand).
--   sick_calls / offers / offers_accepted / swaps / time_off → frequencies over
--   the same trailing window (by their own event timestamps).
-- ---------------------------------------------------------------------------
create or replace function public.scheduling_analytics_overview(p_org uuid, p_days integer)
returns table (
  assigned_shifts bigint,
  open_shifts     bigint,
  assigned_hours  numeric,
  open_hours      numeric,
  sick_calls      bigint,
  offers          bigint,
  offers_accepted bigint,
  swaps           bigint,
  time_off        bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select
      p_org as org,
      (now() at time zone 'utc') - (greatest(p_days, 1) || ' days')::interval as since
  ),
  member as (
    -- Membership guard: empty set for a non-member → all joins below yield zero.
    select org from bounds where org in (select public.current_user_orgs())
  ),
  shift_rows as (
    select
      s.employee_id,
      s.status,
      (extract(epoch from (s.ends_at - s.starts_at)) / 3600.0)
        - (s.break_minutes / 60.0) as net_hours
    from public.shifts s, bounds b
    where s.org_id = (select org from member)
      and s.starts_at >= b.since
      and s.status in ('published', 'open')
  )
  select
    coalesce(sum((employee_id is not null and status = 'published')::int), 0)::bigint as assigned_shifts,
    coalesce(sum((status = 'open')::int), 0)::bigint as open_shifts,
    coalesce(round(sum(net_hours) filter (where employee_id is not null and status = 'published'), 2), 0) as assigned_hours,
    coalesce(round(sum(net_hours) filter (where status = 'open'), 2), 0) as open_hours,
    (select count(*) from public.sick_call_events e, bounds b
       where e.org_id = (select org from member) and e.reported_at >= b.since)::bigint as sick_calls,
    (select count(*) from public.replacement_pool_events r, bounds b
       where r.org_id = (select org from member) and r.offered_at >= b.since)::bigint as offers,
    (select count(*) from public.replacement_pool_events r, bounds b
       where r.org_id = (select org from member) and r.offered_at >= b.since
         and r.status = 'accepted')::bigint as offers_accepted,
    (select count(*) from public.shift_swap_requests w, bounds b
       where w.org_id = (select org from member) and w.created_at >= b.since)::bigint as swaps,
    (select count(*) from public.time_off_requests t, bounds b
       where t.org_id = (select org from member) and t.created_at >= b.since)::bigint as time_off
  from shift_rows;
$$;

comment on function public.scheduling_analytics_overview(uuid, integer) is
  'Day 59. Org-wide scheduling analytics rollup over a trailing p_days window:
   assigned vs open shift counts + net hours (staffing gap), and sick-call /
   replacement-offer / swap / time-off frequencies. Membership enforced via
   current_user_orgs(); a non-member gets a single all-zero row. Derived scores
   (utilization, efficiency, acceptance rate) are computed in TS.';

revoke all on function public.scheduling_analytics_overview(uuid, integer) from public, anon;
grant execute on function public.scheduling_analytics_overview(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- scheduling_analytics_by_employee: one row per active employee, same window.
-- assigned_shifts / assigned_hours are the worked schedule; sick_calls + offers
-- (+ accepted) + swaps + time_off feed the per-employee reliability + acceptance
-- scores computed in TS. Left-joins so an employee with no activity still shows.
-- ---------------------------------------------------------------------------
create or replace function public.scheduling_analytics_by_employee(p_org uuid, p_days integer)
returns table (
  employee_id     uuid,
  name            text,
  assigned_shifts bigint,
  assigned_hours  numeric,
  sick_calls      bigint,
  offers          bigint,
  offers_accepted bigint,
  swaps           bigint,
  time_off        bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select
      p_org as org,
      (now() at time zone 'utc') - (greatest(p_days, 1) || ' days')::interval as since
  ),
  member as (
    select org from bounds where org in (select public.current_user_orgs())
  )
  select
    emp.id as employee_id,
    emp.name,
    coalesce((
      select count(*) from public.shifts s, bounds b
      where s.employee_id = emp.id and s.starts_at >= b.since and s.status = 'published'
    ), 0)::bigint as assigned_shifts,
    coalesce((
      select round(sum((extract(epoch from (s.ends_at - s.starts_at)) / 3600.0) - (s.break_minutes / 60.0)), 2)
      from public.shifts s, bounds b
      where s.employee_id = emp.id and s.starts_at >= b.since and s.status = 'published'
    ), 0) as assigned_hours,
    coalesce((
      select count(*) from public.sick_call_events e, bounds b
      where e.employee_id = emp.id and e.reported_at >= b.since
    ), 0)::bigint as sick_calls,
    coalesce((
      select count(*) from public.replacement_pool_events r, bounds b
      where r.employee_id = emp.id and r.offered_at >= b.since
    ), 0)::bigint as offers,
    coalesce((
      select count(*) from public.replacement_pool_events r, bounds b
      where r.employee_id = emp.id and r.offered_at >= b.since and r.status = 'accepted'
    ), 0)::bigint as offers_accepted,
    coalesce((
      select count(*) from public.shift_swap_requests w, bounds b
      where w.requesting_employee_id = emp.id and w.created_at >= b.since
    ), 0)::bigint as swaps,
    coalesce((
      select count(*) from public.time_off_requests t, bounds b
      where t.employee_id = emp.id and t.created_at >= b.since
    ), 0)::bigint as time_off
  from public.employees emp
  where emp.org_id = (select org from member)
    and emp.active
  order by emp.name;
$$;

comment on function public.scheduling_analytics_by_employee(uuid, integer) is
  'Day 59. Per-employee scheduling analytics over a trailing p_days window:
   worked shifts + net hours, plus sick-call / offer (+accepted) / swap /
   time-off counts. Membership enforced via current_user_orgs(). Derived
   reliability + acceptance scores are computed in TS.';

revoke all on function public.scheduling_analytics_by_employee(uuid, integer) from public, anon;
grant execute on function public.scheduling_analytics_by_employee(uuid, integer) to authenticated;
