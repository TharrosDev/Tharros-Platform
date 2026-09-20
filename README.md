# Tharros Platform

**The AI operating workspace for small businesses.**

Tharros ships four connected products:

- **AI Business Assistant** — grounded answers and generation over uploaded
  business knowledge with citations.
- **AI Workforce Scheduling** — setup, availability, schedule generation,
  review/publishing, employee self-service, disruption handling, analytics and
  activity history.
- **Lead Capture** — public capture forms/API, manual lead entry, a live
  pipeline, timelines, internal notes and human-reviewed AI follow-up drafts.
- **Native Automations** — durable lead-event workflows with execution history,
  manager notifications, pipeline actions and AI draft preparation.

External SaaS connectors are intentionally outside the current shipped scope.

Production: [tharros.ca](https://tharros.ca)

## Stack

- **Turborepo** + **pnpm** workspaces
- **Next.js 16**, React 19, strict TypeScript, Tailwind CSS v4
- **Supabase** Postgres/Auth/Storage/pgvector with Row-Level Security
- **Stripe** subscriptions and plan-aware AI usage limits
- **Anthropic Claude** for grounded generation and lead follow-up drafting
- **OpenAI embeddings** for document retrieval
- **DeepSeek** for structured scheduling tasks and candidate judging
- **Resend** + React Email for transactional email
- Durable **Postgres jobs queue** driven by pg_cron/pg_net
- **Sentry**, Vercel, Vitest and Playwright

> The web app uses a modified Next.js 16 build. Read
> [`apps/web/AGENTS.md`](apps/web/AGENTS.md) before changing framework-level
> routing or proxy behavior.

## Repository layout

```
apps/web/              Next.js application
  src/app/             route groups, APIs, public lead forms and employee portal
  src/components/      Strip Board UI system and product components
  src/lib/             domain logic and infrastructure seams
  src/eval/            RAG evaluation harness
  e2e/                 Playwright browser journeys
packages/              shared ESLint/TypeScript configuration
supabase/migrations/   database schema source of truth
docs/                  operations, CI, billing and secrets documentation
scripts/               repository/operator utilities
```

## Local development

Prerequisites: Node 22+ and pnpm 11.5.0.

```bash
corepack enable
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Environment variables are documented in
[`apps/web/.env.example`](apps/web/.env.example) and
[`docs/SECRETS.md`](docs/SECRETS.md).

## Quality checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --filter @tharros/web test:e2e
node scripts/contrast-check.mjs
```

Many integration suites use the dedicated Supabase test project. CI distinguishes
an unavailable external test dependency from deterministic source/build
failures, but a skipped live suite is not release approval. See
[`docs/CI.md`](docs/CI.md).

## Architecture notes

- **Tenant isolation:** organization-scoped data is protected by Postgres RLS.
- **Knowledge:** upload → extraction → chunking → embeddings → pgvector retrieval
  → grounded assistant generation.
- **Scheduling:** deterministic constraint solving plus AI-assisted structured
  tasks, with manager review and atomic disruption flows.
- **Lead Capture:** authenticated CRM reads/writes stay under RLS; anonymous
  capture uses opaque form tokens through a narrowly scoped server-only seam and
  respects plan state.
- **Automations:** lead events enqueue `automation-dispatch` jobs. Runs are
  idempotently recorded in `automation_runs`; managers can pause workflows and
  queue targeted manual runs for testing.
- **Jobs:** all deferred operational work uses the durable database queue.
- **Observability:** Sentry, structured logging and health checks cover runtime
  failures and shipped configuration.

Read [`PRODUCT.md`](PRODUCT.md) for product principles and [`CLAUDE.md`](CLAUDE.md)
for implementation guidance.
