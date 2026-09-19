-- The limiter is an application-internal primitive. Calling it directly through
-- PostgREST allowed unauthenticated clients to manufacture arbitrary unique
-- buckets and grow rate_limit_events outside the server's validated flows.
-- All application callers now invoke it through the service-role server client.

revoke execute on function public.check_rate_limit(text, int, int)
  from public, anon, authenticated;

comment on function public.check_rate_limit(text, int, int) is
  'Atomic server-only sliding-window limiter. Called through the service-role application seam; not exposed through PostgREST roles.';
