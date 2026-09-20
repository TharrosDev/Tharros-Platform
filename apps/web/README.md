# @tharros/web

Production Tharros web application: Next.js 16, React 19, strict TypeScript,
Tailwind v4, Supabase, Stripe, and the Strip Board design system.

> Read `AGENTS.md` before framework-level work. This repository uses a modified
> Next.js 16 build; middleware is `src/proxy.ts` and `cookies()` is async.

## Shipped product surfaces

- Dashboard and organization workspace
- AI Business Assistant + Knowledge
- AI Workforce Scheduling + employee portal
- Lead Capture pipeline, public forms/API, notes and AI follow-up drafts
- Native Automations + durable run history/manual test runs
- Notifications, profile, organization/team settings, billing and usage
- Internal feedback/admin workflow
- Public pricing, security, privacy and terms

## Getting started

```bash
pnpm install
pnpm --filter @tharros/web dev
```

Open http://localhost:3000.

Useful checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --filter @tharros/web test:e2e
node scripts/contrast-check.mjs
```

## Source layout

```
src/
  app/                  routes, APIs, public lead forms, employee portal
  components/           product UI, shell and design-system components
  lib/
    assistant/          conversations, streaming protocol and generation
    documents/          extraction, chunking, embeddings and retrieval
    scheduling/         solver, orchestration, calendar and disruption flows
    leads/              capture, CRM lifecycle, notes/events and AI drafts
    automations/        workflow CRUD, execution queries and job handler
    portal/             employee portal session and schedule operations
    billing/            plans, Stripe state, feature gates and AI limits
    jobs/               durable database-backed job queue
    supabase/           user-session and service-role clients
  eval/                 offline RAG evaluation harness
  proxy.ts              session refresh and optimistic route protection
  env.ts                validated environment contract
```

## Documentation

- `../../README.md` — repository/architecture overview
- `../../PRODUCT.md` — authoritative shipped product scope
- `docs/DESIGN.md` — the Strip Board design system
- `../../docs/CI.md` — CI and integration-test setup
- `../../docs/SECRETS.md` — production configuration
- `../../docs/JOBS.md` — durable job runner operations
