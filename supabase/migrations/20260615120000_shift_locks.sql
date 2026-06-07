-- Day 50 — Schedule calendar: shift lock state.
--
-- A locked shift is one a manager has pinned: manual edits to it are gated in the
-- UI, and a future re-solve / optimize pass must treat it as fixed (it flows into
-- the Day-46 solver's existing `lockedShifts` input). Persisting the flag — rather
-- than keeping it client-only — is what lets locks survive reloads and feed the
-- engine, so it's the foundation for Day 51 publish + the disruption workflows.
--
-- Manual lock toggles ride the existing Day-41 `shifts` manager-write RLS
-- (owner/admin), so no new policy is needed.

alter table public.shifts
  add column if not exists locked boolean not null default false;

comment on column public.shifts.locked is
  'Day 50 — manager-pinned shift. Manual edits are gated and a re-solve treats it as a fixed lockedShift.';
