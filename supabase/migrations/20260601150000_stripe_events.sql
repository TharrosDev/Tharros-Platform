-- Day 18 — Stripe webhook idempotency ledger.
-- One row per Stripe event the webhook has successfully processed. The handler
-- skips any event id already present here, so Stripe's at-least-once delivery
-- (and manual re-sends) can't double-apply. Written only by the service-role
-- webhook; users never touch it.
--
-- Applied to the live DB via Supabase MCP execute_sql (NOT apply_migration) to
-- keep Supabase's own migration history clean; this file is the repo source of
-- truth. Apply to BOTH prod (inxhrijqyxvwoeqczbrl) and the CI test project
-- (psunqcyzjcmfgcrnowdl).

create table if not exists public.stripe_events (
  id          text primary key,                       -- Stripe event id (evt_...)
  type        text not null,
  received_at timestamptz not null default now()
);

comment on table public.stripe_events is
  'Day 18. Processed Stripe webhook event ids — the idempotency ledger. Service-role writes only.';

-- RLS on with NO policies = deny-all to anon/authenticated. The service-role key
-- (Day-18 webhook) bypasses RLS; no user ever reads or writes this table.
alter table public.stripe_events enable row level security;
