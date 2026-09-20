---
name: Tharros — The Strip Board
description: A dispatch rack for small-business operations: dark anodized chrome, warm printed stock, safety yellow as the only control colour.
colors:
  rack: "oklch(0.268 0.013 132)"
  rack-deep: "oklch(0.222 0.012 132)"
  rack-edge: "oklch(0.56 0.018 132)"
  rack-foreground: "oklch(0.905 0.01 108)"
  rack-muted-foreground: "oklch(0.695 0.012 108)"
  board: "oklch(0.945 0.011 86)"
  press-black: "oklch(0.205 0.013 80)"
  strip: "oklch(0.952 0.013 86)"
  popover: "oklch(0.985 0.006 86)"
  muted: "oklch(0.918 0.012 86)"
  muted-foreground: "oklch(0.445 0.015 80)"
  accent: "oklch(0.905 0.016 86)"
  surface-2: "oklch(0.928 0.012 86)"
  surface-3: "oklch(0.878 0.015 86)"
  safety-yellow: "oklch(0.835 0.152 88)"
  safety-yellow-foreground: "oklch(0.235 0.045 90)"
  safety-yellow-soft: "oklch(0.935 0.07 90)"
  ochre-ink: "oklch(0.415 0.095 75)"
  primary-edge: "oklch(0.235 0.045 90)"
  signal-red: "oklch(0.505 0.195 29)"
  cleared-green: "oklch(0.475 0.115 150)"
  pending-amber: "oklch(0.505 0.115 60)"
  procedure-cyan: "oklch(0.495 0.095 228)"
  stock-pending: "oklch(0.925 0.095 92)"
  stock-signal: "oklch(0.918 0.055 32)"
  stock-cleared: "oklch(0.925 0.05 150)"
  stock-procedure: "oklch(0.925 0.042 228)"
  rule: "oklch(0.845 0.015 86)"
  field-edge: "oklch(0.6 0.02 86)"
  ring-ochre: "oklch(0.5 0.12 78)"
  ring-hivis: "oklch(0.845 0.145 88)"
typography:
  hero:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(3rem, 6.4vw, 5.75rem)"
    fontWeight: 700
    lineHeight: 0.93
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 82"
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 4.6vw, 4rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 86"
  count:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 5vw, 3.75rem)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 88"
    fontFeature: "tabular-nums"
  h1:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 90"
  h2:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 94"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
  small:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  strip:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
    fontFeature: "tabular-nums"
  log:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0.01em"
    fontFeature: "tabular-nums"
  control:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 78"
  meta:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 78"
  code:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  none: "0rem"
  sm: "0rem"
  md: "0rem"
  lg: "0rem"
  xl: "0rem"
  notch: "0.125rem"
spacing:
  rule: "1px"
  rule-heavy: "2px"
  ring-width: "2px"
  control-sm: "2rem"
  control: "2.5rem"
  control-lg: "2.75rem"
  rail: "15rem"
  topbar: "3.5rem"
  board-max: "88rem"
components:
  button-primary:
    backgroundColor: "{colors.safety-yellow}"
    textColor: "{colors.safety-yellow-foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "0 1rem"
    height: "{spacing.control}"
  button-primary-hover:
    backgroundColor: "{colors.safety-yellow}"
    textColor: "{colors.safety-yellow-foreground}"
  button-soft:
    backgroundColor: "{colors.safety-yellow-soft}"
    textColor: "{colors.ochre-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "0 1rem"
    height: "{spacing.control}"
  button-outline:
    backgroundColor: "{colors.strip}"
    textColor: "{colors.press-black}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "0 1rem"
    height: "{spacing.control}"
  button-destructive:
    backgroundColor: "{colors.signal-red}"
    textColor: "{colors.board}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "0 1rem"
    height: "{spacing.control}"
  input:
    backgroundColor: "{colors.strip}"
    textColor: "{colors.press-black}"
    typography: "{typography.strip}"
    rounded: "{rounded.none}"
    padding: "0.5rem 0.75rem"
    height: "{spacing.control}"
  strip-pending:
    backgroundColor: "{colors.stock-pending}"
    textColor: "{colors.press-black}"
    typography: "{typography.strip}"
    rounded: "{rounded.none}"
    padding: "0.625rem 0.75rem"
  strip-cleared:
    backgroundColor: "{colors.stock-cleared}"
    textColor: "{colors.press-black}"
    typography: "{typography.strip}"
    rounded: "{rounded.none}"
    padding: "0.625rem 0.75rem"
  strip-signal:
    backgroundColor: "{colors.stock-signal}"
    textColor: "{colors.press-black}"
    typography: "{typography.strip}"
    rounded: "{rounded.none}"
    padding: "0.625rem 0.75rem"
  strip-procedure:
    backgroundColor: "{colors.stock-procedure}"
    textColor: "{colors.press-black}"
    typography: "{typography.strip}"
    rounded: "{rounded.none}"
    padding: "0.625rem 0.75rem"
  initials-box:
    backgroundColor: "{colors.strip}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.meta}"
    rounded: "{rounded.none}"
    padding: "0 0.5rem"
    height: "1.75rem"
    width: "2.75rem"
  rail:
    backgroundColor: "{colors.rack}"
    textColor: "{colors.rack-foreground}"
    typography: "{typography.meta}"
    rounded: "{rounded.none}"
    width: "{spacing.rail}"
  topbar:
    backgroundColor: "{colors.rack}"
    textColor: "{colors.rack-foreground}"
    typography: "{typography.meta}"
    rounded: "{rounded.none}"
    height: "{spacing.topbar}"
