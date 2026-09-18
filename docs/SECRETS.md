# Secrets and environment variables

This is the production configuration contract for Tharros.

Real values belong in the Vercel project environment and, for local development,
in the gitignored `apps/web/.env.local`. Committed env files contain placeholders
only.

`apps/web/src/env.ts` validates the contract at build/boot. Missing required
values fail fast. `NEXT_PUBLIC_*` values are browser-visible; every other key is
server-only.

## Required production values

| Variable | Service | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Tharros | canonical public origin |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | browser/server project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase | RLS-respecting session client |
| `SUPABASE_SECRET_KEY` | Supabase | server-only privileged operations |
| `ANTHROPIC_API_KEY` | Anthropic | assistant generation |
| `OPENAI_API_KEY` | OpenAI | document embeddings |
| `DEEPSEEK_API_KEY` | DeepSeek | scheduling parsing and judging |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe | Checkout client |
| `STRIPE_SECRET_KEY` | Stripe | server billing operations |
| `STRIPE_WEBHOOK_SECRET` | Stripe | webhook signature verification |
| `RESEND_API_KEY` | Resend | transactional email |
| `CRON_SECRET` | Tharros jobs worker | authenticates durable-job ticks |

The deployed product should not be treated as ready while any of these is
missing. `/api/health` reports the shipped runtime configuration as
`incomplete` when required runtime values are absent.

## Optional values

- `EMAIL_FROM` overrides the default Tharros sender identity.
- `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, and `STRIPE_PRICE_PRO`
  provide direct Price IDs. Stable Stripe lookup keys remain the fallback.
- `NEXT_PUBLIC_SENTRY_DSN` enables runtime Sentry reporting.
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` enable build-time
  source-map upload.

Keys for unshipped connector/workflow products are intentionally not part of the
production env contract.

## Rotation

1. Create the replacement credential at the provider without revoking the old one.
2. Update Vercel Production, Preview, and Development environments.
3. Update the local `.env.local` if needed.
4. Redeploy and verify `/api/health`, authentication, billing, AI, scheduling,
   email, and jobs.
5. Revoke the old credential.

## Turborepo strict env mode

A variable read at build time must also appear in the `build.env` list in
`turbo.json`. When adding or removing a build-time variable, update
`src/env.ts`, `turbo.json`, `.env.example`, and this file together.

## Rules

- Never commit a real secret.
- Never expose service-role, provider, webhook, or cron credentials to client
  components.
- Never point CI integration credentials at the production Supabase project.
- Rotate a credential immediately if it appears in source control, logs, issue
  text, screenshots, or other public material.
