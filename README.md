# Tharros Platform

**The AI operating layer for small businesses.** A multi-tenant SaaS where a business uploads its documents (SOPs, policies, FAQs, price lists) and gets a grounded, cited AI assistant that answers from them — with streaming chat, inline citations, generation templates (draft email / write SOP / summarize policy), and knowledge management — plus lead capture and automations.

Production: [tharros.ca](https://tharros.ca) · Private repo (`TharrosDev/Tharros-Platform`).

## Stack

- **Turborepo** monorepo, **pnpm** workspaces
- **Next.js 16** (App Router, React 19) — note: a *modified* build, see [`apps/web/AGENTS.md`](apps/web/AGENTS.md)
- **TypeScript** (strict), **Tailwind CSS v4**, **Base UI** + shadcn-style primitives
- **Supabase** — Postgres + Auth (SSR) + Storage + **pgvector**, with Row-Level Security
- **Stripe** — subscriptions (Checkout + Customer Portal), with per-plan AI usage caps
- **OpenAI** (`text-embedding-3-small`, 1536-dim) for embeddings · **Anthropic Claude** for generation (Opus 4.8 for grounded Q&A, Haiku 4.5 for templated generation)
- **Sentry** observability · **Vercel** hosting/CI · **Vitest** + **Playwright** tests

## Repository layout

```
apps/web/              # the Next.js application (the only deployable)
  src/app/             # routes: (marketing) (auth) (onboarding) (app)/(subscribed) api
  src/lib/             # supabase clients, auth, billing, documents (RAG),
                       #   assistant (chat), anthropic (model seam), email…
  src/eval/            # offline RAG eval harness (fixtures, questions, metrics)
  e2e/                 # Playwright specs
packages/eslint-config # shared ESLint config
packages/tsconfig      # shared TS config
supabase/migrations/   # SQL migrations — the source of truth for the DB schema
docs/                  # BILLING.md, CI.md, SECRETS.md
```

## Getting started

**Prerequisites:** Node ≥ 20, pnpm 11.5.0 (`corepack enable`).

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # then fill in real values
pnpm dev                                        # http://localhost:3000
```

Environment variables are documented in [`apps/web/.env.example`](apps/web/.env.example) and [`docs/SECRETS.md`](docs/SECRETS.md). The authoritative store is the Vercel project environment; `.env.local` is for local dev and integration tests.

## Scripts

Run from the repo root (Turborepo orchestrates the workspaces):

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest (unit + live integration) |
| `pnpm format` | Prettier write |

Scope to the app or a single test:

```bash
pnpm --filter @tharros/web build
pnpm --filter @tharros/web exec vitest run src/lib/documents/__tests__/chunk.test.ts
pnpm --filter @tharros/web test:e2e        # Playwright
```

> **Heads-up:** many Vitest suites are **live integration tests** that seed/tear-down against a real Supabase project, so they require a populated `apps/web/.env.local` and run serially.

## Architecture notes

- **Multi-tenant + RLS.** Every domain table is org-scoped; access is enforced in the database via Row-Level Security helpers (`current_user_orgs()`, `current_user_role()`). The user-session Supabase client respects RLS; a service-role client (server-only) is the sole writer to internal pipeline tables.
- **RAG pipeline** (`apps/web/src/lib/documents/`): `upload → extract → chunk → embed → retrieve`, tracked on `documents.status`, with vectors stored in pgvector and searched via a `match_document_chunks` RPC.
- **AI assistant** (`apps/web/src/lib/assistant/`): a streaming chat endpoint (`api/assistant/query`, NDJSON frames) that retrieves grounding chunks, prompts Claude to cite-or-decline, persists each turn, and returns numbered inline citations. Generation templates route to a cheaper model; per-org token usage is metered and enforced against plan caps.
- **RAG eval** (`apps/web/src/eval/`): an offline harness over fixture corpora that sweeps chunk size × top-k and scores retrieval + answer quality (recall, citation accuracy, faithfulness, negative-question handling).
- **Migrations** in `supabase/migrations/` are the source of truth and are applied to both the production and CI-test Supabase projects.

See [`CLAUDE.md`](CLAUDE.md) for a deeper architecture orientation and the project's conventions.

## Deployment

Hosted on Vercel (project `tharros-platform`, root directory `apps/web`); production deploys from `main`. Each PR gets a preview deployment and must pass CI (`typecheck · lint · test · build`, Playwright e2e, and a Supabase migration preview) before merge. See [`docs/CI.md`](docs/CI.md).