---

# Design System: Tharros — The Strip Board

## Overview

**Creative North Star: "The Dispatch Strip Board"**

Every unit of work is a printed strip seated in a rack, and its position in the rack is
its status. The machine prints the strip, a person initials it, and advancing it writes
the record. Two grounds carry the whole system: the **rack** is dark anodized
olive-graphite chrome that frames and never holds working data, and the **stock** is warm
printed board that carries everything you read and act on. There is no third material.

The register is a back office at 6:45am under overhead fluorescent. Density is high and
ornament is nil: hierarchy comes from a strict grid, printed hairline rule work and
condensed caps, never from added containers. There are no cards, therefore no nested
cards. Nothing on the board floats on shadow. Nothing is rounded — strips are cut square,
and the single curve permitted in the system is a 2px tab notch.

Safety yellow is the only accent, and it is a control, not a decoration: it marks the one
thing you press. State never arrives as a coloured pill bolted onto content; it arrives as
the tint of the paper the strip is printed on plus a 4px tab down its leading edge. The
memorable object is the empty initials box: every consequential thing the AI produced
arrives carrying a blank box only a person can fill.

**Key Characteristics:**

- Two grounds, one system: anodized rack chrome, warm printed stock content.
- Zero radius everywhere, by contract; one 2px notch is the sole exception.
- State is material (stock tint + tab), never a badge floated on content.
- Safety yellow is a fill and never ink; a hi-vis control is always struck with a press-black rule.
- Condensed uppercase Archivo for labels and controls; tabular figures for every number in a column.
- One authored motion moment: a strip seating into its slot.
- One focus rule for the entire system, drawn from the ground it sits on.

## Colors

A full-palette system where colour is information: two grounds plus four semantic states,
each state existing as both a saturated ink and a pale stock tint. Values are canonical
OKLCH in `src/app/globals.css`; the frontmatter above is normative.

### Primary

- **Safety Yellow** (`--primary`): the control colour. It marks the single primary action
  in a view, the seated strip in the rack rail, and the filled initials box on hover. It is
  a _fill_ only.
- **Ochre Ink** (`--primary-soft-foreground`): the text form of the accent. Every time the
  accent has to be read rather than pressed — a link in prose, a soft button's legend, a
  default badge — this is the token. On the rack context it resolves to safety yellow itself,
  which is legible there.
- **Press Black Edge** (`--primary-edge`): the rule struck around any hi-vis fill.

### Secondary

- **Anodized Olive-Graphite** (`--rack`) and **Rail Well** (`--rack-deep`): the chrome. Rail,
  topbar, mobile drawer, marketing ground. Never holds working data.
- **Machined Edge** (`--rack-edge`): the seam that divides the rack. A rack is divided by
  edges, not by shadow. Measures 3.27:1 against the rack.

### Tertiary (semantic state)

Each state ships as an ink with a paired foreground, and as a pale stock tint for the strip
it prints on:

- **Signal Red** (`--destructive` / `--stock-signal`): stop, needs-initials, destructive.
- **Cleared Green** (`--success` / `--stock-cleared`): the work is recorded.
- **Pending Amber** (`--warning` / `--stock-pending`): drafted, awaiting a person.
- **Procedure Cyan** (`--info` / `--stock-procedure`): a line the system printed itself. It is
  the ink of the record log's timestamps.

