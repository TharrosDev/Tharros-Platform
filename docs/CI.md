# Continuous Integration

The CI workflow is defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
and runs on every pull request and push to `main`.

## Quality signals

The workflow deliberately separates deterministic repository health from the
availability of the shared external integration-test project.

### `typecheck · lint · test · build`

This job always runs:

1. dependency installation with the locked pnpm version,
2. strict TypeScript checking,
3. ESLint,
4. deterministic Vitest unit suites via `test:unit`,
5. a production Next.js build.

Before the live Supabase-backed Vitest suite, CI resolves the hostname in
`TEST_SUPABASE_URL`.

- If the dedicated project is reachable, `test:integration` is a hard gate. A
  failing RLS/integration assertion fails CI.
- If the project is unavailable or the secret is missing, CI emits a warning and
  records the skipped live suite in the GitHub step summary. Typecheck, lint,
  deterministic unit tests and build still run, so an external outage does not
  hide ordinary source regressions.

A skipped live suite is **not release approval**. The test dependency must be
restored and the live suite must pass before production release.

### Playwright E2E

The browser job follows the same dependency preflight. It always installs the
application dependencies and runs a production build. Chromium installation and
the browser spine run only when the dedicated Supabase test project is
reachable.

The Playwright suite covers the auth/billing spine, scheduling spine and the
deterministic assistant spine. Provider-backed AI tails remain opt-in when their
provider keys are present.

## Dedicated Supabase test project

Live integration tests must use a dedicated non-production Supabase project.
The repository expects:

| Secret | Purpose |
| --- | --- |
| `TEST_SUPABASE_URL` | project API URL |
| `TEST_SUPABASE_PUBLISHABLE_KEY` | user-session test client |
| `TEST_SUPABASE_SECRET_KEY` | service-role fixture setup/teardown |

Keep its schema in lockstep with every migration under
`supabase/migrations/`. Never point these secrets at production.

The previously configured project used ref `psunqcyzjcmfgcrnowdl`. If that
project has been paused, deleted, or replaced, update all three GitHub secrets
together and apply the full migration chain before relying on the integration
signal.

## Stripe test configuration

The E2E job can additionally use test-mode Stripe values:

- `STRIPE_TEST_SECRET_KEY`
- `STRIPE_TEST_PUBLISHABLE_KEY`
- `STRIPE_TEST_PRICE_GROWTH`

No production Stripe key belongs in GitHub CI.

## Concurrency

All CI runs share one integration database and are serialized workflow-wide.
This prevents a PR run and a push-to-main run from deleting or mutating each
other's fixtures.

## Branch protection

Require the two named jobs before merging:

- `typecheck · lint · test · build`
- `e2e (playwright auth+billing spine)`

Because external-dependency outages can now produce a successful job with an
explicit skipped-integration warning, release procedure must also verify that
neither job summary reports a skipped live suite.
