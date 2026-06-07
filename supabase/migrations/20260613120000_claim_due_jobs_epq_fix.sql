-- Fix — claim_due_jobs could claim MORE than p_limit jobs under concurrency.
--
-- The Day-38 definition used the form:
--   update jobs set ... where id in (
--     select id ... order by run_at for update skip locked limit p_limit
--   ) returning *;
-- Under READ COMMITTED, when a concurrent transaction modifies a row the UPDATE is
-- about to lock, Postgres runs EvalPlanQual, which RE-EVALUATES the uncorrelated
-- `id in (subquery)` — re-running the `FOR UPDATE SKIP LOCKED ... LIMIT` against a
-- different lock state. The outer UPDATE can then match rows from both the original
-- and the re-evaluated id sets, claiming MORE than p_limit rows. With no concurrency
-- the limit always held (hence it only ever flaked in CI, where the e2e job + cron
-- worker hit the shared `jobs` table at the same time — symptom: claim_due_jobs(2)
-- returning 3+).
--
-- Fix: materialize the locked id set in a CTE first, then UPDATE ... FROM that CTE.
-- A CTE containing a locking clause is evaluated exactly once, so EvalPlanQual
-- re-checks `j.id = due.id` against the already-materialized set and can never
-- exceed the limit. This is the standard safe SKIP LOCKED queue-claim pattern.
--
-- Backward-compatible: same name/signature/return type, still SECURITY DEFINER with
-- search_path=''. Applied via Supabase MCP execute_sql to BOTH prod
-- (inxhrijqyxvwoeqczbrl) and the CI test project (psunqcyzjcmfgcrnowdl).

create or replace function public.claim_due_jobs(p_limit int default 25)
returns setof public.jobs
language sql
security definer
set search_path = ''
as $$
  with due as (
    select id
    from public.jobs
    where status = 'pending' and run_at <= now()
    order by run_at
    for update skip locked
    limit greatest(p_limit, 1)
  )
  update public.jobs j
  set status = 'running',
      attempts = j.attempts + 1,
      locked_at = now(),
      updated_at = now()
  from due
  where j.id = due.id
  returning j.*;
$$;

comment on function public.claim_due_jobs(int) is
  'Day 38 (hardened). Atomically claim up to p_limit due pending jobs
   (FOR UPDATE SKIP LOCKED, locked ids materialized in a CTE so the limit holds
   under concurrent EvalPlanQual), marking them running + incrementing attempts.
   Service-role worker only.';

revoke execute on function public.claim_due_jobs(int) from anon, authenticated, public;