### Neutral

- **The Board** (`--background`): warm printed board, the ground every strip lies on.
- **A Strip** (`--card`): printed stock, deliberately not white.
- **Press Black** (`--foreground`): all primary ink on stock.
- **Muted Ink** (`--muted-foreground`): secondary ink on stock; AA on board and strip.
- **Printed Rule** (`--border`) / **Field Edge** (`--input`, 3:1 on stock) / **Machined Ochre Ring** (`--ring`).
- **Inset stock** (`--surface-2`, `--surface-3`): a recess inside a panel, and the deeper step under it.

### Named Rules

**The Three Contexts Rule.** Every surface sits in exactly one of three token contexts, and
reaching for the wrong one is the single most common way this system breaks. `.on-rack` is
the chrome (rails, topbar, drawers, marketing ground). `.on-rack-deep` is the well inside
it. `.on-stock` puts the stock family _back_ when a light surface is nested inside dark
chrome — without it, the rack context cascades down and you print light ink on light paper.
Each class redefines the whole family (`--foreground`, `--card`, `--muted*`, `--border`,
`--input`, `--primary-soft*`, `--ring`), so every primitive drops in correctly with zero
per-component overrides, and portalled overlays escape the rack and land on stock where
they belong. Two real contrast failures during the build came from omitting `.on-stock`.

**The Fill-Not-Ink Rule.** Safety yellow is a fill, never ink. As text on stock it measures
1.6:1 and fails outright. When the accent must be read, use the ochre ink token, which
resolves correctly in both contexts.

**The Struck Edge Rule.** A hi-vis control is always struck with a press-black rule
(`--primary-edge`, 2px on primary and destructive buttons). The fill has almost no edge
against warm stock, so that rule — not the fill — is the component boundary WCAG 1.4.11
measures. It reads 14.2:1 on the board and 14.5:1 on a strip.

**The Material State Rule.** State lives in the strip's own material: its stock tint and its
4px tab. Never a coloured badge pill floated on top of content.

**The Contrast Gate Rule.** `node scripts/contrast-check.mjs` parses `globals.css` directly
and asserts 57 pairs (41 text, 16 non-text). It runs in CI as `pnpm contrast` alongside
`format:check`. Any token change must keep it green; a token that cannot pass is not a token.

## Typography

**Display / Body / Label Font:** Archivo (variable, `wdth` axis loaded) — the whole system,
carried by one file.
**Code Font:** Geist Mono — code blocks in assistant and knowledge output only.

**Character:** A DIN-lineage grotesque with a real width axis, so rack labels run condensed
and engraved while strip data runs normal and tabular, out of one typeface. Four weights,
four tracking values, one width set. Body ships with `tnum` and `ss01` on by default.

### Hierarchy

- **Hero** (700, `clamp(3rem, 6.4vw, 5.75rem)`, lh 0.93, `wdth` 82): marketing only. The app
  never uses this step.
- **Display** (700, `clamp(2.5rem, 4.6vw, 4rem)`, lh 0.98, `wdth` 86): section-scale display.
- **Count** (700, `clamp(2.75rem, 5vw, 3.75rem)`, tabular): the one large numeral on a board —
  the count of strips awaiting a person. One per screen.
- **H1** (700, 28px, `wdth` 90): page titles.
- **H2** (600, 18px, `wdth` 94): section and panel titles.
- **Body** (400, 15px, lh 1.6): running text. Reference prose (`.doc-prose`) steps up to 16px /
  lh 1.7 with a 68ch measure.
- **Strip** (500, 14px, tabular, tracking 0.01em): a strip's printed data row.
- **Log** (400, 13px, tabular): a line the system printed into the record.
- **Small** (400, 13px): supporting detail under a strip's primary line.
- **Control** (600, 13px, tracking 0.08em, `wdth` 78, UPPERCASE): button legends. One step up
  from a rack label so a button reads as the thing you press.
- **Meta** (600, 12px, tracking 0.08em, `wdth` 78, UPPERCASE): the engraved rack label.

### Named Rules

**The One Uppercase Rule.** Rack labels and control legends are the only uppercase in the
system. Headings, body and strip data are always sentence case.

**The Tabular Column Rule.** Any number read in a column carries tabular figures — via
`.num`, or the strip/log/count steps that bake it in. Digits that jitter between rows break
the board.

