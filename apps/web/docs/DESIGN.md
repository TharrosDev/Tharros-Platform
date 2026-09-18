# Tharros Design System — Workshop

Workshop is the production visual system for Tharros: warm graphite chrome,
clean working surfaces and one restrained cobalt accent. The product should feel
like dependable operating software for a busy small-business owner.

## Principles

- **Grounded, not decorative.** Dark graphite chrome gives the app weight; the
  work happens on a clean light canvas.
- **One decisive accent.** Cobalt marks the primary action, active navigation and
  important state. Do not create competing accent colours.
- **Crisp surfaces.** Cards use defined borders, measured radii and restrained
  elevation. Avoid glassmorphism and generic floating SaaS cards.
- **Real data only.** Never use fabricated customers, metrics, activity or
  operational state in production product surfaces.
- **Clear under pressure.** Errors, warnings, approvals and irreversible actions
  should be obvious without becoming visually noisy.
- **Accessible by default.** WCAG AA contrast, keyboard operation, visible focus
  and reduced-motion support are required.

## Tokens

Global OKLCH variables live in `src/app/globals.css`.

Primary families:

- `--sidebar*` — warm graphite application/marketing chrome;
- `--background` / `--foreground` — working canvas and ink;
- `--card`, `--popover`, `--surface-2` — surface hierarchy;
- `--primary*` — cobalt action/state;
- `--success`, `--warning`, `--info`, `--destructive` — semantic state;
- `--border`, `--input`, `--ring` — structure and focus;
- shared shadow variables — elevation.

Use tokens instead of hard-coded colours. Run
`node scripts/contrast-check.mjs` after token changes.

## Typography

Geist Sans is the UI face and Geist Mono is reserved for numerals/metadata.

Shared classes:

- `.type-display`
- `.type-h1`
- `.type-h2`
- `.type-body`
- `.type-small`
- `.type-meta`
- `.num` for tabular numeric output

Product headings are compact and authoritative rather than oversized marketing
display type.

## Components

Reusable primitives live under `src/components/ui`. Extend those primitives
before creating one-off controls.

Base UI powers overlays such as dialogs, sheets, dropdowns, tooltips, selects and
toasts. Do not add a second overlay framework for convenience.

Important shared structure:

- `components/page-header.tsx`
- `components/stat-card.tsx`
- `components/shell/*`
- `components/brand/logo.tsx`
- `components/motion/*`

## Shell and information architecture

Primary navigation contains only production product/workspace surfaces:

- Dashboard
- AI Assistant
- Scheduling
- Lead Capture
- Automations
- Knowledge
- Notifications
- Profile
- Settings
- Billing

Scheduling has its own sub-navigation for overview, schedule, team,
availability, conversations, analytics and activity.

Public marketing surfaces are home, pricing, security, privacy and terms. Paid
product surfaces are shown only when they are genuinely implemented; tier gates
handle access to Lead Capture and Automations.

## Layering

Use the shared semantic surface/elevation stack:

`canvas < surface-2 < card < raised < popover < modal`

Use semantic z-index utilities. Do not introduce arbitrary extreme z-index
values.

## Motion

Motion communicates state; it is not decoration.

- Base UI overlays use CSS data-state transitions.
- In-page entrances/exits may use `AnimatePresence`.
- Position changes use `layout` / `layoutId`.
- Expand/collapse uses the shared `AnimateHeight`.
- Import `m.*`, not `motion.*`, because the shared MotionProvider uses strict
  LazyMotion.
- Respect both CSS reduced-motion rules and `MotionConfig reducedMotion="user"`.

Typical interaction motion belongs around 150–300ms and should ease out.

## Content

Write for a busy owner.

- plain words;
- short sentences;
- concrete outcomes;
- no implementation jargon in customer copy;
- no fake certainty from AI;
- no claim that a roadmap capability exists;
- no emoji in core product UI;
- avoid em dashes in UI copy.

Manager-facing consequential actions should state what will happen before the
action and make destructive/irreversible outcomes explicit.

## Dark mode

Light/dark theming uses `next-themes` and the same semantic token system.
Components must remain legible and coherent in both modes; do not patch dark
mode with isolated hard-coded colours.
