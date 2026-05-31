-- Feature flags — minimal global V1 (Day 7).
--
-- Global on/off switches read server-side to gate in-progress features. There is
-- no auth or org model yet (Phase 1), so flags are global for now. Per-org
-- targeting will add an org_id column + policy when organizations exist.
--
-- Security: lives in the exposed `public` schema, so RLS is mandatory. Flags are
-- non-secret config, so everyone (anon + authenticated) may READ; only the
-- service role (which bypasses RLS) may write, via migrations or admin tooling.

create table if not exists public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.feature_flags is
  'Global feature flags (Day 7). Read by src/lib/flags.ts. Per-org targeting deferred to Phase 1.';

-- Keep updated_at honest.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists feature_flags_set_updated_at on public.feature_flags;
create trigger feature_flags_set_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

-- RLS: public read, no public write.
alter table public.feature_flags enable row level security;

drop policy if exists "feature_flags_public_read" on public.feature_flags;
create policy "feature_flags_public_read"
  on public.feature_flags
  for select
  to anon, authenticated
  using (true);

-- Seed the flags Day 7 ships with. ON CONFLICT keeps re-runs idempotent and
-- never clobbers a value an operator has since toggled.
insert into public.feature_flags (key, enabled, description) values
  ('assistant',   false, 'Product 1 — AI Business Assistant (Phase 2)'),
  ('leads',       false, 'Product 2 — Lead Capture + AI Follow-Up (Phase 4)'),
  ('automations', false, 'Product 3 — Workflow Automation Hub (Phase 5)')
on conflict (key) do nothing;
