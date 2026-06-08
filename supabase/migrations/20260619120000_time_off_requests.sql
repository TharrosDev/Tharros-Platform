-- Day 57 — Time-off requests (Phase 3G, disruption handling)
-- An employee requests leave (a date range) from the portal. The agent evaluates the
-- STAFFING IMPACT — which of the employee's published shifts fall in the window, and
-- whether each could be covered by an eligible coworker (reusing the Day-55 eligibility
-- checks in TS). A deterministic classifier bands the request low/medium/high; a
-- low-impact request auto-approves (per org policy), the rest land 'pending' with the
-- agent's recommendation for a manager. Managers retain final authority.
--
-- The `time_off_requests` table already exists (Day 41) with start_date, end_date,
-- reason, status (pending|approved|denied|cancelled), reviewed_by/at, and is already
-- covered by the Day-41 member-read / manager-write RLS loop. This migration is
-- ADDITIVE only:
--   1. org_settings.time_off_policy — auto-approve / escalate config (jsonb, mirrors
--      swap_policy / replacement_policy).
--   2. time_off_requests evaluation-trail columns — impact_band, impact_detail,
--      recommendation, thread_id, auto_decided.
--   3. A (org_id, status) index for the manager pane.
--
-- No new RPC: approval is a plain status update (no atomic shift reassignment — Day 57
-- flags conflicting shifts for the manager, it does NOT auto-vacate or fire the Day-55
-- replacement engine). No RLS changes (the portal writes go through the service-role
-- admin client, like sick-call / swaps).
--
-- Apply via Supabase MCP execute_sql (NOT apply_migration) to BOTH prod
-- (inxhrijqyxvwoeqczbrl) and the CI test project (psunqcyzjcmfgcrnowdl) so the schemas
-- stay in lockstep. This file is the repo source of truth.

-- ---------------------------------------------------------------------------
-- org_settings.time_off_policy — how leave requests are decided.
--   autoApproveLowImpact — a low-impact request (no conflicting shifts, or all
--                          conflicts have an eligible replacement) is approved
--                          immediately (else it stays pending for a manager).
--   escalateHighImpact   — a high-impact request notifies managers (always true v1).
-- jsonb so the shape can grow (mirrors swap_policy / replacement_policy / agent_persona).
-- ---------------------------------------------------------------------------
alter table public.org_settings
  add column if not exists time_off_policy jsonb not null
    default '{"autoApproveLowImpact": true, "escalateHighImpact": true}'::jsonb;

comment on column public.org_settings.time_off_policy is
  'Day 57. Time-off config: { autoApproveLowImpact, escalateHighImpact }. Drives whether a low-impact leave request auto-approves or waits for a manager.';

-- ---------------------------------------------------------------------------
-- time_off_requests — evaluation trail. The agent's staffing-impact assessment and
-- recommendation are persisted alongside the request so the manager pane can show
-- WHY it was auto-approved / escalated.
--   impact_band    — 'low' | 'medium' | 'high' (the deterministic classifier's verdict)
--   impact_detail  — { conflicts: [{ shiftId, startsAt, endsAt, eligibleCount }], ... }
--   recommendation — the agent's plain-language recommendation (best-effort; null if AI off)
--   thread_id      — the kind='time_off' takeover thread (Day 58 surfaces it)
--   auto_decided   — true when the policy auto-approved it (vs a manager / pending)
-- ---------------------------------------------------------------------------
alter table public.time_off_requests
  add column if not exists impact_band text
    check (impact_band in ('low', 'medium', 'high')),
  add column if not exists impact_detail jsonb not null default '{}'::jsonb,
  add column if not exists recommendation text,
  add column if not exists thread_id uuid
    references public.ai_conversation_threads (id) on delete set null,
  add column if not exists auto_decided boolean not null default false;

comment on column public.time_off_requests.impact_band is
  'Day 57. Deterministic staffing-impact band: low (coverable / no conflicts) | medium (partial cover) | high (an uncoverable conflict).';
comment on column public.time_off_requests.impact_detail is
  'Day 57. The per-shift conflict + coverage detail behind impact_band.';
comment on column public.time_off_requests.recommendation is
  'Day 57. The agent''s best-effort plain-language recommendation for the manager (null when AI is unavailable).';
comment on column public.time_off_requests.auto_decided is
  'Day 57. True when org policy auto-approved this request (low impact); false when it awaited / got a manual decision.';

-- Manager pane reads pending (and recently decided) requests per org.
create index if not exists time_off_requests_status_idx
  on public.time_off_requests (org_id, status);
