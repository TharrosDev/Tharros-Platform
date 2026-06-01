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

## Notes / future

- **Playwright smoke test** is intentionally deferred (roadmap Day 14 listed it).
  Add a `playwright` job once there are real authed flows worth smoking; it'll
  need its own browser-install + cache step.
- GitHub Actions free tier (2,000 private minutes/mo) is ample for solo use — a
  run is well under 5 minutes.