**The No One-Off Tracking Rule.** Four tracking tokens exist (`display`, `body`, `data`,
`label`). Components use those; nothing writes a bespoke letter-spacing.

## Layout

A strict 12-column board grid (`.grid-board`) inside an 88rem maximum. The app shell is a
15rem anodized rail plus a 3.5rem sticky topbar; content fills the remainder. Named grid
templates carry the recurring rows rather than being re-declared per surface:
`.grid-strip` is `1fr / 7rem / 8rem / 2.75rem` (what / when / who / initials) and
`.grid-log` is `9rem / 1fr / 6rem` (time / line / source).

Density is operational: strips sit at a 2.75rem minimum row height (the touch floor),
padded `0.625rem 0.75rem`, divided by a single printed hairline with no gap between them —
a rack has no gutters between slots. Control heights are fixed at three steps (2rem / 2.5rem
/ 2.75rem) and used as spacing tokens (`h-control`, `w-control`, `min-h-control-lg`) so a
button, a field and an icon tile all line up on the same baseline.

Responsive behaviour is column collapse, not rearrangement: a strip body wraps its primary
line to full width below `sm` while the rest of the row stays in line, and the rail becomes
a drawer. Stacking order is a semantic z scale (`z-subnav` 20, `z-topbar` 30, `z-widget` 40,
`z-overlay` 50, `z-toast` 60); arbitrary `z-50` / `z-[999]` never appears in app code, so a
popover inside a dialog orders by contract rather than by DOM luck.

### Named Rules

**The Grid-Not-Container Rule.** Hierarchy comes from grid units and rule work. If a layout
needs more separation, spend a grid unit or a rule — do not add a container.

## Elevation & Depth

The board is flat. Depth on stock is conveyed by rule work, stock tint steps
(`surface-2` → `surface-3`) and the two grounds, never by shadow: a field is cut into the
stock rather than floated above it, and the rack is divided by machined seams.

Shadow is reserved for things that are genuinely detached from the page — portalled
overlays. In the shipped primitives that is exactly: dialog and sheet (`--shadow-modal`),
dropdown, select, preview card, toast and tooltip (`--shadow-popover`). Every shadow is a
cool olive-graphite cast, matching what a strip would throw lying in a rail.

### Shadow Vocabulary

- **Popover** (`--shadow-popover`): every floating menu, tooltip, toast and preview surface.
- **Modal** (`--shadow-modal`): dialog and sheet only.
- **Card / Raised / XS** (`--shadow-card`, `--shadow-card-hover`, `--shadow-raised`, `--shadow-xs`):
  tokens retained from the replaced system. Do not reach for these on new surfaces.

### Named Rules

**The Nothing-Floats Rule.** Nothing on the board floats on shadow. If an element is part of
the page, it is flat and bounded by a rule. Only a surface that is genuinely detached from
the document flow casts one.

## Shapes

Square by contract. Every radius step — `sm` through `4xl` — is `0rem` in `@theme inline`;
they exist only so Tailwind's radius utilities resolve to nothing, not to be varied. The
sole curve in the system is `--notch` (0.125rem), reserved for a tab notch.

Form language is cut and printed rather than drawn: 1px printed hairlines on stock
(`.rule-b`, `.rule-t`), a 2px press-black rule for the struck heading or the open bay
(`.rule-heavy-b`), and 1px machined seams on the rack (`.seam-t`, `.seam-r`, `.seam-b`). The
recurring silhouette is the strip: a full-width rectangle with a 4px solid tab down its
leading edge and a bordered empty box at its trailing edge.

## Components

### Buttons

- **Shape:** Square (0 radius), fixed heights 2rem / 2.5rem / 2.75rem, condensed uppercase legend.
- **Primary:** safety yellow fill, press-black ink, 2px press-black edge, `px-4`. Hover darkens
  the fill to 85%. One primary hi-vis action per view.
- **Soft:** pale yellow stock with ochre ink and a hairline edge — the accent when the button
  is secondary in importance but still accent-coloured.
- **Destructive:** signal red fill, light ink, 2px press-black edge.
- **Outline / Secondary / Ghost:** strip or muted stock with a field-edge hairline, press-black
  legend, hover to accent stock. Ghost carries a transparent border so it does not shift on hover.
- **Link:** the small step, underlined, decoration in ochre ink, thickening on hover.
- **All variants:** `active:translate-y-px` — a single pixel of travel answers the press. No
  variant draws its own focus ring.

