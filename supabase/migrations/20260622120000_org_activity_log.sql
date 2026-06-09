-- Day 62 — Audit log / full traceability surfacing (Phase 3H).
-- A read-only, owner/admin-gated SECURITY DEFINER RPC that merges the two
-- append-only audit trails into ONE chronological feed the dashboard renders:
--   * agent_audit_log  (Day 39) — every AI decision on an agent thread
--     (turn_started, model_call, tool_invoked, takeover, optimize steps, …).
--     DENY-ALL RLS (service-role only), so a definer RPC is the ONLY way to
--     surface it to a human — hence this function.
--   * scheduling_audit_log (Day 41) — every schedule change (schedule.published,
--     shift.reassigned, replacement.accepted/conflict, swap.*, sick_call.*, …).
--     Member-read already, but unified here so one cursor pages both.
--
-- Gating: owner/admin only (via current_user_role) — the agent trail exposes
-- model calls + internal tool steps, so it's a management/compliance view, not a
-- member one. A non-manager (or non-member) gets zero rows: the `allowed` CTE is
-- empty, so both UNION arms join to nothing.
--
-- Pagination: newest-first, keyset on `created_at` via p_before (pass the last
-- row's created_at to load older). p_limit is clamped to [1, 200].
--
-- Follows the project RPC convention: `set search_path = ''`, schema-qualified,
-- execute revoked from anon/public. Apply via Supabase MCP execute_sql to BOTH
-- prod (inxhrijqyxvwoeqczbrl) and the CI test project (psunqcyzjcmfgcrnowdl).
-- This file is the repo source of truth.

create or replace function public.org_activity_log(
  p_org    uuid,
  p_limit  integer default 50,
  p_before timestamptz default null
)
returns table (
  id          uuid,
  source      text,
  actor       text,
  action      text,
  entity_type text,
  entity_id   uuid,
  model       text,
  detail      jsonb,
  created_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with allowed as (
    -- Owner/admin of the org only. Empty for everyone else → no rows below.
    select p_org as org
    where public.current_user_role(p_org) in ('owner', 'admin')
  ),
  bound as (
    select coalesce(p_before, 'infinity'::timestamptz) as before,
           least(greatest(coalesce(p_limit, 50), 1), 200) as lim
  ),
  merged as (
    select
      a.id,
      'agent'::text       as source,
      a.actor,
      a.action,
      'thread'::text      as entity_type,
      a.thread_id         as entity_id,
      a.model,
      a.detail,
      a.created_at
    from public.agent_audit_log a, allowed, bound
    where a.org_id = allowed.org
      and a.created_at < bound.before

    union all

    select
      s.id,
      'schedule'::text    as source,
      s.actor_type        as actor,
      s.action,
      s.entity_type,
      s.entity_id,
      null::text          as model,
      s.detail,
      s.created_at
    from public.scheduling_audit_log s, allowed, bound
    where s.org_id = allowed.org
      and s.created_at < bound.before
  )
  select id, source, actor, action, entity_type, entity_id, model, detail, created_at
  from merged
  order by created_at desc, id desc
  limit (select lim from bound);
$$;

comment on function public.org_activity_log(uuid, integer, timestamptz) is
  'Day 62. Owner/admin-gated unified audit feed: merges agent_audit_log (deny-all;
   AI decisions) + scheduling_audit_log (schedule changes) into one newest-first,
   keyset-paginated (p_before on created_at) stream. SECURITY DEFINER — the only
   read path to the deny-all agent trail. Non-manager/non-member gets no rows.';

revoke all on function public.org_activity_log(uuid, integer, timestamptz) from public, anon;
grant execute on function public.org_activity_log(uuid, integer, timestamptz) to authenticated;
