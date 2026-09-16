# Tharros Platform — Design System ("Workshop")

The look every screen inherits. Reworked from the earlier "Maple Pure" system
into **"Workshop"** — the maple identity (warm-stone tint, red-orange accent,
maple logo tile) was dropped for a dependable, sharp, tool-like look: warm
graphite chrome with weight, a clean light canvas to work on, and one decisive
cobalt accent. Goal: a workspace a non-technical owner trusts on sight — calm at
rest, obvious under pressure. Generous air, crisp surfaces, cobalt used sparingly.

## Principles

- **Two deliberate neutral families.** The **chrome** (sidebar + all dark
  surfaces) is a warm graphite — hue ~70 at very low chroma, a near-black with a
  faint warm undertone, never cold-grey. The **content** canvas is a clean,
  whisper-cool off-white tinted a hair toward cobalt (hue ~264), deliberately NOT
  warm so it never drifts into the cream / parchment SaaS-cream default.
- **Grounded chrome.** A warm-graphite **dark** sidebar (`--sidebar`) anchors the
  app and gives it weight; the top bar and content sit light above it. The active
  nav item is a solid **cobalt pill** — the signature move.
- **Crisp, seated surfaces.** Cards sit on a tight, low cool shadow with a defined
  border (`--border`), not a soft floating glow. Radius is a measured, tool-like
  `--radius: 0.75rem`, substantial enough for touch-first controls without becoming
  pillowy. No glassmorphism.
- **One accent: cobalt, decisive.** A confident blue for the primary action,
  current selection, and state only — never a soft decorative wash. Never more
  than one cobalt CTA competing in a view.
- **Confident, not cozy.** Strength reads through typographic authority (heavier,
  tighter headings) and restraint, not through cute garnish.
- **Light and dark, both AA.** Both ship from the same tokens; dark is a warm
  graphite near-black. Every text pair (including the chrome pairs) meets WCAG AA,
  verified by `scripts/contrast-check.mjs` (OKLCH -> WCAG over the ramp).

## Tokens

All tokens are OKLCH CSS variables in `src/app/globals.css`, reusing shadcn
variable names so every component inherits them. The whole neutral ramp and the
accent share the same families (cobalt ~264 + graphite ~70); change a token and the app re-skins.

| Token                                                                       | Role                                                                                            |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `--background` / `--foreground`                                             | warm-stone canvas / warm ink                                                                    |
| `--sidebar` (+ `-foreground` / `-muted-foreground` / `-accent` / `-border`) | grounded **dark** chrome anchor; `-muted-foreground` is the on-dark muted text for inactive nav |
| `--card` / `--popover`                                                      | near-white surfaces that sit on `--shadow-card`                                                 |
| `--primary` / `--primary-foreground`                                        | deep cobalt action colour / text on it                                                          |
| `--primary-soft` / `--primary-soft-foreground`                              | soft cobalt wash / text on it (used sparingly)                                                  |
| `--secondary` `--muted` `--accent`                                          | quiet warm neutrals (hover, fills)                                                              |
| `--success` `--warning` `--info` `--destructive`                            | semantics, tuned to read AA as text                                                             |
| `--border` `--input` `--ring`                                               | crisp hairlines and cobalt focus ring                                                           |
| `--shadow-xs` `--shadow-card` `--shadow-card-hover` `--shadow-popover`      | seated warm elevation scale                                                                     |

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

**Base primitives (Day 5):** `card` (the hero primitive), `button` (cobalt
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

**Brand:** `components/brand/logo.tsx` — `TharrosMark` (sharp chamfered cobalt
tile with a cut-out "T", single-colour via `currentColor`) and `TharrosWordmark`.

**Layout helpers:** `components/page-header.tsx`, `components/stat-card.tsx`,
`components/theme-toggle.tsx`.

**Browser surfaces:** selection, text carets, focus scroll margins, tap highlights,
and scrollbars are themed from the same token ramp. Skeletons use one restrained
surface shimmer with a reduced-motion fallback instead of unrelated spinners.

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

## Layering

Three light surfaces, used deliberately: the **canvas** (`--background`), the
**card** (`--card`, lifts above the canvas on `--shadow-card`), and the new
**inset layer** `--surface-2` (a panel seated INTO a card: list rows inside a
focal card, code/quote wells, grouped form sections). The elevation ramp is
`--shadow-xs < card < card-hover < raised < popover < modal`; `raised` is for
sticky in-page chrome (sub-navs, floating selection bars), `modal` for the
heaviest overlays. Z-index is semantic only: `z-subnav` (20) < `z-topbar` (30)
< `z-overlay` (50) < `z-toast` (60). Never an arbitrary `z-40`/`z-[999]`.

## Motion

Motion is part of the build, not garnish: it conveys state (selection moved,
row left, panel opened), lands in the 150-300ms window, and always eases out.
The stack is two-layer:

- **CSS / Base UI data-attributes** for overlay enter/exit
  (`data-[starting-style]` / `data-[ending-style]`), as before.
- **`motion`** (`motion/react`) for springs, layout animation, and presence.
  `MotionProvider` (in `components/motion/`, mounted once in the root layout)
  wraps the app in `LazyMotion strict` + `MotionConfig reducedMotion="user"`.
  Always import `m.*`, never `motion.*` (strict mode throws).

**The Base UI / motion treaty — one pattern per job, never both on one element:**

| Job                                                                                        | Pattern                                                                                                                                       |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Base UI overlays (dialog, sheet, dropdown, tooltip, select, toast, popover)                | CSS `data-[starting-style]` / `data-[ending-style]` ONLY. Never wrap a Base UI Popup in `AnimatePresence`; both drive unmount and they fight. |
| In-page conditional content (filter chips, selection bars, rows leaving a list)            | `AnimatePresence` + `m.div`                                                                                                                   |
| Position changes inside a view (active-nav pill, tab indicator, a shift chip moving cells) | `layout` / `layoutId`                                                                                                                         |
| Expand / collapse                                                                          | `AnimateHeight`                                                                                                                               |

Shared vocabulary lives in `components/motion/springs.ts` (`spring.snappy`,
`spring.gentle`, `ease.standard`, `ease.fast`) — pick from it instead of
inventing per-component timings. Primitives: `FadeIn`, `StaggerGroup`/`StaggerItem`
(state-driven lists only — page-load choreography stays banned in the app),
`AnimateHeight`, `PressScale` (card-shaped hit areas; buttons keep CSS
`active:`), `CountUp` (stats; renders the real value server-side).

**Reduced motion is two-layer and both are required:** the global CSS clamp in
`globals.css` (0.01ms) covers CSS transitions, and `MotionConfig
reducedMotion="user"` covers motion's JS springs. Primitives additionally use
`useReducedMotion()` where an opacity-only fallback reads better than nothing.

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
