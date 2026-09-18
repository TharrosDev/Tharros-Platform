# Tharros Platform

**The AI operating workspace for small businesses.**

Tharros currently ships two production products:

- **AI Business Assistant** — businesses upload policies, guides, FAQs and other
  operating documents, then ask grounded questions and generate work with
  citations back to the source material.
- **AI Workforce Scheduling** — plain-language setup and availability, schedule
  generation and manager review, publishing/versioning, employee self-service,
  sick calls and replacements, swaps, time off, delivery/reminders, analytics
  and a full activity trail.

Lead capture, third-party connectors and workflow automation remain roadmap work
until their end-to-end implementations are production-ready. Public pricing and
plan entitlements intentionally list only capabilities that ship today.

Production: [tharros.ca](https://tharros.ca)

## Stack

- **Turborepo** + **pnpm** workspaces
- **Next.js 16**, React 19, strict TypeScript, Tailwind CSS v4
- **Supabase** Postgres/Auth/Storage/pgvector with Row-Level Security
- **Stripe** subscriptions and plan-aware AI usage limits
- **Anthropic Claude** for grounded generation
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
  src/app/             route groups, APIs and employee portal
  src/components/      Workshop UI system and product components
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

Many Vitest suites make real calls to a dedicated Supabase integration-test
project. CI first checks that dependency is reachable; an unavailable external
test project is reported separately from deterministic source/build failures.
See [`docs/CI.md`](docs/CI.md).

## Architecture notes

- **Tenant isolation:** organization-scoped data is protected by Postgres RLS.
  Service-role access is server-only and reserved for internal pipelines or
  narrowly scoped operations.
- **Knowledge pipeline:** upload → extraction → chunking → embeddings → pgvector
  retrieval. The assistant is prompted to answer from retrieved context and
  cite it, or say when the context is insufficient.
- **Scheduling:** a constraint solver generates candidates, an AI judging seam
  compares them, and managers retain review/edit/publish control. Disruption
  flows use atomic database operations with conflict guards.
- **Employee portal:** account-less token sessions are validated on every
  request and strictly scoped to one employee and organization.
- **Jobs:** schedule delivery, reminders and other deferred work use the durable
  database queue rather than request-lifetime fire-and-forget work.
- **Observability:** Sentry and structured logging cover runtime failures; the
  health endpoint probes real database connectivity.

Read [`PRODUCT.md`](PRODUCT.md) for the authoritative product principles and
[`CLAUDE.md`](CLAUDE.md) for deeper implementation guidance.
