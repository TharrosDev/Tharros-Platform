-- Audit fix #3 — App-level rate limiting for email-sending actions
-- Backs a simple sliding-window throttle for the server actions that originate
-- email (password reset, resend-verification, team invites). Supabase rate-limits
-- its own auth-SMTP paths, but nothing else guarded against repeated triggering
-- (e.g. Resend-quota abuse via invites). Infra-free: a small events table + a
-- SECURITY DEFINER RPC, so it stays on the free tier (no Redis/Upstash).
--
-- Applied to the live DB via Supabase MCP execute_sql (NOT apply_migration) to
-- keep Supabase's own migration history clean; this file is the repo source of
-- truth. Must also be applied to the CI test project (psunqcyzjcmfgcrnowdl).

-- ---------------------------------------------------------------------------
-- rate_limit_events: one row per throttled attempt. `key` is an opaque caller-
-- supplied bucket (e.g. 'pwreset:<email>', 'invite:<userId>'). Rows are pruned
-- opportunistically by the RPC, so the table stays small. RLS enabled with NO
-- policies — the only writer/reader is the SECURITY DEFINER RPC below.
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limit_events (
  id         bigint generated always as identity primary key,
  key        text not null,
  created_at timestamptz not null default now()
);

alter table public.rate_limit_events enable row level security;

create index if not exists rate_limit_events_key_created_idx
  on public.rate_limit_events (key, created_at);

comment on table public.rate_limit_events is
  'Audit fix #3. Sliding-window rate-limit hits, keyed by an opaque bucket. Written/read only via check_rate_limit().';

-- ---------------------------------------------------------------------------
-- check_rate_limit(): records an attempt for p_key and reports whether it is
-- within the allowance. Prunes that key's rows older than the window first, then
-- counts the remaining (recent) rows; returns TRUE when the count is below
-- p_max (i.e. this attempt is allowed), FALSE when the limit is already reached.
-- Always inserts the attempt so bursts still count toward the window.
-- SECURITY DEFINER + pinned search_path so it writes the no-policy table.
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_key            text,
  p_max            int,
  p_window_seconds int
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz := now() - make_interval(secs => p_window_seconds);
  v_count  int;
begin
  if coalesce(btrim(p_key), '') = '' then
    raise exception 'rate-limit key is required' using errcode = 'check_violation';
  end if;

  -- Prune this key's expired rows so the table doesn't grow unbounded.
  delete from public.rate_limit_events
  where key = p_key and created_at < v_cutoff;

  select count(*) into v_count
  from public.rate_limit_events
  where key = p_key and created_at >= v_cutoff;

  insert into public.rate_limit_events (key) values (p_key);

  return v_count < p_max;
end;
$$;

comment on function public.check_rate_limit(text, int, int) is
  'Audit fix #3. Records an attempt for p_key; returns TRUE if within p_max per p_window_seconds, else FALSE.';

-- Granted to anon too: password-reset / resend-verification run for signed-out
-- callers (anon role), and those are precisely the flows we need to throttle.
-- The RPC only touches its own no-policy table and prunes per key, so the
-- direct-abuse surface is a bounded, self-pruning insert.
revoke execute on function public.check_rate_limit(text, int, int) from public;
grant  execute on function public.check_rate_limit(text, int, int) to anon, authenticated;
