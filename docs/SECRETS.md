# Secrets & Environment Variables

The single reference for every external-service key the platform uses: what it is,
where it comes from, and how to rotate it.

## Where values live

Real values exist in exactly two places — **never in git**:

1. **Vercel project env** (authoritative) — project `tharros-platform`, set for
   **Production**, **Preview**, and **Development**. Manage via the Vercel dashboard
   or `vercel env ls / add / rm` (run from `apps/web/`).
2. **`apps/web/.env.local`** (gitignored) — local-dev copy. Pull the latest from
   Vercel with `vercel env pull apps/web/.env.local` from the repo, or fill from
   `apps/web/.env.example`.

`apps/web/.env.example` is the only env file committed to git, and it contains
**placeholder values only**. The env is validated at build/boot by
`apps/web/src/env.ts` (`@t3-oss/env-nextjs` + zod) — a missing/empty **required**
key fails the build with a named error rather than a runtime crash.

> `NEXT_PUBLIC_*` keys are bundled into the browser. Everything else is server-only
> and must never be imported into a Client Component.

## Inventory

| Variable | Scope | Service | Required | Where to obtain / rotate | Activated |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase | yes | Dashboard → Project Settings → Data API | Day 3 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | client | Supabase | yes | Dashboard → Project Settings → API Keys → Publishable | Day 3 |
| `SUPABASE_SECRET_KEY` | server | Supabase | yes | Dashboard → Project Settings → API Keys → Secret keys (⚠️ bypasses RLS) | Day 4 |
| `ANTHROPIC_API_KEY` | server | Anthropic | yes | console.anthropic.com → Settings → API Keys | Day 4 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | client | Stripe | yes | Stripe Dashboard (test mode) → Developers → API keys | Day 4 |
| `STRIPE_SECRET_KEY` | server | Stripe | yes | Stripe Dashboard (test mode) → Developers → API keys → Reveal | Day 4 |
| `STRIPE_WEBHOOK_SECRET` | server | Stripe | no (optional) | Stripe Dashboard → Developers → Webhooks → signing secret | Day 16 |
| `NANGO_SECRET_KEY` | server | Nango | no (optional) | Nango dashboard (self-hosted vs Cloud TBD) | Day 35 |
| `NEXT_PUBLIC_NANGO_PUBLIC_KEY` | client | Nango | no (optional) | Nango dashboard | Day 35 |
| `N8N_BASE_URL` | server | n8n | no (optional) | n8n instance URL (host TBD: self-host vs Cloud) | Day 41 |
| `N8N_API_KEY` | server | n8n | no (optional) | n8n → Settings → API | Day 41 |
| `DEEPSEEK_API_KEY` | server | DeepSeek | no (optional) | platform.deepseek.com → API keys (provider for ALL scheduling AI) | Day 45 |

"Optional" keys are reserved as placeholders in `env.ts` and `.env.example`; they
become required when their phase lands. Promote a key from optional → required in
`apps/web/src/env.ts` only **after** its value is set in Vercel for all three
environments, or the next deploy will fail validation.

## Rotation

1. Generate a new key in the provider's dashboard (keep the old one live).
2. Update all three Vercel environments: `vercel env rm NAME <env>` then
   `vercel env add NAME <env>` (or edit in the dashboard). For Preview "all branches",
   the CLI 54.x requires the REST API — see the note below.
3. Update `apps/web/.env.local` locally.
4. Redeploy; confirm green; then revoke the old key in the provider's dashboard.

## Notes / gotchas

- **Stripe is in test mode.** Live-mode keys are swapped in during Phase 8 (Day 91).
- **Vercel CLI 54.6.1 cannot add a Preview var for "all branches" non-interactively**
  (it returns `git_branch_required` even with `--yes`). Use the REST API instead:
  `MSYS_NO_PATHCONV=1 vercel api "/v10/projects/<id>/env?teamId=<team>" -X POST --input body.json`
  where `body.json` is `{"key":...,"value":...,"type":"encrypted","target":["preview"]}`.
  Production and Development add fine via `printf %s "$value" | vercel env add NAME <env>`.
- **Turborepo strict env mode:** any var read at **build time** (e.g. via
  `src/env.ts`, which `next.config.ts` imports) must be listed in the `build`
  task's `env` array in `turbo.json`, or Turbo strips it from the build and
  validation fails on Vercel with "received undefined". `NEXT_PUBLIC_*` vars are
  auto-inferred but are listed explicitly there too. Add new build-time keys to
  both `env.ts` and `turbo.json`.
- **Never paste a secret into a committed file, a log, or a PR.** `.env.example`
  carries placeholders only.
