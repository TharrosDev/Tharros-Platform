# Workshop Redesign — Continuation / Resume Prompt

> **Living doc. Overwrite (don't append) after each push.** It's the single source
> of truth for resuming the UI/UX overhaul. Branch: **`workshop-redesign`** → PR **#15**.
> **Last updated: 2026-06-02 — after app-shell polish (commit pending this push).**

## How to resume (paste this to Claude)
> "Continue the Workshop redesign on the `workshop-redesign` branch. Read
> `docs/WORKSHOP-REDESIGN.md` for state + remaining tasks, then do the next
> unchecked task. Use the impeccable skill (product register, Workshop system)."

## What this is
A ground-up visual reinvention of the Tharros Platform app. The **Maple Pure**
identity was dropped for **"Workshop"**: warm-graphite chrome (hue ~70), a clean
cool-neutral canvas (hue ~264), one **cobalt** accent (~264), tight 0.4rem radius.
**Functionality must not change** — reskin/recompose only.

Design contract + tokens live in `apps/web/docs/DESIGN.md` and
`apps/web/src/app/globals.css`. Register guidance: impeccable `product`.

## Hard constraints (do not break)
- Preserve e2e-asserted contracts: labels **Email / Password / Full name /
  Business name**; buttons **Create account / Sign in / Continue to dashboard /
  Send invite**; headings **Welcome back / Choose your plan / Subscribe to Growth**;
  select options **Technology / Just me**; the **`id="checkout"`** container. If a
  string must change, update `apps/web/e2e/auth-billing.spec.ts` in the same commit.
- **No em-dashes** in UI copy (use commas/colons/periods/parens).
- All token text pairs must pass **WCAG AA** (`node scripts/contrast-check.mjs`).

## Done ✅
- **Pass 1 — system + identity + dashboard** (`1e1f43d`): full token rewrite
  (cobalt + warm-graphite + clean canvas, radius 0.4rem), contrast checker synced
  (AA light+dark), new chamfered cobalt logo mark, reinvented dashboard
  ("Waiting on you" focal panel + activity + weekly pulse + toolkit), DESIGN.md.
- **Pass 2 — billing** (`960e923`): plan-picker (Growth raised w/ cobalt ring +
  badge + filled CTA, mono prices, cobalt checks); billing-overview (clean
  current-plan panel + features + invoices); removed an em-dash from billing copy.
- **Pass 3 — settings** (`b406741`): persistent settings sub-nav rail
  (`components/settings/settings-nav.tsx` + `(app)/settings/layout.tsx`),
  `/settings` redirects to `/settings/organization`; em-dash cleanup across
  danger zone / checkout-return / pricing / email templates / doc title.
- **Pass 4 — auth + onboarding** (`70e15f5`): split auth layout (warm-graphite
  brand panel + form on canvas, mobile-collapses); onboarding on the same dotted
  texture backdrop.
- **Pass 5 — app-shell polish**: restraint pass — org-switcher tile is now neutral
  (white/10) so the cobalt active-nav pill is the single cobalt focal point in the
  chrome; command-palette selected row is cobalt-soft. (Shell was already strong
  from the token reskin; this is targeted polish.)

## Remaining 🔧 (do in order)
1. **Marketing home + pricing** — `(marketing)/page.tsx`, `(marketing)/pricing/page.tsx`.
2. **Profile + product stubs** — `(app)/profile/page.tsx`; the `ComingSoon` stubs
   `(app)/(subscribed)/{assistant,leads,automations}` via a polished empty state.
3. **Update Obsidian memory** — replace old "Maple Pure" UI/build info with
   "Workshop" in the memory notes (hub `Tharros Platform - Overview`, design notes).
   Vault: `C:\Users\magnu\Downloads\obsidianMemory\Claude Memory\03 Tharros\`.
4. **Merge** `workshop-redesign` → `main` once CI is green (PR #15), then update
   the roadmap/Obsidian. (No workflow files change here, so plain `git push` works.)

## Working conventions
- Per pass: edit → `pnpm typecheck` + `pnpm lint` → `pnpm --filter @tharros/web build`
  → `pnpm test:e2e` (reuses a running `pnpm start`) → screenshot → commit + push →
  **update this doc's date + Done/Remaining**.
- Gates from repo root: `pnpm typecheck`, `pnpm lint`, `pnpm test` (must stay 100/100).
- Visual QA: a throwaway `apps/web/e2e/shots.mjs` (run with
  `node --experimental-strip-types e2e/shots.mjs` after `pnpm start`) using the
  `e2e/helpers/supabase.ts` seeders; **delete it before committing**.
- Dev server runs against `.env.local` (prod Supabase) — seeded e2e users self-clean.
- Stop a stray server: PowerShell `Get-NetTCPConnection -LocalPort 3000 ... Stop-Process`.
