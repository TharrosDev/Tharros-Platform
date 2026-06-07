-- ===========================================================================
-- Day 49 — Candidate panel + judge: schedule versions.
--
-- The Day-49 candidate panel runs the Day-48 optimize-loop under several
-- objective weightings (balanced / fairness / seniority / cost), a judge agent
-- picks the best, and the winner is persisted as a draft `schedules` row + its
-- `shifts` (Day-41 tables). This migration adds:
--   * schedules.optimization_summary — the judge's plain-language trade-off recap
--     for the selected schedule.
--   * schedule_versions — one row per candidate (all weightings), so the panel's
--     alternatives are first-class + queryable (the Day-50/51 dashboard lists and
--     compares them; future re-optimize appends versions). The selected version is
--     flagged is_selected; its shifts are the ones materialized onto `schedules`.
--
-- RLS mirrors the Day-41 scheduling tables: member-read, manager-write.
-- ===========================================================================

alter table public.schedules
  add column if not exists optimization_summary text;

comment on column public.schedules.optimization_summary is
  'Day 49. The judge agent''s plain-language explanation of the chosen candidate''s trade-off.';

create table if not exists public.schedule_versions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  schedule_id   uuid not null references public.schedules (id) on delete cascade,
  label         text not null,                       -- weighting profile: balanced/fairness/seniority/cost
  weights       jsonb not null default '{}'::jsonb,  -- the SolverWeights used
  assignments   jsonb not null default '[]'::jsonb,  -- the candidate's full assignment set
  score         jsonb not null default '{}'::jsonb,  -- solver score breakdown
  gap_report    jsonb not null default '[]'::jsonb,  -- residual per-slot coverage
  covered       boolean not null default false,
  total_missing integer not null default 0,
  judge_rank    integer,                             -- 1 = judge's pick; null = unranked (filtered)
  is_selected   boolean not null default false,
  note          text,                                -- optional per-candidate judge note
  created_at    timestamptz not null default now()
);

alter table public.schedule_versions enable row level security;

create index if not exists schedule_versions_org_id_idx on public.schedule_versions (org_id);
create index if not exists schedule_versions_schedule_idx on public.schedule_versions (schedule_id);

comment on table public.schedule_versions is
  'Day 49. One row per candidate from the candidate panel (all weightings). is_selected marks the judge''s pick (materialized as schedules+shifts). Member-read, manager-write.';

-- RLS: member-read / manager-write, matching the Day-41 scheduling tables.
drop policy if exists schedule_versions_select_member on public.schedule_versions;
create policy schedule_versions_select_member on public.schedule_versions
  for select to authenticated
  using (org_id in (select public.current_user_orgs()));

drop policy if exists schedule_versions_insert_manager on public.schedule_versions;
create policy schedule_versions_insert_manager on public.schedule_versions
  for insert to authenticated
  with check (public.current_user_role(org_id) in ('owner', 'admin'));

drop policy if exists schedule_versions_update_manager on public.schedule_versions;
create policy schedule_versions_update_manager on public.schedule_versions
  for update to authenticated
  using (public.current_user_role(org_id) in ('owner', 'admin'))
  with check (public.current_user_role(org_id) in ('owner', 'admin'));

drop policy if exists schedule_versions_delete_manager on public.schedule_versions;
create policy schedule_versions_delete_manager on public.schedule_versions
  for delete to authenticated
  using (public.current_user_role(org_id) in ('owner', 'admin'));
