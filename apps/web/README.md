# @tharros/web

The Tharros web app: the AI operating layer for small businesses. Next.js 16
(App Router) + React 19 + TypeScript (strict) + Tailwind v4, deployed on Vercel.
This is the `apps/web` workspace of the `Tharros-Platform` pnpm + Turborepo
monorepo.

> **Heads up:** this Next.js 16 build is modified. Read `AGENTS.md` and the local
> guides in `node_modules/next/dist/docs/` before changing routing or middleware.
> Notably, middleware is `src/proxy.ts` exporting a `proxy()` function, and
> `cookies()` from `next/headers` is async.

## Getting started

```bash
pnpm install          # from the repo root
pnpm --filter @tharros/web dev
```

Open http://localhost:3000.

Useful checks (run from the repo root):

```bash
pnpm --filter @tharros/web typecheck
pnpm --filter @tharros/web lint
pnpm --filter @tharros/web build
node scripts/contrast-check.mjs    # WCAG contrast over the design tokens
```

## Layout

```
src/
  app/
    layout.tsx          root layout: fonts + next-themes provider
    (marketing)/        public surface — / landing placeholder
    (app)/              authed product shell
      layout.tsx        sidebar + top bar + toast/tooltip providers
      dashboard/        the dashboard
      assistant/ leads/ automations/ settings/ billing/   stubs
  components/
    ui/                 design-system primitives (Maple Pure + Base UI overlays)
    shell/              sidebar, top bar, mobile nav, command palette
    brand/              logo mark + wordmark
  lib/supabase/         @supabase/ssr clients
  proxy.ts              Next 16 middleware (Supabase session refresh)
  env.ts                build-time env validation (@t3-oss/env-nextjs + zod)
```

## Docs

- `docs/DESIGN.md` — the "Maple Pure" design system, components, shell, theming.
- `docs/SECRETS.md` — environment variables and where they live.
- Root `PRODUCT.md` — product register, users, principles, anti-references.

The day-by-day build roadmap lives outside the repo (founder's notes).
