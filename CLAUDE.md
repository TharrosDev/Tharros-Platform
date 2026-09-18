# CLAUDE.md

Repository guidance for AI coding agents working on Tharros.

## Product scope

Tharros is a multi-tenant SaaS for small businesses. The production product has
two primary capabilities:

1. **AI Business Assistant** — document ingestion, embeddings, retrieval,
   grounded streaming answers, citations, generation templates and knowledge
   management.
2. **AI Workforce Scheduling** — setup, availability, schedule generation and
   review, publishing/versioning, employee portal, sick calls/replacements,
   swaps, time off, delivery/reminders, analytics and activity history.

Do not reintroduce Lead Capture, generic connector, Nango, n8n, or workflow
automation product claims unless an end-to-end implementation is intentionally
being added. Pricing, navigation and public copy must describe shipped behavior.

## Read before app work

`apps/web/AGENTS.md` is mandatory. This repository uses a modified Next.js 16
build. In particular:

- middleware is `src/proxy.ts`, exporting `proxy()`;
- `cookies()` from `next/headers` is async;
- consult the installed Next.js docs before assuming stock framework behavior.

## Commands

Run from the repository root:

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm format:check
pnpm --filter @tharros/web test:e2e
```

Use Node 22+ and the pnpm version pinned in `package.json`.

Database-backed Vitest suites use the dedicated Supabase test project and run
serially. Provider-backed evaluation code under `src/eval` is not part of the
normal CI suite.

## Repository structure

- `apps/web` — the only deployable application.
- `apps/web/src/app` — Next.js routes.
- `apps/web/src/components` — Workshop UI primitives and product components.
- `apps/web/src/lib` — domain logic and provider/infrastructure seams.
- `supabase/migrations` — database schema source of truth.
- `docs` — operator documentation.
- `packages` — shared TypeScript/ESLint configuration.

## Routing and access

- `(marketing)` — public/indexable home, pricing, privacy, terms and security.
- `(auth)` — login/signup/reset/verification.
- `(onboarding)` — organization onboarding.
- `(app)` — authenticated shell.
- `(app)/(subscribed)` — paid product surfaces: assistant, knowledge and
  scheduling.
- `portal` — account-less employee portal using a token-scoped server session.
- `api` — route handlers including assistant streaming, document processing,
  Stripe webhooks, health and durable-job ticks.

The proxy is an optimistic UX gate. Authoritative authorization belongs in
server code and the database. Public unauthenticated endpoints must be accounted
for in both the proxy matcher and public-path logic when applicable.

## Multi-tenancy and database security

Supabase has two client classes:

- user-session client: RLS applies;
- admin/service-role client: bypasses RLS and must stay server-only.

Organization data is scoped through `organizations`, `memberships` and the RLS
helpers `public.current_user_orgs()` and `public.current_user_role(org)`.

For new SECURITY DEFINER functions:

- pin `search_path = ''`;
- schema-qualify objects;
- perform role checks inside the function;
- revoke broad execute permissions;
- add RLS/integration coverage.

Do not replace database isolation with client-side filtering.

## Knowledge and assistant

Document lifecycle:

`uploaded → extracting → extracted → chunking → embedding → ready`

with `needs_ocr` and `failed` branches.

Important seams:

- `lib/documents/extract.ts`
- `lib/documents/chunk.ts`
- `lib/documents/embeddings.ts`
- `lib/documents/retrieval.ts`
- `lib/documents/rag.ts`
- `lib/assistant/*`
- `app/api/assistant/query/route.ts`

Document vectors are 1536-dimensional pgvector values. Inside SECURITY DEFINER
SQL with an empty search path, use `OPERATOR(extensions.<=>)` for vector
distance. PostgREST vector RPC parameters are passed as vector literals, not raw
JS arrays.

Assistant answers are org-scoped, usage-metered and expected to cite retrieved
context or decline when context is insufficient.

## Scheduling

Scheduling lives under `lib/scheduling`, with employee-facing code under
`lib/portal` and `lib/employees`.

Key areas:

- `solver/` — deterministic constraint solver;
- `panel/` — candidate grading/judging;
- `orchestrator/` — generation pipeline;
- `calendar-actions.ts` — manager edits;
- `replacement.ts`, `swaps.ts`, `time-off.ts` — disruption flows;
- `delivery.ts` + `lib/jobs` — durable email/reminder work.

Consequential changes remain manager-reviewable. Race-sensitive operations
belong in atomic database functions, not read-then-write client logic.

## Providers and configuration

- Anthropic: assistant generation.
- OpenAI: embeddings.
- DeepSeek: scheduling structured tasks.
- Stripe: subscriptions.
- Resend: transactional email.
- Supabase: database/auth/storage.
- Sentry: optional observability.

The production env contract is in `apps/web/src/env.ts`. Build-time env names
must also be listed in `turbo.json`. See `docs/SECRETS.md`.

## Testing and CI

CI always runs typecheck, lint and a production build. Live Supabase integration
and Playwright suites run when the dedicated test project is reachable. A
skipped live suite is an infrastructure warning, not release approval.

When changing a domain:

- add pure unit coverage where possible;
- add database/RLS coverage for authorization or atomicity;
- extend Playwright only for user journeys worth preserving;
- do not claim a provider-backed path was tested unless it actually ran.

## UI conventions

Follow `apps/web/docs/DESIGN.md`.

- use existing Base UI/shadcn-style primitives;
- use semantic tokens, not arbitrary colour values;
- one primary cobalt action per view;
- retain keyboard/focus/reduced-motion behavior;
- use `m.*` from `motion/react` under the shared MotionProvider;
- keep Base UI overlay transitions CSS-driven;
- no fake metrics, fake customers or controls that imply unimplemented actions.

## Database changes

SQL migrations in `supabase/migrations` are the repository source of truth.
Apply schema changes to production and the dedicated CI project in lockstep.
Never point destructive test setup at production.
