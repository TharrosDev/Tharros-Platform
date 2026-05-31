# Tharros Platform — Design System ("Maple Pure")

The look every screen inherits. Established Day 5. Goal: a calm, warm, trustworthy
dashboard for non-technical small-business owners. Cards lead, lots of air, one
maple accent used sparingly.

## Principles

- **Warm-grey canvas, cards that lift.** The page is a warm off-grey; cards are
  near-white and float on a soft shadow (no harsh borders). Depth comes from the
  shadow, not from lines or glassmorphism.
- **One accent: maple.** A warm red-orange, used for the primary action, the
  active nav item, and small highlights. Never more than one maple call-to-action
  competing in a view. Soft maple (`primary-soft`) carries badges and quiet fills.
- **Generous and rounded.** Large radius (`--radius: 0.875rem`), roomy padding,
  friendly type. Nothing cramped.
- **Light and dark.** Both ship from the same tokens. Dark is a warm near-black,
  not pure grey; maple brightens so it stays legible.

## Tokens

All tokens are OKLCH CSS variables in `src/app/globals.css`, reusing shadcn
variable names so every component inherits them. Neutrals sit in a warm hue
(~60–80); maple lives near hue 38. Change a token and the whole app re-skins.

| Token | Role |
| --- | --- |
| `--background` / `--foreground` | warm-grey canvas / warm ink |
| `--card` / `--popover` | near-white surfaces that lift on `--shadow-card` |
| `--primary` / `--primary-foreground` | maple action colour / text on it |
| `--primary-soft` / `--primary-soft-foreground` | soft maple wash / text on it |
| `--secondary` `--muted` `--accent` | quiet warm neutrals (hover, fills) |
| `--success` `--warning` `--info` `--destructive` | semantics |
| `--border` `--input` `--ring` | hairlines and maple focus ring |
| `--shadow-card` / `--shadow-card-hover` | soft card depth |

## Type scale

Geist Sans for UI, Geist Mono for numerals and metadata. Utility classes in
`globals.css`: `.type-display`, `.type-h1`, `.type-h2`, `.type-body`,
`.type-small`, `.type-meta` (mono, uppercase, tracked). Use `.num` for tabular
mono numerals on any stat or figure.

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
