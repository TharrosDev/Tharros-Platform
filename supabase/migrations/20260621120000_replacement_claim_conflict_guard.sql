-- Day 60 — Edge-case hardening: close the simultaneous-call-out double-booking
-- race in claim_replacement_offer.
--
-- THE BUG. The Day-55 first-accept-wins claim locks only the TARGET shift row
-- (FOR UPDATE), so two concurrent claims for the *same* shift serialize correctly.
-- But when two DIFFERENT shifts go open at once (two simultaneous sick-calls) and
-- their times overlap, the same eligible employee can be offered BOTH. Accepting
-- both runs two claims that lock two *different* shift rows — they never contend —
-- and each one only checks its own shift, never the employee's other assignments.
-- Result: the employee is assigned two overlapping shifts (a double-booking the
-- whole engine is supposed to make impossible).
--
-- THE FIX. Three additions, all inside the existing atomic function:
--   1. pg_advisory_xact_lock keyed on the claiming employee → all claims by the
--      same employee serialize (different employees use different keys and never
--      contend), so the second claim sees the first's committed assignment.
--   2. After locking the target shift, reject if the employee already holds a
--      non-cancelled shift overlapping this one → new outcome 'conflict'; the
--      offer is expired so it can't be retried.
--   3. Reject a shift whose start time has already passed (a stale offer the
--      timeout job hadn't expired yet) → 'already_filled'.
--
-- Everything else (assign + reinstate, expire siblings, resolve the sick-call,
-- audit) is unchanged. Idempotent create-or-replace.
--
-- Apply via Supabase MCP execute_sql to BOTH prod (inxhrijqyxvwoeqczbrl) and the
-- CI test project (psunqcyzjcmfgcrnowdl). This file is the repo source of truth.

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
  -- Serialize all concurrent claims by THIS employee (txn-scoped; released on
  -- commit/rollback). Different employees hash to different keys and don't block
  -- each other — only the same employee's parallel accepts are forced in order,
  -- so the overlap check below sees any sibling assignment this employee just won.
  perform pg_advisory_xact_lock(hashtext('replacement_claim:' || p_employee_id::text));

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

  -- Lock the shift — the single contention point for the SAME shift. Concurrent
  -- claims for this shift serialize here.
  select * into v_shift
  from public.shifts
  where id = v_offer.shift_id
  for update;

  if v_shift.id is null
     or v_shift.status <> 'open'
     or v_shift.employee_id is not null
     or v_shift.starts_at <= now() then
    -- Filled / cancelled / reassigned, or the shift has already started.
    outcome := 'already_filled'; shift_id := v_offer.shift_id; return next; return;
  end if;

  -- NEW: would taking this shift double-book the employee? Reject if they already
  -- hold a non-cancelled shift that overlaps this one (the simultaneous-call-out
  -- race). The advisory lock above makes this check see committed siblings.
  if exists (
    select 1
    from public.shifts s2
    where s2.employee_id = p_employee_id
      and s2.org_id = p_org_id
      and s2.id <> v_shift.id
      and s2.status in ('published', 'draft')
      and s2.starts_at < v_shift.ends_at
      and s2.ends_at > v_shift.starts_at
  ) then
    -- Expire this offer so it can't be retried; leave the shift open for others.
    update public.replacement_pool_events
    set status = 'expired', responded_at = now()
    where id = v_offer.id;

    insert into public.scheduling_audit_log
      (org_id, actor_type, actor_id, action, entity_type, entity_id, detail)
    values
      (p_org_id, 'employee', p_employee_id, 'replacement.conflict', 'shift', v_offer.shift_id,
       jsonb_build_object('offerId', v_offer.id, 'reason', 'overlapping_shift'));

    outcome := 'conflict'; shift_id := v_offer.shift_id; return next; return;
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
  'Day 55 (hardened Day 60). First-accept-wins atomic accept of a replacement
   offer: per-employee advisory lock serializes an employee''s concurrent claims;
   locks the shift row; rejects an already-filled/past shift (already_filled) or
   one that would double-book the employee against an overlapping shift
   (conflict); otherwise assigns it, expires sibling offers, resolves the
   sick-call, audits. Returns accepted|already_filled|conflict|invalid.';
