-- Day 56 — Shift swaps (Phase 3G, disruption handling)
-- Employee-initiated swaps: an employee proposes trading one of their shifts with a
-- coworker (a true two-shift trade), handing it off to a specific coworker, or
-- posting it as an open offer any eligible coworker can pick up. The agent validates
-- role/availability/labor (in TS, reusing the Day-55 eligibility checks); valid swaps
-- auto-apply, invalid ones escalate to a manager.
--
-- The `shift_swap_requests` table already exists (Day 41) with shift_id (X),
-- requesting_employee_id (A), target_employee_id (B, nullable = open offer), status,
-- reviewed_by/at, notes. This migration adds:
--   1. shift_swap_requests.target_shift_id — the counterpart shift Y (nullable =
--      handoff/open, no counter-shift).
--   2. org_settings.swap_policy — auto-approve / escalate config.
--   3. apply_shift_swap() — the atomic apply (locks both shifts, re-verifies, swaps).
--
-- The new RPC pins `set search_path = ''`, schema-qualifies EVERY column (the Day-55
-- lesson: a bare column matching a return/OUT name raises 42702 only on the write
-- path), and revokes execute from anon/authenticated/public (admin-client only,
-- mirroring claim_replacement_offer). The account-less portal validates the session
-- in code, then calls this on the service-role admin client.
--
-- Apply via Supabase MCP execute_sql (NOT apply_migration) to BOTH prod
-- (inxhrijqyxvwoeqczbrl) and the CI test project (psunqcyzjcmfgcrnowdl) so the
-- schemas stay in lockstep. This file is the repo source of truth.

-- ---------------------------------------------------------------------------
-- shift_swap_requests.target_shift_id — the coworker's counterpart shift (Y) in a
-- true trade. NULL = a handoff (give X away) or an open offer (no counter-shift).
-- ---------------------------------------------------------------------------
alter table public.shift_swap_requests
  add column if not exists target_shift_id uuid references public.shifts (id) on delete cascade;

create index if not exists shift_swap_requests_target_shift_idx
  on public.shift_swap_requests (target_shift_id);

comment on column public.shift_swap_requests.target_shift_id is
  'Day 56. The coworker''s counterpart shift (Y) in a two-shift trade. NULL = a handoff (give the shift away) or an open offer (no counter-shift).';

-- ---------------------------------------------------------------------------
-- org_settings.swap_policy — how swaps are approved.
--   autoApproveValid  — a swap that passes role/availability/labor validation
--                       applies immediately (else it escalates to a manager).
--   escalateInvalid   — an invalid swap notifies managers (always true in v1).
-- jsonb so the shape can grow (mirrors replacement_policy / agent_persona).
-- ---------------------------------------------------------------------------
alter table public.org_settings
  add column if not exists swap_policy jsonb not null
    default '{"autoApproveValid": true, "escalateInvalid": true}'::jsonb;

comment on column public.org_settings.swap_policy is
  'Day 56. Shift-swap config: { autoApproveValid, escalateInvalid }. Drives whether a valid swap auto-applies or every swap needs a manager.';

