-- Harden the shared sliding-window rate limiter for concurrent public traffic.
-- The original function counted then inserted without serializing callers, so
-- simultaneous requests for one bucket could all observe the same count and
-- exceed the configured allowance. Lock only that bucket for the transaction.
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
  v_cutoff timestamptz;
  v_count  int;
begin
  if coalesce(btrim(p_key), '') = '' then
    raise exception 'rate-limit key is required' using errcode = 'check_violation';
  end if;
  if p_max <= 0 then
    raise exception 'rate-limit max must be positive' using errcode = 'check_violation';
  end if;
  if p_window_seconds <= 0 then
    raise exception 'rate-limit window must be positive' using errcode = 'check_violation';
  end if;

  -- Serialize only requests for the same logical bucket. Different users/forms
  -- continue concurrently.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_key, 0)
  );

  v_cutoff := now() - make_interval(secs => p_window_seconds);

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
  'Atomic sliding-window limiter. Serializes each opaque key with a transaction advisory lock before count+insert.';

revoke execute on function public.check_rate_limit(text, int, int) from public;
grant execute on function public.check_rate_limit(text, int, int) to anon, authenticated;
