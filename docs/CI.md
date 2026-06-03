# Continuous Integration (Day 14)

The quality gate that runs on every pull request and every push to `main`.
Defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## What it runs

A single `ci` job on `ubuntu-latest`, sequentially:

1. **Install** — `pnpm install --frozen-lockfile` (pnpm version pinned by
   `packageManager` in the root `package.json`; pnpm store cached by
   `actions/setup-node`).
2. **Typecheck** — `pnpm typecheck` → `tsc --noEmit`.
3. **Lint** — `pnpm lint` → `eslint`.
4. **Test** — `pnpm test` → the Vitest RLS + org isolation harness
   (`apps/web/src/lib/**/__tests__`). These do **real Supabase round-trips** —
   they sign up and tear down their own auth users — so they run against a
   dedicated **test** project, never prod. Runs are self-cleaning (unique emails,
   teardown in `afterAll`).
5. **Build** — `pnpm build` → `next build` with `SKIP_ENV_VALIDATION=true`.

A newer push to the same ref cancels the in-flight run (`concurrency`).

## The test Supabase project

CI talks to a separate, free Supabase project so test traffic never touches
production data.

- **Project:** `tharros-platform-ci-test` (ref `psunqcyzjcmfgcrnowdl`, ca-central-1).
- **Schema:** the five repo migrations applied in order — identical to prod.
  Re-apply with the Supabase MCP / SQL editor if a new migration lands (keep this
  project in lockstep with `supabase/migrations/`).
- Freeing the free-tier slot for it required **pausing** the unused
  `TharrosDev's Project` (held only legacy marketing-site brief data; the site was
  de-domained 2026-05-31). Restore it from the Supabase dashboard if ever needed.

> **When you add a migration:** apply it to `psunqcyzjcmfgcrnowdl` too, or the
> RLS harness will fail in CI against a stale schema.

## Required GitHub repository secrets

Set these under **Settings → Secrets and variables → Actions → New repository
secret** (`TharrosDev/Tharros-Platform`). All three come from the **test**
project's dashboard, **not** prod:

| Secret | Value | Where to get it |
|---|---|---|
| `TEST_SUPABASE_URL` | `https://psunqcyzjcmfgcrnowdl.supabase.co` | Dashboard → Project Settings → Data API |
| `TEST_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_TCvjEi2lyxq9j63bcQOOig_GYG9Xe9v` | Dashboard → Project Settings → API Keys → Publishable |
| `TEST_SUPABASE_SECRET_KEY` | the **secret** (service-role) key | Dashboard → Project Settings → API Keys → Secret/`service_role` — reveal + copy |

The secret key is service-role and bypasses RLS; it is only used to seed/tear
down fixtures in the test project. It is never fetchable via tooling — copy it
from the dashboard by hand. The build step needs no production secrets
(`SKIP_ENV_VALIDATION` skips the `env.ts` checks; those keys live in Vercel).

`gh` one-liners (run from the repo, requires `gh auth login`):

```sh
gh secret set TEST_SUPABASE_URL --body "https://psunqcyzjcmfgcrnowdl.supabase.co"
gh secret set TEST_SUPABASE_PUBLISHABLE_KEY --body "sb_publishable_TCvjEi2lyxq9j63bcQOOig_GYG9Xe9v"
gh secret set TEST_SUPABASE_SECRET_KEY --body "<paste service-role key>"
```

## Branch protection (gate merges on green)

Make the check required so red PRs can't merge. **Settings → Branches → Add
branch ruleset** (or classic branch protection) for `main`:

1. **Require status checks to pass before merging** → add the
   **`typecheck · lint · test · build`** check (it appears in the list after the
   workflow has run at least once).
2. **Require a pull request before merging** (recommended for a solo dev too — it
   forces the check to run before `main` moves).

## The `e2e` job (Day 22 — Playwright auth+billing spine)

A second job, `e2e (playwright auth+billing spine)`, runs the browser-level
end-to-end "spine" defined in `apps/web/e2e/auth-billing.spec.ts`
(`playwright.config.ts`). It walks the real UI through the whole funnel —
**signup → confirm → onboarding → invite → accept → gated → subscribe-loads →
active → cancel** — in one ordered story.

Steps: install → `playwright install --with-deps chromium` → `pnpm build` →
`pnpm --filter @tharros/web test:e2e` (Playwright's `webServer` boots the built
app with `next start`). The Playwright HTML report is uploaded as an artifact.

Like the Vitest harness, it runs against the **test** Supabase project and is
self-cleaning. Subscription state is seeded service-side (mirrors the Day-18
webhook), so the Day-19 gate flips deterministically — **no Stripe Checkout
iframe is completed**, which keeps the run fast and non-flaky.

### Required / optional secrets for `e2e`

It reuses the three `TEST_SUPABASE_*` secrets above. The Stripe secrets are
**optional** — without them the checkout container still mounts (the assertion
passes); with them the embedded Stripe iframe actually loads. All are **test
mode**, low-risk:

| Secret | Required? | Value |
|---|---|---|
| `TEST_SUPABASE_URL` / `TEST_SUPABASE_PUBLISHABLE_KEY` / `TEST_SUPABASE_SECRET_KEY` | yes | same as the `ci` job |
| `STRIPE_TEST_SECRET_KEY` | optional | `sk_test_…` |
| `STRIPE_TEST_PUBLISHABLE_KEY` | optional | `pk_test_…` |
| `STRIPE_TEST_PRICE_GROWTH` | optional | the Growth `price_…` (test) |
| `OPENAI_API_KEY` | optional | enables the assistant spine's live tail (real ingest) |
| `ANTHROPIC_API_KEY` | optional | enables the assistant spine's live tail (real Claude answer + draft) |

`RESEND_API_KEY` is set to a placeholder in the workflow — the invite email is
allowed to fail because the spine reads the invite token from the DB.

### The assistant spine (Day 36 — `apps/web/e2e/assistant.spec.ts`)

`test:e2e` runs every spec in `apps/web/e2e/`, so the same job also runs the
**AI Assistant spine**: upload → ingest → query → cited answer → draft email.
Like the billing spine it is **two layers**. The always-on **deterministic core**
seeds the same ground truth the real pipeline writes (a `ready` document, a cited
conversation) and asserts the knowledge/assistant UI + persistence — green with
only the `TEST_SUPABASE_*` secrets. A **live tail** (`test.skip` unless both
`OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are set) does a genuine upload→ingest
→answer→draft run; it spends provider tokens, so it stays skipped in the default
keyless CI run and only fires on a keyed run (locally or with the optional
secrets above).

```sh
gh secret set STRIPE_TEST_SECRET_KEY --body "sk_test_…"
gh secret set STRIPE_TEST_PUBLISHABLE_KEY --body "pk_test_…"
gh secret set STRIPE_TEST_PRICE_GROWTH --body "price_…"
```

### Running the spine locally

```sh
pnpm --filter @tharros/web exec playwright install chromium
pnpm --filter @tharros/web build
pnpm --filter @tharros/web test:e2e   # webServer runs `next start`
```

Point your `.env.local` at the **test** project (not prod) for a clean run;
`NEXT_PUBLIC_SITE_URL` doesn't matter for the spine (it bypasses email links).

## Notes / future

- When branch protection is enabled, add **both** the `typecheck · lint · test ·
  build` and the `e2e (playwright auth+billing spine)` checks as required.
- GitHub Actions free tier (2,000 private minutes/mo) is ample for solo use — the
  quality gate is under 5 minutes; the e2e job adds a browser install + build.
