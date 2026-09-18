# @tharros/web

The production Tharros web application: Next.js 16 (App Router), React 19,
strict TypeScript, Tailwind v4, Supabase, Stripe, and the Workshop design system.

> **Framework note:** this repository uses a modified Next.js 16 build. Read
> `AGENTS.md` and the local framework docs before changing routing or proxy
> behavior. Middleware is `src/proxy.ts`, exporting `proxy()`, and
> `cookies()` from `next/headers` is asynchronous.

## Shipped product surfaces

- Dashboard and account workspace
- AI Business Assistant
- Knowledge/document ingestion and retrieval
- AI Workforce Scheduling
- Employee portal
- Notifications, profile, team and organization settings
- Billing and usage
- Internal feedback/admin workflow

`/leads` and `/automations` are roadmap surfaces, not shipped products yet.

## Getting started

```bash
pnpm install
pnpm --filter @tharros/web dev
```

Open http://localhost:3000.

Useful checks from the repository root:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --filter @tharros/web test:e2e
node scripts/contrast-check.mjs
```

Many Vitest suites make real calls to the dedicated Supabase test project.
Those tests require the Supabase test environment variables and are intentionally
serialized.

## Source layout

```
src/
  app/                  route groups, API routes and employee portal
  components/           product UI, shell and design-system components
  lib/
    assistant/          conversations, streaming protocol and generation
    documents/          upload, extraction, chunking, embeddings and retrieval
    scheduling/         solver, orchestration, calendar and disruption flows
    portal/             employee portal session and schedule operations
    billing/            plans, Stripe state and AI usage limits
    jobs/               durable job queue
    supabase/           user-session and service-role clients
  eval/                 offline RAG evaluation harness
  proxy.ts              session refresh and optimistic route protection
  env.ts                validated environment variables
```

## Documentation

- `../../README.md` — repository architecture and operations overview
- `../../PRODUCT.md` — authoritative product principles and shipped scope
- `docs/DESIGN.md` — Workshop design system
- `../../docs/CI.md` — CI and integration-test setup
- `../../docs/SECRETS.md` — environment configuration
- `../../docs/JOBS.md` — durable job runner operations