### Chips (the tab / badge)

- **Style:** square, solid, condensed uppercase, 1px border, `px-1.5 py-px`. Each variant carries
  its own ink pair rather than an alpha wash over whatever sits behind it.
- **State:** `default` is soft yellow with ochre ink; `solid`, `success`, `warning`, `info` and
  `destructive` are full-strength fills with their paired foreground; `secondary` / `outline` are
  neutral stock.
- **Use:** a count or a label. A strip's _status_ is its stock and its tab, not a chip.

### Cards / Containers (the panel)

- **Corner Style:** square (0).
- **Background:** strip stock (`--card`), or inset stock for a recess.
- **Shadow Strategy:** none. See Elevation & Depth.
- **Border:** 1px printed rule all round; header divided from body by a rule, not by elevation.
- **Internal Padding:** `px-4 py-3` header and footer, `px-4 py-4` content.
- **Note:** `Card` is a ruled panel retained so existing surfaces compile while they migrate onto
  the board vocabulary. There are no cards in this system and therefore no nested cards.

### Inputs / Fields

- **Style:** square, strip stock, one visible field-edge rule, 2.5rem tall, `px-3 py-2`, strip type.
  Cut into the stock; no shadow, no inner glow.
- **Hover:** the rule darkens toward press black.
- **Focus:** the one base outline (below). Fields never restyle their own border on focus.
- **Error:** `aria-invalid` thickens the rule to 2px in signal red. **Disabled:** 45% opacity.

### Navigation

- **Rail (`.on-rack`):** section names engraved into the chrome in condensed caps; the current
  page is a hi-vis strip seated in its slot — the same object that carries work on the board,
  reused here to carry place. The seated strip travels on a shared `layoutId`, namespaced so the
  desktop rail and the mobile drawer do not animate between each other.
- **Topbar (`.on-rack`):** 3.5rem, sticky, a machined seam beneath it, breadcrumbs at the left.
  Nav labels and the breadcrumb trail both derive from `shell/nav.ts`, the single source of truth.
- **Bay selectors (section nav):** a scrollable rail of condensed caps with a heavy press-black
  rule struck under the open bay; on `lg+` settings it becomes a vertical list where the open bay
  is a seated strip instead.
- **Mobile:** the rail becomes a drawer over the same rack ground.

### Focus

One rule for the whole system, in `@layer base`: a 2px square outline at 2px offset, drawn from
the ground it sits on — machined ochre on stock, hi-vis on the rack (`.on-rack` /
`.on-rack-deep` override the ring colour). No component draws its own focus ring. The browser
surfaces are themed to match: caret, thin scrollbar, `::selection` in diluted safety yellow with
an `.on-rack` variant, 0.22em underline offset, tabular figures.

### The Strip (signature component)

The board vocabulary lives in `components/board/board.tsx`: **Bay**, **Strip**, **StripBody**,
**InitialsBox**, **RecordLog**, **LogLine**, with a `Tone` union (`plain` / `pending` / `signal` /
`cleared` / `procedure`) mapping to a stock tint and a tab colour.

- A **Bay** is a labelled section: condensed-caps label over a hairline, bordered on three sides.
  The one `lead` bay strikes a 2px press-black rule under its header and prints its count at the
  count step — the only large numeral on the screen.
- A **Strip** is a full-width row printed on its tone's stock, with a 4px tab down its leading
  edge and a hairline beneath it. Its ruled grid is complete enough to read the whole board
  without opening anything: what, detail, when, who, mark.
- The **InitialsBox** is the empty box only a person can fill. It sits at the trailing edge in
  condensed caps inside a 1px press-black-at-45% border; on row hover the border goes solid and
  the box fills with safety yellow.
- The **RecordLog** is what the machine printed for itself: continuous ruled lines with
  procedure-cyan timestamps in tabular figures, never a feed of cards.

Skeletons mirror this exactly (`BaySkeleton`, `HeaderSkeleton`, `LogSkeleton`, `PanelSkeleton`)
so loading looks like an empty rack, not like a different product.

### Empty and denied states

An empty bay is a rail with nothing seated in it: ruled empty slots showing through at a 2.25rem
repeat, a square bordered icon tile at control size, a printed title and a note saying what
belongs here and how to put it there. Never a dashed box. Access and entitlement states
(`NoActiveOrg`, `RoleDenied`, the billing feature gate) all render through this one component, so
"you cannot see this" looks the same everywhere it appears.

### Motion

