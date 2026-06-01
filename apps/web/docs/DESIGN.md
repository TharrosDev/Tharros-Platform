# Tharros Platform — Design System ("Maple Pure")

The look every screen inherits. Established Day 5; extended Day 6 with the app
shell, overlay primitives, and theming; the tone was sharpened (Day 6.5) from
warm-and-cozy toward **inviting + confident**. Goal: a dashboard a non-technical
owner trusts on sight — warm, but with backbone. Generous air, crisp surfaces,
one maple accent used decisively.

## Principles

- **Warmth from the brand, not from beige.** The neutral ramp is tinted toward
  maple's own hue (~40) at very low chroma, so it reads as a warm stone, never
  the cream / parchment near-white that hue ~75 produces (the SaaS-cream default
  we explicitly avoid). Warmth is carried by the accent, copy, and this tint.
- **Grounded chrome.** A warm **dark** sidebar (`--sidebar`, still hue ~40, not
  grey) anchors the app and gives it weight; the top bar and content sit light
  above it. This is the "strength" lever — confident, never cold-grey.
- **Crisp, seated surfaces.** Cards sit on a tight, low shadow with a defined
  border (`--border`), not a soft floating glow. Radius is a confident
  `--radius: 0.5rem`, not pillowy. No glassmorphism.
- **One accent: maple, decisive.** A deep warm red-orange for the primary action,
  current selection, and state only — never a soft decorative wash. Never more
  than one maple CTA competing in a view.
- **Confident, not cozy.** Strength reads through typographic authority (heavier,
  tighter headings) and restraint, not through cute garnish. Inviting, with
  backbone.
- **Light and dark, both AA.** Both ship from the same tokens; dark is a warm
  near-black. Every text pair (including the dark-sidebar pairs) meets WCAG AA,
  verified by `scripts/contrast-check.mjs` (OKLCH -> WCAG over the ramp).

## Tokens

All tokens are OKLCH CSS variables in `src/app/globals.css`, reusing shadcn
variable names so every component inherits them. The whole neutral ramp and the
accent share hue ~40 (maple's family); change a token and the app re-skins.

| Token | Role |
| --- | --- |
| `--background` / `--foreground` | warm-stone canvas / warm ink |
| `--sidebar` (+ `-foreground` / `-muted-foreground` / `-accent` / `-border`) | grounded **dark** chrome anchor; `-muted-foreground` is the on-dark muted text for inactive nav |
| `--card` / `--popover` | near-white surfaces that sit on `--shadow-card` |
| `--primary` / `--primary-foreground` | deep maple action colour / text on it |
| `--primary-soft` / `--primary-soft-foreground` | soft maple wash / text on it (used sparingly) |
| `--secondary` `--muted` `--accent` | quiet warm neutrals (hover, fills) |
| `--success` `--warning` `--info` `--destructive` | semantics, tuned to read AA as text |
| `--border` `--input` `--ring` | crisp hairlines and maple focus ring |
| `--shadow-xs` `--shadow-card` `--shadow-card-hover` `--shadow-popover` | seated warm elevation scale |

## Type scale

Geist Sans for UI, Geist Mono for numerals and metadata. The scale is **fixed
rem, not fluid** (product UI views at consistent DPI; clamp headings don't serve
it), with a ~1.25+ ratio between steps. Headings are **bold (700) and tightly
tracked** for authority: `.type-display` 40px, `.type-h1` 26px, `.type-h2` 19px;
body stays regular: `.type-body` 15px, `.type-small` 13px, `.type-meta` 11px
(mono, uppercase, tracked). Use `.num` for tabular mono numerals on any stat.

## Components

Hand-authored under `src/components/ui/` (the shadcn CLI does not run in this
monorepo), skinned to the tokens above.

**Base primitives (Day 5):** `card` (the hero primitive), `button` (maple
`default` + `soft` variant), `badge` (incl. `solid`/`success`/`warning`/`info`),
`separator`, `input`, `textarea`, `label`, `skeleton`, `avatar`.

**Overlay primitives (Day 6):** `dialog`, `sheet`, `dropdown-menu`, `tooltip`,
`tabs`, `toast`, plus a `kbd` helper. All built on **Base UI** (`@base-ui/react`,
the "base-nova" layer) rather than adding Radix / Sonner / cmdk — Base UI ships
every part natively, including `toast` (manager pattern:
`useToast().add({ title, description })`) and the mobile drawer (a `dialog`
styled as a left `sheet`). Each wrapper styles the Base UI parts to the tokens
and animates enter/exit via Base UI's `data-[starting-style]` /
`data-[ending-style]` / `data-[open]` state attributes.

**Brand:** `components/brand/logo.tsx` — `TharrosMark` (original rounded maple
tile with a cut-out "T", single-colour via `currentColor`) and `TharrosWordmark`.

**Layout helpers:** `components/page-header.tsx`, `components/stat-card.tsx`,
`components/theme-toggle.tsx`.

## App shell & routes (Day 6)

The app is split into two route groups under `src/app/`:

- **`(marketing)`** — public surface. `(marketing)/page.tsx` is the `/` landing
  placeholder; the full marketing site comes in a later phase.
- **`(app)`** — the authed product shell. `(app)/layout.tsx` mounts the toast and
  tooltip providers, the desktop sidebar, and the sticky top bar, then renders
  each page in a centred content column. Pages: `/dashboard` plus stubs for
  `/assistant`, `/leads`, `/automations`, `/settings`, `/billing`.

Shell components live in `src/components/shell/`:

- `nav.ts` — single source of truth for the nav items and the demo user,
  consumed by the sidebar, the mobile drawer, and the command palette.
- `sidebar.tsx` — `next/link` nav with `usePathname` active state.
- `topbar.tsx` — mobile menu trigger, ⌘K search affordance, theme toggle, and the
  user dropdown.
- `mobile-nav.tsx` — the sidebar inside a `sheet` drawer below the `lg` breakpoint.
- `command-palette.tsx` — ⌘K / Ctrl+K palette (stub: filters the nav list with
  ↑/↓ + Enter keyboard navigation).
- `coming-soon.tsx`, `new-automation-button.tsx` — the shared empty state and the
  toast-demo action island.

## Theming

Light/dark is handled by **next-themes** (`components/theme-provider.tsx`, mounted
in the root layout): `system` default, persisted to storage, with a pre-hydration
script so there is no dark-mode flash. `theme-toggle.tsx` flips it via
`useTheme()`; its icon stays pure-CSS (a `dark:` variant) so there is no state to
hydrate.

## Voice — Warm Canadian, with backbone

All UI copy is warm, plain, and human, but **confident** — inviting with backbone,
not cozy or cute. It talks to a busy owner, not an enterprise buyer.

- Confident and specific: "Here's what Tharros handled while you were out." Avoid
  soft hedging ("nothing needs you right this second") and cutesy garnish (no emoji).
- Plain words over jargon. Short, declarative sentences. Concrete nouns.
- **No em-dashes in UI copy** (founder preference; commas or periods instead).
- Speak to the person ("Welcome back, {first name}"), name the outcome, never the plumbing.
- The "Local & Canadian" identity lives in the brand surfaces (sidebar wordmark,
  marketing, footer), not as a sticker in the working chrome.
