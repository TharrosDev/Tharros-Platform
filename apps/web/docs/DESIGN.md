# Tharros Platform — Design System ("Maple Pure")

The look every screen inherits. Established Day 5. Goal: a calm, warm, trustworthy
dashboard for non-technical small-business owners. Cards lead, lots of air, one
maple accent used sparingly.

## Principles

- **Warmth from the brand, not from beige.** The neutral ramp is tinted toward
  maple's own hue (~40) at very low chroma, so it reads as a warm stone, never
  the cream / parchment near-white that hue ~75 produces (the SaaS-cream default
  we explicitly avoid). Warmth is carried by the accent, copy, and this tint.
- **Depth by layering.** Three surface steps, each a shade lighter: canvas
  (`--background`) -> sidebar (`--sidebar`) -> card (`--card`). Cards lift on a
  soft, warm-tinted shadow. No harsh borders, no glassmorphism.
- **One accent: maple.** A warm red-orange for the primary action, current
  selection, and state only, never decoration. Never more than one maple CTA
  competing in a view. Soft maple (`--primary-soft`) carries badges and quiet fills.
- **Generous and rounded.** Large radius (`--radius: 0.875rem`), roomy padding,
  friendly type. Nothing cramped.
- **Light and dark, both AA.** Both ship from the same tokens; dark is a warm
  near-black. Every text pair meets WCAG AA (verified by computing OKLCH ->
  WCAG contrast over the ramp).

## Tokens

All tokens are OKLCH CSS variables in `src/app/globals.css`, reusing shadcn
variable names so every component inherits them. The whole neutral ramp and the
accent share hue ~40 (maple's family); change a token and the app re-skins.

| Token | Role |
| --- | --- |
| `--background` / `--foreground` | warm-stone canvas / warm ink |
| `--sidebar` (+ `-foreground` / `-accent` / `-border`) | second neutral layer: app chrome |
| `--card` / `--popover` | near-white surfaces that lift on `--shadow-card` |
| `--primary` / `--primary-foreground` | maple action colour / text on it |
| `--primary-soft` / `--primary-soft-foreground` | soft maple wash / text on it |
| `--secondary` `--muted` `--accent` | quiet warm neutrals (hover, fills) |
| `--success` `--warning` `--info` `--destructive` | semantics, tuned to read AA as text |
| `--border` `--input` `--ring` | hairlines and maple focus ring |
| `--shadow-xs` `--shadow-card` `--shadow-card-hover` `--shadow-popover` | warm elevation scale |

## Type scale

Geist Sans for UI, Geist Mono for numerals and metadata. The scale is **fixed
rem, not fluid** (product UI views at consistent DPI; clamp headings don't serve
it), with a ~1.25+ ratio between steps: `.type-display` 36px, `.type-h1` 24px,
`.type-h2` 19px, `.type-body` 15px, `.type-small` 13px, `.type-meta` 11px (mono,
uppercase, tracked). Use `.num` for tabular mono numerals on any stat or figure.

## Components (Day 5)

Hand-authored under `src/components/ui/` (the shadcn CLI does not run in this
monorepo), skinned to the tokens above:

- `card` (the hero primitive), `button` (maple `default` + `soft` variant),
  `badge` (incl. `solid`/`success`/`warning`/`info`), `separator`, `input`,
  `textarea`, `label`, `skeleton`, `avatar`.
- Brand: `components/brand/logo.tsx` — `TharrosMark` (original rounded maple tile
  with a cut-out "T", single-colour via `currentColor`) and `TharrosWordmark`.
- Layout: `components/page-header.tsx`, `components/stat-card.tsx`,
  `components/theme-toggle.tsx`.
- Proof screen: `src/app/page.tsx` renders the full dashboard showcase.

### Deferred to Day 6 (when first used)

Overlay/interactive primitives — Dialog, DropdownMenu, Tooltip, Tabs, Sonner —
build on the repo's Base UI (`base-nova`) layer and aren't needed until the authed
app shell exists. They are intentionally not added yet.

## Voice — Warm Canadian

All UI copy is warm, plain, and human. It leans into the local/Canadian identity
("Local & Canadian") and talks to a busy owner, not an enterprise buyer.

- Warm and reassuring: "Nothing needs you right this second."
- Plain words over jargon. Short sentences. Concrete nouns.
- **No em-dashes in UI copy** (founder preference; commas or periods instead).
- Speak to the person ("Hey Magnus"), name the outcome, never the plumbing.
