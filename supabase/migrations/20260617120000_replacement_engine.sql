-- Day 55 — Shift replacement engine (Phase 3G, disruption handling)
-- Closes the loop the Day-54 sick-call left open. When a shift is vacated, the
-- engine offers it to every eligible employee (the Day-41 `replacement_pool_events`
-- rows, written by the service role), and the FIRST to accept wins via the atomic
-- `claim_replacement_offer` RPC below. The losers' offers flip to 'expired' in the
-- same transaction; the originating sick-call resolves; a timeout job (TS,
-- Day-38 runtime) escalates to managers on no-fill.
--
-- The `replacement_pool_events` / `sick_call_events` / `shifts` tables, their RLS,
-- and the `scheduling_audit_log` already exist (Day 41); this migration adds only:
--   1. org_settings.replacement_policy — the configurable timeout + escalate toggle.
--   2. claim_replacement_offer() — the first-accept-wins atomic accept RPC.
--
-- RLS reuses public.current_user_orgs() / public.current_user_role(uuid). The new
-- RPC pins `set search_path = ''`, schema-qualifies everything, and revokes execute
-- from anon/authenticated/public (the service-role admin client is the only caller,
-- exactly like claim_due_jobs — the account-less portal action validates the
-- session in code, then calls this on the admin client).
--
-- Apply via Supabase MCP execute_sql (NOT apply_migration) to BOTH prod
-- (inxhrijqyxvwoeqczbrl) and the CI test project (psunqcyzjcmfgcrnowdl) so the
-- schemas stay in lockstep. This file is the repo source of truth.

-- ---------------------------------------------------------------------------
-- org_settings.replacement_policy: how the replacement engine fans out + escalates.
--   timeoutMinutes     — offers expire this many minutes after fan-out (capped at
--                        the shift start, computed in TS); the timeout job then
--                        escalates to managers.
--   escalateToManager  — whether a no-fill notifies owners/admins (always true in v1;
--                        the toggle is here for forward-compat).
-- jsonb so the shape can grow (mirrors agent_persona). Default applies to every org;
-- a settings-page control writes it (the Day-43 wizard RPC need not change).
-- ---------------------------------------------------------------------------
alter table public.org_settings
  add column if not exists replacement_policy jsonb not null
    default '{"timeoutMinutes": 120, "escalateToManager": true}'::jsonb;

comment on column public.org_settings.replacement_policy is
  'Day 55. Replacement engine config: { timeoutMinutes, escalateToManager }. Drives
   when an unfilled open shift escalates to managers.';

-- ---------------------------------------------------------------------------
-- claim_replacement_offer(): the FIRST-ACCEPT-WINS atomic accept. An employee (via
-- the auth-light portal, identity already validated in code) claims an offer to fill
-- an open shift. The shift row is the single contention point: it's locked FOR
-- UPDATE, so two concurrent claims serialize and exactly one sees status='open'.
-- The winner: assigns the shift (back to 'published'), accepts its offer, expires
-- the sibling offers, resolves the originating sick-call, and audits. A loser gets
-- outcome='already_filled'; a bad/expired/foreign offer gets 'invalid'.
--
-- SECURITY DEFINER so it can write the deny-/manager-only scheduling tables and the
-- service-role-write audit log atomically; called only by the admin client.
-- ---------------------------------------------------------------------------
create or replace function public.claim_replacement_offer(
  p_offer_id    uuid,
  p_employee_id uuid,
  p_org_id      uuid
)
returns table (outcome text, shift_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.replacement_pool_events;
  v_shift public.shifts;
begin
  -- Load the offer, scoped to the claiming employee + org. A missing row = a
  -- foreign/garbage offer id; never leak across orgs.
  select * into v_offer
  from public.replacement_pool_events
  where id = p_offer_id
    and employee_id = p_employee_id
    and org_id = p_org_id;

  if v_offer.id is null then
    outcome := 'invalid'; shift_id := null; return next; return;
  end if;
  if v_offer.status <> 'offered' then
    -- Already responded to (declined / expired / withdrawn / accepted).
    outcome := 'invalid'; shift_id := v_offer.shift_id; return next; return;
  end if;

  -- Lock the shift — the single contention point. Concurrent claims serialize here.
  select * into v_shift
  from public.shifts
  where id = v_offer.shift_id
  for update;

  if v_shift.id is null
     or v_shift.status <> 'open'
     or v_shift.employee_id is not null then
    -- Someone else already filled it (or it was cancelled / reassigned).
    outcome := 'already_filled'; shift_id := v_offer.shift_id; return next; return;
  end if;

  -- Winner. Assign the shift and reinstate it as published.
  update public.shifts
  set employee_id = p_employee_id,
      status      = 'published',
      updated_at  = now()
  where id = v_shift.id;

  -- Accept this offer; expire every other outstanding offer for the same shift.
  update public.replacement_pool_events
  set status = 'accepted', responded_at = now()
  where id = v_offer.id;

  update public.replacement_pool_events
  set status = 'expired', responded_at = coalesce(responded_at, now())
  where replacement_pool_events.shift_id = v_offer.shift_id
    and id <> v_offer.id
    and status = 'offered';

  -- Resolve the originating sick-call, if this offer came from one.
  if v_offer.sick_call_id is not null then
    update public.sick_call_events
    set status = 'resolved', resolution = 'replacement_found'
    where id = v_offer.sick_call_id;
  end if;

  insert into public.scheduling_audit_log
    (org_id, actor_type, actor_id, action, entity_type, entity_id, detail)
  values
    (p_org_id, 'employee', p_employee_id, 'replacement.accepted', 'shift', v_offer.shift_id,
     jsonb_build_object('offerId', v_offer.id, 'sickCallId', v_offer.sick_call_id));

  outcome := 'accepted'; shift_id := v_offer.shift_id; return next; return;
end;
$$;

comment on function public.claim_replacement_offer(uuid, uuid, uuid) is
  'Day 55. First-accept-wins atomic accept of a replacement offer: locks the shift
   row, assigns it to the winner, expires sibling offers, resolves the sick-call,
   audits. Returns outcome accepted|already_filled|invalid. Admin-client only.';

revoke execute on function public.claim_replacement_offer(uuid, uuid, uuid)
  from anon, authenticated, public;