- **One authored moment.** A strip seating into its slot (`.animate-strip-seat`, 0.26s,
  exponential ease-out, 6px drop). It runs on the lead bay only, staggered 45ms per strip, and
  never section by section down the page.
- **Travel.** A strip moving between bays, and the seated strip in the rail, animate on a shared
  `layoutId` with `spring.snappy` (stiffness 500, damping 34). Nothing else in the system animates
  position.
- **State.** A bare `transition-colors` is already the system's timing: `--dur-state` (120ms) and
  the exponential ease-out are wired into Tailwind's `--default-transition-*`, so no component
  writes a duration or an easing by hand.
- **Runtime.** `m.*` only, under the shared `LazyMotion(domMax, strict)` provider — a stray
  `motion.*` throws. `MotionConfig reducedMotion="user"` covers springs; the CSS clamp in
  `globals.css` collapses transitions to 0.01ms rather than zeroing them, because Base UI overlays
  unmount on the transition-end event. Use `useReducedMotionSafe` wherever render output (not just
  timing) depends on reduced motion.

### Email

`lib/email/templates/theme.ts` is the email-safe sRGB conversion of these same tokens, not a
second palette. Emails render light only: stock is the reading surface and the rack anchors the
footer. Regenerate by converting the matching token, never by eye.

## Do's and Don'ts

### Do:

- **Do** declare the token context explicitly: `.on-rack` for chrome, `.on-rack-deep` for a well,
  `.on-stock` for any light surface nested inside dark chrome.
- **Do** express state as stock tint plus tab, using the `Tone` union.
- **Do** strike every hi-vis fill with `--primary-edge`.
- **Do** use `--primary-soft-foreground` whenever the accent has to be read.
- **Do** use the semantic z classes (`z-topbar`, `z-overlay`, `z-toast`).
- **Do** use the control-height tokens (`h-control`, `h-control-sm`, `h-control-lg`) so controls
  share a baseline.
- **Do** carry tabular figures on every number in a column (`.num` or a tabular type step).
- **Do** run `pnpm contrast` after any token change; all 57 pairs must stay green.
- **Do** keep one primary hi-vis action per view.

### Don't:

- **Don't** set a radius. Every step is 0 by contract; only `--radius-notch` is non-zero.
- **Don't** hand-roll a focus ring on a component. One base rule covers the system.
- **Don't** use safety yellow as text — it measures 1.6:1 on stock.
- **Don't** float a badge pill on content to convey a strip's status.
- **Don't** nest a panel inside a panel. There are no cards, so there are no nested cards.
- **Don't** put a shadow on anything that is part of the page; shadow is for portalled overlays only.
- **Don't** let working data sit on the rack, or chrome sit on stock.
- **Don't** write a bespoke duration, easing or letter-spacing; the tokens cover the system.
- **Don't** animate position on anything but a strip.
- **Don't** import `motion.*`; the strict provider only accepts `m.*`.

## Known gaps

Recorded so absence is not mistaken for a decision:

- **Procedure cyan and signal red have no public surface.** Both are fully tokenised and
  contrast-verified but appear on no route that has been visually reviewed.
- **Pencil annotation, tab notches and edge marks** are named in the direction contract and
  `--notch` is tokenised, but none of the three is built. The tab is a flat 4px bar.
- **The ~30 authenticated surfaces were never visually verified.** `.env.local` holds production
  credentials, so only the five public routes were captured and reviewed. The token layer,
  primitives, skeletons, empty states and access notices carry the world inward, but no one has
  looked at the dashboard, assistant, knowledge, scheduling, leads, automations, settings, billing
  or the portal in this world.
- ~~Shadow drift on authenticated surfaces.~~ **Closed.** The 57 surviving
  `shadow-card` / `shadow-card-hover` / `shadow-raised` / `shadow-xs` usages across 31 files were
  removed after this document first recorded them. Shadow is now reserved for portalled overlays
  (`shadow-popover`, `shadow-modal`) and appears nowhere else in the tree.
- **Contract divergence.** The contract specifies three faces (condensed grotesque, tabular
  grotesque, narrow mono for identifiers); the build ships one — Archivo across its width axis —
  with Geist Mono scoped to code output only, a stated exception. The contract's `#2A2E28` /
  `#F2EFE6` / `#E8B923` / `#C8331F` / `#1F6F8B` hexes were superseded by the OKLCH tokens above,
  which are what shipped and what CI verifies.
