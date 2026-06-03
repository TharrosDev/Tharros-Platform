-- Day 33 — Cost + rate controls: per-org AI usage metering.
-- Additive only; no destructive changes.
--
--   1. ai_usage_events — one row per Claude call, written by the service-role
--      admin client (the API route after a generation). Carries the org, the
--      acting user, the model, and the token breakdown so we can (a) count an
--      org's queries this month for plan-cap enforcement and (b) estimate spend
--      for the owner usage dashboard. RLS: org members may READ their org's
--      rows; there is NO user write policy — writes go through the service-role
--      client (mirrors subscriptions / document_chunks / ingestion_jobs).
--   2. ai_usage_summary(p_org) — a SECURITY DEFINER RPC returning this calendar
--      month's (UTC) query count + token totals + a per-model breakdown for an
--      org. Powers /settings/usage. Membership-enforced via current_user_orgs()
--      (mirrors document_citation_counts), pinned empty search_path, execute
--      revoked from anon/public.
--
-- Apply via Supabase MCP execute_sql (NOT apply_migration) to BOTH prod
-- (inxhrijqyxvwoeqczbrl) and the CI test project (psunqcyzjcmfgcrnowdl) so the
-- schemas stay in lockstep. This file is the repo source of truth.

-- ---------------------------------------------------------------------------
-- 1. ai_usage_events
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage_events (
  id                    bigint generated always as identity primary key,
  org_id                uuid not null references public.organizations (id) on delete cascade,
  user_id               uuid references auth.users (id) on delete set null,
  model                 text not null,
  input_tokens          int not null default 0,
  output_tokens         int not null default 0,
  cache_read_tokens     int not null default 0,
  cache_creation_tokens int not null default 0,
  created_at            timestamptz not null default now()
);

comment on table public.ai_usage_events is
  'Day 33. One row per Claude call: org, acting user, model, token breakdown.
   Written only by the service-role admin client. Org members read their own
   org''s rows (RLS); counted per UTC month for plan-cap enforcement + cost.';

-- Cap enforcement counts an org''s rows for the current month; the dashboard
-- summary scans the same slice. Index on (org_id, created_at) serves both.
create index if not exists ai_usage_events_org_created_idx
  on public.ai_usage_events (org_id, created_at);

alter table public.ai_usage_events enable row level security;

-- Members may read their org''s usage. No insert/update/delete policy: the
-- service-role admin client (which bypasses RLS) is the sole writer.
drop policy if exists ai_usage_events_select_member on public.ai_usage_events;
create policy ai_usage_events_select_member
  on public.ai_usage_events
  for select
  to authenticated
  using (org_id in (select public.current_user_orgs()));

-- ---------------------------------------------------------------------------
-- 2. ai_usage_summary(p_org) — current-month rollup for the usage dashboard
-- ---------------------------------------------------------------------------
create or replace function public.ai_usage_summary(p_org uuid)
returns table (
  query_count           bigint,
  input_tokens          bigint,
  output_tokens         bigint,
  cache_read_tokens     bigint,
  cache_creation_tokens bigint,
  by_model              jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with scoped as (
    select e.*
    from public.ai_usage_events e
    where e.org_id = p_org
      -- Membership guard: a non-member gets no rows (auth.uid() comes from the
      -- caller's JWT even under SECURITY DEFINER).
      and p_org in (select public.current_user_orgs())
      -- Current calendar month, UTC.
      and e.created_at >= date_trunc('month', now() at time zone 'utc')
  )
  select
    count(*)::bigint                                          as query_count,
    coalesce(sum(input_tokens), 0)::bigint                   as input_tokens,
    coalesce(sum(output_tokens), 0)::bigint                  as output_tokens,
    coalesce(sum(cache_read_tokens), 0)::bigint              as cache_read_tokens,
    coalesce(sum(cache_creation_tokens), 0)::bigint          as cache_creation_tokens,
    coalesce(
      (
        select jsonb_object_agg(m.model, m.tokens)
        from (
          select
            model,
            jsonb_build_object(
              'queryCount',          count(*),
              'inputTokens',         coalesce(sum(input_tokens), 0),
              'outputTokens',        coalesce(sum(output_tokens), 0),
              'cacheReadTokens',     coalesce(sum(cache_read_tokens), 0),
              'cacheCreationTokens', coalesce(sum(cache_creation_tokens), 0)
            ) as tokens
          from scoped
          group by model
        ) m
      ),
      '{}'::jsonb
    ) as by_model
  from scoped;
$$;

comment on function public.ai_usage_summary(uuid) is
  'Day 33. Current-month (UTC) AI usage rollup for an org: total query count,
   token totals, and a per-model breakdown (by_model jsonb). Membership enforced
   via current_user_orgs(); returns a single zero row for a non-member.';

revoke all on function public.ai_usage_summary(uuid) from public, anon;
grant execute on function public.ai_usage_summary(uuid) to authenticated;
