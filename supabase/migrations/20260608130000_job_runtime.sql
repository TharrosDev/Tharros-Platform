-- Day 38 — Durable job runtime (Phase 3 / AI Workforce Scheduling)
-- A Postgres-backed queue for delayed/scheduled work the scheduling product needs
-- before n8n exists: availability nudges, shift reminders, replacement-offer
-- timeouts, escalation timers. The handlers run in TS (they send email / call
-- Claude / run the solver), so this is a queue DRIVEN BY a TS worker route — the
-- DB owns durability + atomic claiming, the app owns the handlers.
--
-- Tick: pg_cron runs every minute and net.http_post()s (pg_net) to the protected
-- /api/cron/jobs/run route, which claims due jobs and dispatches handlers. That
-- schedule is an operator step (needs the live URL + a Vault secret) — see
-- docs/JOBS.md — NOT in this migration, which is the portable schema source of truth.
--
-- Delivery is AT-LEAST-ONCE (the reaper can re-run a stalled job) → handlers must
-- be idempotent.
--
-- Applied via Supabase MCP execute_sql (NOT apply_migration) to BOTH prod
-- (inxhrijqyxvwoeqczbrl) and the CI test project (psunqcyzjcmfgcrnowdl).

-- pg_net: async HTTP from Postgres, used by the pg_cron tick to call the worker.
-- pg_cron is already enabled. Idempotent guard.
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- jobs: one row per unit of scheduled work. status lifecycle:
--   pending --claim--> running --success--> succeeded
--                              --failure--> pending (retry, backoff) | dead (max)
--   running --stall--> (reaper) pending | dead
-- org_id is nullable: most jobs are org-scoped, but platform-wide jobs are allowed.
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id           uuid primary key default gen_random_uuid(),
  type         text not null,
  payload      jsonb not null default '{}'::jsonb,
  status       text not null default 'pending'
                 check (status in ('pending', 'running', 'succeeded', 'failed', 'dead')),
  run_at       timestamptz not null default now(),
  attempts     int not null default 0,
  max_attempts int not null default 5,
  last_error   text,
  locked_at    timestamptz,
  org_id       uuid references public.organizations (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.jobs enable row level security;

-- The due-jobs scan: only pending rows, ordered by run_at.
create index if not exists jobs_due_idx
  on public.jobs (run_at)
  where status = 'pending';

-- The reaper scan: only rows still held by a (possibly dead) worker.
create index if not exists jobs_running_locked_idx
  on public.jobs (locked_at)
  where status = 'running';

comment on table public.jobs is
  'Day 38. Durable job queue. Service-role only (deny-all RLS); claimed atomically
   via claim_due_jobs (FOR UPDATE SKIP LOCKED) and ticked by pg_cron -> pg_net ->
   /api/cron/jobs/run. At-least-once; handlers must be idempotent.';

-- RLS: deny-all. No policies — the service-role worker is the only reader/writer,
-- exactly like stripe_events / rate_limit_events. (rls_enabled_no_policy INFO is expected.)
-- (RLS is enabled above; intentionally no policies are created.)

-- updated_at bump (reuses the shared trigger fn from the subscriptions migration).
drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- claim_due_jobs(): atomically claim up to p_limit due pending jobs and return
-- them as 'running'. FOR UPDATE SKIP LOCKED lets multiple concurrent workers
-- pull disjoint batches without blocking. Service-role only (the worker), so
-- execute is revoked from anon/authenticated/public.
-- ---------------------------------------------------------------------------
create or replace function public.claim_due_jobs(p_limit int default 25)
returns setof public.jobs
language sql
security definer
set search_path = ''
as $$
  update public.jobs j
  set status = 'running',
      attempts = j.attempts + 1,
      locked_at = now(),
      updated_at = now()
  where j.id in (
    select id from public.jobs
    where status = 'pending' and run_at <= now()
    order by run_at
    for update skip locked
    limit greatest(p_limit, 1)
  )
  returning j.*;
$$;

comment on function public.claim_due_jobs(int) is
  'Day 38. Atomically claim up to p_limit due pending jobs (FOR UPDATE SKIP LOCKED),
   marking them running + incrementing attempts. Service-role worker only.';

revoke execute on function public.claim_due_jobs(int) from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- reap_stuck_jobs(): recover jobs whose worker crashed/timed out mid-run — rows
-- left in 'running' with a stale locked_at. Under max_attempts → requeue now;
-- otherwise mark dead. Returns the number reaped. Called at the top of each tick.
-- ---------------------------------------------------------------------------
create or replace function public.reap_stuck_jobs(p_timeout interval default interval '5 minutes')
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  with reaped as (
    update public.jobs
    set status = case when attempts < max_attempts then 'pending' else 'dead' end,
        run_at = case when attempts < max_attempts then now() else run_at end,
        last_error = case
          when attempts < max_attempts then 'reaped: worker stalled, requeued'
          else 'reaped: stalled past max attempts'
        end,
        locked_at = null,
        updated_at = now()
    where status = 'running'
      and locked_at is not null
      and locked_at < now() - p_timeout
    returning 1
  )
  select count(*) into v_count from reaped;
  return v_count;
end;
$$;

comment on function public.reap_stuck_jobs(interval) is
  'Day 38. Requeue (or kill) jobs stuck in running past p_timeout — recovers a
   crashed/timed-out worker. Service-role only.';

revoke execute on function public.reap_stuck_jobs(interval) from anon, authenticated, public;
