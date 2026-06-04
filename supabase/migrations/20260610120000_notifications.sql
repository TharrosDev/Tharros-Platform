-- Day 40 — Notification system (Phase 3 / AI Workforce Scheduling)
-- The channel-agnostic notification rail: one canonical event per recipient that
-- backs the in-app inbox AND tracks email delivery. The scheduling agents (and
-- later Lead Capture / billing) emit notifications; an outbound SMS/WhatsApp
-- adapter slots into the same row post-launch.
--
--   * notification_events — one row per (recipient user, notification). Always an
--     in-app inbox item (read_at); optionally also emailed, with the email
--     delivery tracked inline (email_status / email_error / email_sent_at). The
--     email send is performed by the Day-38 job runtime (`notification-send`
--     handler) so retries/backoff/at-least-once come for free.
--
-- RLS: a user sees + updates (mark read) + dismisses ONLY their own
-- notifications; rows are CREATED service-role only (system-generated — no user
-- insert policy), mirroring the deny-write tables. Org scope is belt-and-braces
-- on the recipient check via current_user_orgs().
--
-- Apply via Supabase MCP execute_sql (NOT apply_migration) to BOTH prod
-- (inxhrijqyxvwoeqczbrl) and the CI test project (psunqcyzjcmfgcrnowdl) so the
-- schemas stay in lockstep. This file is the repo source of truth.

create table if not exists public.notification_events (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  type          text not null,
  title         text not null,
  body          text not null,
  data          jsonb not null default '{}'::jsonb,
  read_at       timestamptz,
  -- email delivery (the second channel; 'none' = in-app only)
  email         boolean not null default false,
  email_status  text not null default 'none'
                  check (email_status in ('none', 'pending', 'sent', 'failed', 'skipped')),
  email_error   text,
  email_sent_at timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.notification_events enable row level security;

-- The inbox scan: a recipient's notifications, newest-first.
create index if not exists notification_events_user_created_idx
  on public.notification_events (user_id, created_at desc);
-- Unread badge count.
create index if not exists notification_events_user_unread_idx
  on public.notification_events (user_id)
  where read_at is null;
-- Org-wide scans (admin/analytics later).
create index if not exists notification_events_org_created_idx
  on public.notification_events (org_id, created_at desc);

comment on table public.notification_events is
  'Day 40. One notification per recipient user: an in-app inbox item (read_at) +
   optional email delivery tracked inline (email_status). System-created
   (service-role); a user may read/mark-read/dismiss only their own.';

-- ---------------------------------------------------------------------------
-- RLS — recipient-scoped. No INSERT policy: notifications are system-generated
-- by the service-role create path (mirrors subscriptions / ai_usage_events).
-- ---------------------------------------------------------------------------
drop policy if exists notification_events_select on public.notification_events;
create policy notification_events_select
  on public.notification_events
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id in (select public.current_user_orgs())
  );

-- A recipient may update their own row (to set read_at). The with-check keeps the
-- row theirs; column-level restriction isn't expressible in RLS, but the app only
-- writes read_at and the row never leaves the owner.
drop policy if exists notification_events_update on public.notification_events;
create policy notification_events_update
  on public.notification_events
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- A recipient may dismiss (delete) their own notification.
drop policy if exists notification_events_delete on public.notification_events;
create policy notification_events_delete
  on public.notification_events
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
