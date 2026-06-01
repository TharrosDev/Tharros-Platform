-- Day 16 — Stripe billing data model.
-- Lays the schema the billing days build on: a Stripe Customer handle on each
-- organization and a per-org subscriptions table. The table is READ-ONLY to
-- users (member-read RLS, no user write policies) — it is written exclusively by
-- the service-role webhook handler in Day 18, which bypasses RLS. Day 17
-- (Checkout) and Day 19 (gating) read from here.
--
-- Applied to the live DB via Supabase MCP execute_sql (NOT apply_migration) to
-- keep Supabase's own migration history clean; this file is the repo source of
-- truth. Apply to BOTH prod (inxhrijqyxvwoeqczbrl) and the CI test project
-- (psunqcyzjcmfgcrnowdl) so the schemas stay in lockstep.

-- ---------------------------------------------------------------------------
-- organizations: the Stripe Customer for this org. One Customer per org (unique).
-- Set when Checkout first creates/uses a Customer (Day 17); used by the webhook
-- to map Stripe events back to an org. NULL until the org starts a checkout.
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists stripe_customer_id text unique;

comment on column public.organizations.stripe_customer_id is
  'Day 16. Stripe Customer id for this org (one per org). NULL until first checkout.';

create index if not exists organizations_stripe_customer_id_idx
  on public.organizations (stripe_customer_id);

-- ---------------------------------------------------------------------------
-- subscriptions: one row per org (org_id PK = at most one subscription per org).
-- Mirrors the slice of the Stripe Subscription the app needs to gate access and
-- render the billing page. status values mirror Stripe's Subscription.status set
-- (kept in sync with lib/billing/schemas.ts SUBSCRIPTION_STATUSES). tier mirrors
-- lib/billing/plans.ts. Populated by the Day-18 webhook (service role only).
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  org_id                 uuid primary key
                           references public.organizations (id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_customer_id     text,
  status                 text not null
                           check (status in (
                             'trialing', 'active', 'past_due', 'canceled',
                             'incomplete', 'incomplete_expired', 'unpaid', 'paused'
                           )),
  tier                   text check (tier in ('starter', 'growth', 'pro')),
  price_id               text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  trial_ends_at          timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.subscriptions is
  'Day 16. One row per org. App-side mirror of the Stripe Subscription; written only by the Day-18 service-role webhook. RLS: member read, no user writes.';

create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: members of the org may READ their subscription. There are deliberately NO
-- insert/update/delete policies — under RLS that denies all user writes; only the
-- service-role webhook (which bypasses RLS) mutates this table. Mirrors the
-- Day-12 org_settings member-read policy.
-- ---------------------------------------------------------------------------
alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select_member on public.subscriptions;
create policy subscriptions_select_member
  on public.subscriptions
  for select
  to authenticated
  using (org_id in (select public.current_user_orgs()));
