# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tharros Platform — "the AI operating layer for small businesses." A Turborepo monorepo; the product is a Next.js app at `apps/web` (`@tharros/web`) serving `tharros.ca`. Phase 2 (the AI Business Assistant) is largely shipped: a RAG pipeline over documents a business uploads, fronted by a streaming chat UI with inline citations, generation templates, knowledge management, and per-org AI usage metering tied to plan caps.

## ⚠️ Read first: this Next.js is modified

`apps/web/AGENTS.md` is mandatory before writing app code. The repo runs a **modified Next.js 16** — APIs differ from stock. Read `apps/web/node_modules/next/dist/docs/` before relying on framework behavior. The biggest divergence: **`middleware.ts` is renamed to `proxy.ts`** (root or `src/`), exporting a function named `proxy`; build output lists it as `ƒ Proxy (Middleware)`. `cookies()` from `next/headers` is async.

## Commands

Run from the repo root (Turborepo fans out to workspaces):

- `pnpm dev` — dev server (`next dev` in `apps/web`)
- `pnpm build` — production build
- `pnpm lint` — ESLint
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm test` — Vitest (see caveat below)
- `pnpm format` / `pnpm format:check` — Prettier

Scope to the web app or target a single test:
- `pnpm --filter @tharros/web build`
- `pnpm --filter @tharros/web exec vitest run src/lib/documents/__tests__/chunk.test.ts`
- `pnpm --filter @tharros/web exec vitest run -t "match_document_chunks"`
- E2E (Playwright): `pnpm --filter @tharros/web test:e2e` (specs live in `apps/web/e2e/`, excluded from Vitest)

Package manager is **pnpm 11.5.0**, Node ≥20. Native build scripts are gated — a new dependency with a postinstall must be allow-listed under `allowBuilds:` in `pnpm-workspace.yaml` before `pnpm install` will run it.

### Tests are mostly live integration tests

The `*-rls.test.ts` / `*.db.test.ts` suites hit a **real Supabase project** (the dedicated CI test project), seeding and tearing down auth users via the service-role key. They need `apps/web/.env.local` populated (`NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SECRET_KEY`, etc.). They are serial (`fileParallelism: false`) and slow. CI supplies only the Supabase + Stripe-test secrets, so suites that need other providers (e.g. OpenAI embeddings) must **not** be exercised in committed tests — verify those paths with a throwaway script and keep committed tests provider-free (crafted vectors, mocks).

## Architecture

### Monorepo
- `apps/web` — the Next.js App Router app (the only deployable). Source under `src/`.
- `packages/eslint-config`, `packages/tsconfig` — shared config consumed via workspace deps.
- Vercel project `tharros-platform`, root directory `apps/web`, deploys from `main`.

### Route groups (`apps/web/src/app`)
- `(marketing)` — public, indexable (`/` and `/pricing`).
- `(auth)` — login/signup/reset/verify-email; Server Actions + `useActionState`.
- `(onboarding)` — post-signup org onboarding flow.
- `(app)` — auth-gated shell (dashboard, settings, profile, billing). `(app)/(subscribed)` is a nested group whose layout redirects to `/billing` unless the org has an active subscription; it holds the product surfaces (`assistant`, `knowledge`, `leads`, `automations`). `git mv`-ing a page in/out of it changes gating **without changing the URL** (route groups don't affect paths).
- `api` — route handlers. The document ingestion routes (`api/documents/[id]/extract`, `.../embed`) and the streaming assistant route (`api/assistant/query`) run on `runtime = "nodejs"`.

### Auth + multi-tenancy (the spine everything sits on)
- Supabase SSR. Two clients: `lib/supabase/server.ts` (user-session, **RLS applies**) and `lib/supabase/admin.ts` (service-role, **bypasses RLS** — `server-only`, the sole writer to deny-all/member-read-only tables).
- Tenancy: `profiles` / `organizations` / `memberships`. A signup trigger auto-provisions a personal org + owner membership.
- RLS reuses two SECURITY DEFINER helpers — **`public.current_user_orgs()`** (org-scoped reads: `org_id in (select public.current_user_orgs())`) and **`public.current_user_role(org)`** (write/role gating). New tables follow this pattern; new SECURITY DEFINER RPCs pin `set search_path = ''`, schema-qualify everything, and `revoke execute ... from anon, public`.
- The `proxy.ts` gate redirects unauthenticated requests (including `/api/*`) to `/login`. A route that must accept unauthenticated callers (e.g. the Stripe webhook) must be excluded in **both** the `proxy.ts` matcher and `PUBLIC_PATHS`.

### RAG document pipeline (`apps/web/src/lib/documents/`, Phase 2)
Lifecycle on `documents.status`: `uploaded → extracting → extracted → chunking → embedding → ready`, with `needs_ocr` (scanned PDFs) and `failed` branches. Bytes live in the private `documents` Storage bucket at `<org_id>/<document_id>/<filename>` (the org-id-first path segment is load-bearing for the Storage RLS).
- `validation.ts` — isomorphic upload guard (extensions, size). `actions.ts` — reserve `documents` row server-side before the browser uploads to Storage. `queries.ts` — document/library reads. `tags.ts` — knowledge tagging.
- `extract.ts` — unpdf (PDF) / mammoth (DOCX) / decode (TXT/MD); `chunk.ts` — token-aware chunking (gpt-tokenizer cl100k); `embeddings.ts` — the swappable embeddings seam (OpenAI `text-embedding-3-small`, 1536-dim); `retrieval.ts` — `searchChunks` over the `match_document_chunks` RPC.
- `rag.ts` — the query pipeline: `retrieveGroundingChunks` (top-k chunks joined to filenames) → `buildRagRequest` → Claude, with a cite-or-say-"I don't know" prompt. `rag-prompt.ts` — single source of prompt assembly (`SYSTEM_PROMPT`, `buildContextBlock`, `buildCitations`, `NO_CONTEXT_ANSWER`), shared by the one-shot and streaming paths.
- `document_chunks.embedding` is `vector(1536)` (pgvector in schema `extensions`). The pgvector operators (`<=>`) are NOT visible under `search_path = ''` — inside SECURITY DEFINER functions use `OPERATOR(extensions.<=>)`. Pass vectors to PostgREST as the string literal `[a,b,c]`, not a JS array.

### AI assistant (`apps/web/src/lib/assistant/`, Phase 2)
The chat layer over the RAG pipeline. `api/assistant/query` (Node runtime) streams an answer as NDJSON frames (`stream-protocol.ts`), persisting each turn per org/user. A new conversation is created on the first turn; its id returns in the `meta` frame so the client can route to it.
- `conversations.ts` — server data access for threads/messages (org-scoped; the org owner can read members' threads). `types.ts` — pure domain types (no `server-only`) shared with client islands.
- `templates.ts` — generation templates (draft email / write SOP / summarize policy); a template swaps the grounding system prompt for a deliverable-shaped one. `citation-markers.ts` — numbered inline `[n]` markers. `export.ts` — thread export.

### Model seam + cost/rate controls
- `lib/anthropic/` — the Claude seam. `client.ts` holds the SDK instance (`server-only`); `models.ts` is pure/testable and defines `DEFAULT_MODEL` (`claude-opus-4-8`, grounded Q&A) + `CHEAP_MODEL` (`claude-haiku-4-5`, templated generation), routed by `modelForTemplate`.
- `lib/billing/usage.ts` — per-org AI metering. After each Claude call, token usage is written to `ai_usage_events` via the **service-role admin client** (no user-write RLS, mirroring `subscriptions` / `document_chunks`). `checkQueryCap` enforces the plan's monthly query cap before answering; `/settings/usage` reads the member-readable `ai_usage_summary` RPC. `ai-pricing.ts` / `usage-math.ts` keep cost math pure and testable.

### RAG eval harness (`apps/web/src/eval/`)
Offline quality harness — **not** part of CI (it needs OpenAI + Anthropic). `fixtures/` is a small document corpus, `questions.ts` the labelled question set (incl. negatives), `metrics.ts` the scoring, `rag-eval.live.ts` the runner. It sweeps chunk size × top-k and scores retrieval (recall/precision/MRR) and answers (citation accuracy, faithfulness, negative handling); `results/latest.md` is the committed snapshot that drove the current chunking + top-k defaults.

### Environment & secrets
- Validated through `apps/web/src/env.ts` (t3-env). A var read at build time must **also** be listed in the `build` task's `env` array in `turbo.json`, or Turbo strips it and the Vercel build fails. The authoritative store is Vercel project env; see `docs/SECRETS.md`.
- Deferred/just-added services are `.optional()` in `env.ts` until vaulted in Vercel for all environments, then promoted to required.
- `server-only` modules **throw under Vitest** — keep `import "server-only"` on the secret-holding leaf, not on logic a test imports.

### Database migrations
SQL files in `supabase/migrations/` are the repo source of truth. Apply them via the **Supabase MCP `execute_sql`** (NOT `apply_migration`, to keep Supabase's own migration history clean), to **both** the prod project and the CI test project, so schemas stay in lockstep. PR migrations are also run on a Supabase preview branch by CI.

## Conventions

- Per-day workflow (the project is built on a day-by-day roadmap): branch off `main`, one PR per day, wait for CI (`typecheck · lint · test · build` + `e2e` + Supabase Preview) green, merge, sync `main`.
- Match surrounding style (Base UI components, `buttonVariants` over wrapping `<Button>`, toast via `useToast`). Reference docs: `docs/CI.md`, `docs/BILLING.md`, `docs/SECRETS.md`, `apps/web/docs/DESIGN.md`.
