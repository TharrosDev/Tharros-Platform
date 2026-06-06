# Durable job runtime (Day 38)

A Postgres-backed queue for delayed/scheduled work (availability nudges, shift
reminders, replacement-offer timeouts, escalation timers). The DB owns durability
and atomic claiming; a TS worker route runs the handlers (they send email / call
Claude / run the solver, so they can't run in SQL).

## How it works

- **`public.jobs`** — the queue. Deny-all RLS; the service-role worker is the only
  reader/writer. Status: `pending → running → succeeded | failed`, with retries
  (`pending` again, backoff) and `dead` (exhausted `max_attempts`).
- **`claim_due_jobs(p_limit)`** — atomically claims due pending jobs
  (`FOR UPDATE SKIP LOCKED`), marks them `running`, increments `attempts`.
- **`reap_stuck_jobs(p_timeout)`** — requeues jobs stuck in `running` past the
  timeout (a crashed/timed-out worker); kills ones past `max_attempts`.
- **Worker:** `apps/web/src/lib/jobs/runner.ts` `runDueJobs()` — reap → claim →
  dispatch each via the `handlers.ts` registry → succeed / retry / dead.
- **Route:** `POST|GET /api/cron/jobs/run` — Bearer-`CRON_SECRET` auth; returns a
  `{reaped,claimed,succeeded,failed,dead}` summary. Excluded from the proxy gate.
- **Enqueue:** `enqueueJob(adminClient, { type, payload?, runAt?, maxAttempts?, orgId? })`.

**Delivery is at-least-once** (the reaper can re-run a stalled job) — handlers must
be **idempotent**. Add a real handler by registering it in `handlers.ts` and adding
its type to `JobType` in `types.ts`.

**Registered handlers:**
- `noop` (Day 38) — proves the loop end-to-end.
- `notification-send` (Day 40) — delivers the email channel of a `notification_events` row.
- `availability-nudge` (Day 45) — emails an employee a portal link to set their availability,
  and reschedules itself (every 3 days, up to 3 emails) until they do. Idempotent + self-
  terminating: no-ops the moment the employee has permanent availability. Enqueued by the
  manager action `requestAvailabilityNudge`, which mints the portal token first (the system
  can't); the handler reads the live token to build the link.

## Operator setup (the minutely tick)

The worker is ticked by **pg_cron → pg_net** (plan-independent minutely cadence,
unlike Vercel Cron which is daily-only off Pro). One-time setup on the **prod**
project after `CRON_SECRET` is set in Vercel (all envs):

1. Generate a strong secret and set it in Vercel: `CRON_SECRET`.
2. Store the same value in Supabase Vault and schedule the tick (via the SQL editor
   or MCP `execute_sql`):

```sql
select vault.create_secret('<the CRON_SECRET value>', 'cron_secret');

select cron.schedule('jobs-runner', '* * * * *', $$
  select net.http_post(
    url := 'https://tharros.ca/api/cron/jobs/run',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    )
  )
$$);
```

To change the secret later: update Vercel + `vault.update_secret`. To pause:
`select cron.unschedule('jobs-runner');`.

This is **prod-only** — the CI test project has no deployed URL. Until it's set up
the route returns `503` (no `CRON_SECRET`) and no jobs run; the queue is harmless
while idle.

## Verifying

```sh
# 503 without the secret configured; 401 with a wrong one; summary with the right one
curl -s -X POST https://tharros.ca/api/cron/jobs/run \
  -H "Authorization: Bearer $CRON_SECRET"
```

Enqueue a `noop` job (from a server context) and confirm the next minutely tick
flips it to `succeeded`.