-- ---------------------------------------------------------------------------
-- apply_shift_swap(): the ATOMIC apply. Reassigns the shift(s) and marks the
-- request approved, in one transaction. Locks the shift row(s) FOR UPDATE ordered
-- by id (deadlock-safe) — the contention point that makes an open offer
-- first-accept-wins. Re-verifies the world hasn't moved (X still belongs to the
-- requester + published; Y, if any, still belongs to the claimant + published) and
-- returns 'stale' if it has. Eligibility (role/availability/labor) is validated in
-- TS BEFORE this call (same posture as claim_replacement_offer); this RPC only does
-- the atomic ownership-checked swap.
--
--   p_request_id  — the shift_swap_requests row
--   p_org_id      — guard against cross-org calls
--   p_claimant_id — the employee taking the requester's shift X. For a targeted
--                   swap this must equal target_employee_id; for an open offer it's
--                   whoever claimed it (and gets recorded as target_employee_id).
-- ---------------------------------------------------------------------------
create or replace function public.apply_shift_swap(
  p_request_id  uuid,
  p_org_id      uuid,
  p_claimant_id uuid
)
returns table (outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req   public.shift_swap_requests;
  v_x     public.shifts;
  v_y     public.shifts;
  v_first uuid;
begin
  -- Lock the request first so concurrent claims on an open offer serialize here.
  select * into v_req
  from public.shift_swap_requests
  where id = p_request_id
    and org_id = p_org_id
  for update;

  if v_req.id is null then
    outcome := 'invalid'; return next; return;
  end if;
  if v_req.status not in ('pending', 'accepted') then
    outcome := 'stale'; return next; return;   -- already approved/denied/cancelled
  end if;
  -- A targeted swap can only be applied by its named target; an open offer (null
  -- target) is claimed by p_claimant_id. Disallow the open + counter-shift combo.
  if v_req.target_employee_id is not null and v_req.target_employee_id <> p_claimant_id then
    outcome := 'invalid'; return next; return;
  end if;
  if v_req.target_employee_id is null and v_req.target_shift_id is not null then
    outcome := 'invalid'; return next; return;
  end if;

  -- Lock the shift row(s) FOR UPDATE, ordered by id, to avoid deadlocks.
  if v_req.target_shift_id is null then
    select * into v_x from public.shifts where id = v_req.shift_id for update;
  else
    v_first := least(v_req.shift_id, v_req.target_shift_id);
    perform 1 from public.shifts where id = v_first for update;
    perform 1 from public.shifts
      where id = greatest(v_req.shift_id, v_req.target_shift_id) for update;
    select * into v_x from public.shifts where id = v_req.shift_id;
    select * into v_y from public.shifts where id = v_req.target_shift_id;
  end if;

  -- Re-verify X: still the requester's, still published.
  if v_x.id is null
     or v_x.employee_id is distinct from v_req.requesting_employee_id
     or v_x.status <> 'published' then
    outcome := 'stale'; return next; return;
  end if;

  -- Two-shift trade: re-verify Y is the claimant's + published, then swap both.
  if v_req.target_shift_id is not null then
    if v_y.id is null
       or v_y.employee_id is distinct from p_claimant_id
       or v_y.status <> 'published' then
      outcome := 'stale'; return next; return;
    end if;
    update public.shifts set employee_id = p_claimant_id, updated_at = now()
      where shifts.id = v_x.id;
    update public.shifts set employee_id = v_req.requesting_employee_id, updated_at = now()
      where shifts.id = v_y.id;
  else
    -- Handoff / open offer: the claimant takes X; the requester gives it up.
    update public.shifts set employee_id = p_claimant_id, updated_at = now()
      where shifts.id = v_x.id;
  end if;

  update public.shift_swap_requests
  set status = 'approved',
      target_employee_id = p_claimant_id,
      reviewed_at = now()
  where shift_swap_requests.id = v_req.id;

  insert into public.scheduling_audit_log
    (org_id, actor_type, actor_id, action, entity_type, entity_id, detail)
  values
    (p_org_id, 'system', null, 'shift_swap.applied', 'shift', v_req.shift_id,
     jsonb_build_object(
       'requestId', v_req.id,
       'requestingEmployeeId', v_req.requesting_employee_id,
       'claimantId', p_claimant_id,
       'targetShiftId', v_req.target_shift_id
     ));

  outcome := 'applied'; return next; return;
end;
$$;

comment on function public.apply_shift_swap(uuid, uuid, uuid) is
  'Day 56. Atomic shift-swap apply: locks the shift row(s) FOR UPDATE (open offer = first-claim-wins), re-verifies ownership + published, reassigns (trade X<->Y / handoff X->claimant), marks the request approved. Returns outcome applied|stale|invalid. Admin-client only; eligibility validated in TS first.';

revoke execute on function public.apply_shift_swap(uuid, uuid, uuid)
  from anon, authenticated, public;
