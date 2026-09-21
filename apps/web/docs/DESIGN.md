---
name: "Tharros — Common Ground"
description: "A bright, welcoming workspace for Canadian businesses and organizations, large and small."
colors:
  rack: "oklch(0.975 0.009 250)"
  rack-deep: "oklch(0.945 0.018 250)"
  rack-edge: "oklch(0.6 0.025 250)"
  rack-foreground: "oklch(0.28 0.045 255)"
  rack-muted-foreground: "oklch(0.46 0.033 255)"
  background: "oklch(0.985 0.004 250)"
  foreground: "oklch(0.28 0.045 255)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.28 0.045 255)"
  popover: "oklch(1 0 0)"
  popover-foreground: "oklch(0.28 0.045 255)"
  muted: "oklch(0.955 0.012 250)"
  muted-foreground: "oklch(0.46 0.033 255)"
  secondary: "oklch(0.95 0.02 250)"
  secondary-foreground: "oklch(0.32 0.04 255)"
  accent: "oklch(0.925 0.025 250)"
  accent-foreground: "oklch(0.28 0.045 255)"
  surface-2: "oklch(0.955 0.016 250)"
  surface-2-foreground: "oklch(0.28 0.045 255)"
  surface-3: "oklch(0.915 0.024 250)"
  surface-3-foreground: "oklch(0.28 0.045 255)"
  primary: "oklch(0.475 0.17 265)"
  primary-foreground: "oklch(1 0 0)"
  primary-soft: "oklch(0.935 0.029 265)"
  primary-soft-foreground: "oklch(0.42 0.15 265)"
  primary-edge: "oklch(0.475 0.17 265)"
  destructive: "oklch(0.505 0.195 29)"
  destructive-foreground: "oklch(0.985 0.008 60)"
  success: "oklch(0.475 0.115 150)"
  success-foreground: "oklch(0.985 0.008 150)"
  warning: "oklch(0.505 0.115 60)"
  warning-foreground: "oklch(0.985 0.008 80)"
  info: "oklch(0.495 0.095 228)"
  info-foreground: "oklch(0.985 0.008 228)"
  stock-pending: "oklch(0.96 0.033 80)"
  stock-signal: "oklch(0.95 0.026 30)"
  stock-cleared: "oklch(0.95 0.029 160)"
  stock-procedure: "oklch(0.95 0.025 250)"
  border: "oklch(0.88 0.016 250)"
  input: "oklch(0.61 0.03 250)"
  ring: "oklch(0.475 0.17 265)"
  sidebar-accent: "oklch(0.91 0.038 265)"
  sidebar-accent-foreground: "oklch(0.36 0.13 265)"
  sidebar-ring: "oklch(0.475 0.17 265)"
  marketing-blue: "#edf2fd"
  marketing-mint: "#eaf5ef"
  marketing-peach: "#fcf0e6"
  marketing-lavender: "#f1edfa"
  marketing-preview: "#e8edfc"
typography:
  hero:
    fontFamily: "Nunito Sans, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 5.4vw, 5rem)"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "-0.03em"
  display:
    fontFamily: "Nunito Sans, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 4.6vw, 4rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  h1:
    fontFamily: "Nunito Sans, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  h2:
    fontFamily: "Nunito Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Nunito Sans, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
  small:
    fontFamily: "Nunito Sans, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  control:
    fontFamily: "Nunito Sans, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.005em"
  meta:
    fontFamily: "Nunito Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0.005em"
  strip:
    fontFamily: "Nunito Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
  marketing-hero:
    fontFamily: "Nunito Sans, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 5vw, 4.75rem)"
    fontWeight: 750
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  marketing-heading:
    fontFamily: "Nunito Sans, system-ui, sans-serif"
    fontSize: "clamp(2rem, 3.3vw, 3.25rem)"
    fontWeight: 750
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  code:
    fontFamily: "Geist Mono, ui-monospace, monospace"
rounded:
  sm: "0.5rem"
  md: "0.625rem"
  lg: "0.75rem"
  xl: "1rem"
  2xl: "1.25rem"
  3xl: "1.5rem"
  4xl: "2rem"
  pill: "9999px"
spacing:
  control-sm: "2.25rem"
  control: "2.75rem"
  control-lg: "3rem"
  rail: "16rem"
  topbar: "4.5rem"
  board-max: "88rem"
  card-inset: "1.25rem"
  marketing-section: "6.5rem"
  marketing-section-mobile: "4rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "0 1rem"
    height: "{spacing.control}"
  button-soft:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-soft-foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "0 1rem"
    height: "{spacing.control}"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.xl}"
    padding: "0 1rem"
    height: "{spacing.control}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "0 1rem"
    height: "{spacing.control}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "0 1rem"
    height: "{spacing.control}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "0 1rem"
    height: "{spacing.control}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.strip}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.75rem"
    height: "{spacing.control}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "1.25rem"
  badge:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-soft-foreground}"
    typography: "{typography.meta}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.625rem"
  public-navigation:
    textColor: "{colors.muted-foreground}"
    rounded: "0.65rem"
    padding: "0.5rem 0.75rem"
---

# Design System: Tharros — Common Ground

## Overview

**Creative North Star: "Common Ground"**

Common Ground makes dependable operating software feel approachable. White and pale-blue surfaces, deep blue actions and softly rounded edges help owners, managers and teams read the next step without an industrial or command-centre atmosphere.

Operational screens use restrained semantic colour and familiar controls. Marketing gives the same world more breathing room and mint, peach and lavender regions, while clearly labelled examples demonstrate real workflows. Human review, understandable state and accessible interaction carry trust.

**Key Characteristics:**

- Daylit neutral surfaces with clear blue actions.
- Natural-width Nunito Sans and sentence-case controls.
- Soft corners and quiet borders around useful groups.
- Colour supports text labels; it never replaces meaning.
- Product examples remain visibly illustrative.

This refresh records `src/app/globals.css`, `src/app/(marketing)/marketing.css`, the root font loader and shared primitives. The implementation is the source of token values; the direction contract is `../.impeccable/surfaces/src-app.md`. Public screenshots support the visual reading, not a claim that every authenticated workflow has been visually verified.

## Colors

Canonical global colours remain in OKLCH; marketing region fills retain their source hex values in the frontmatter.

### Primary

Deep blue (`primary`) identifies actions, links and selected controls. White primary foreground and darker blue soft foreground keep filled and tinted actions distinct. The same blue supplies keyboard focus.

### Secondary

Marketing blue, mint, peach and lavender are soft region fills for product explanations. The preview blue frames the interactive workspace and closing invitation. These fills supplement the restrained app palette rather than changing operational status meanings.

### Tertiary

Success green, warning amber, information blue and destructive red retain semantic foreground pairs. Pale pending, signal, cleared and procedure stocks support contextual rows. Badges are valid, rounded carriers of textual state.

### Neutral

The near-white background, white cards and pale-blue shell create a continuous light workspace. Dark blue-grey foreground and muted foreground carry content. Border is a quiet grouping line; input is the stronger field boundary. Surface 2 and Surface 3 add tonal depth.

The legacy `rack`, `rack-deep`, `on-rack` and `on-stock` names remain compatibility APIs: they now resolve to light surfaces, not dark materials.

**The Shared Ground Rule.** Shell, content and overlays belong to the same light family; preserve semantic token contexts when nesting surfaces.

**The Readable State Rule.** Pair every status colour with a readable label or icon meaning; preserve text, focus and field-boundary contrast.

## Typography

Nunito Sans is the display, body and interface family. The root font loader still exposes it through `--font-archivo`; that historical variable name does not indicate the rendered font. Geist Mono is reserved for code output. Width settings are neutral (100), with sentence-case metadata and controls.

The frontmatter distinguishes the shared hero/display hierarchy from marketing's scoped, heavier headings. Shared page titles are 28px, panel titles 18px, body 15px, supporting text 13px and metadata 12px. Data rows use 14px with tabular figures. Document prose uses 16px, 1.7 line-height and a 68ch maximum reading measure. Marketing paragraphs use 1.75 line-height; hero descriptions are 18px on desktop. At 540px the marketing headline becomes 2.85rem and section headings 2rem.

**The Natural Voice Rule.** Use natural-width, sentence-case type for headings and controls; preserve tabular figures where numbers align.

## Layout

The app retains a 12-column board with an 88rem maximum, a 16rem rail and a 4.5rem topbar. Existing data-row and log grids remain useful alignment structures; their legacy names do not prescribe the old aesthetic. Default controls are 44px tall, small controls 36px and large controls 48px. Cards use 20px horizontal inset, 16px header/footer padding and 20px body padding.

Marketing uses an 80rem maximum container with 2.5rem side margins. The homepage hero balances copy with a slightly wider interactive workspace. Reused explanatory regions use two-column grids; plans and setup steps use three columns. Section spacing is 6.5rem on desktop.

At 1150px public navigation becomes a menu. At 800px the container becomes at most 42rem with 1.25rem side margins, major paired sections stack, and section spacing drops to 4rem. At 540px product grids, plans and setup steps become single-column. Comparison tables retain a 38rem minimum inside an explicit horizontal scroll container with a mobile hint. Preserve content order, labelled controls and wrapping rather than shrinking content to fit.

## Elevation & Depth

Depth is primarily tonal: light page, pale region, white card. Shared cards have a border and no default shadow. The interactive marketing workspace uses a soft ambient shadow; selected demo tabs use the smallest shadow. Raised navigation and portalled popovers/dialogs use the existing raised, popover and modal tokens. The sidecar records exact shadow values rather than imposing an obsolete ban on page shadows.

State transitions use 120ms, travel uses 220ms and the shared ease-out curve. Existing seating, fade and shimmer animations remain bounded enhancement. Reduced motion collapses transitions and animations and removes the shimmer background. Do not interpret decorative movement as task completion.

## Shapes

Rounded forms are central: shared controls and inputs use the large radius, cards and outline buttons use the extra-large radius. The reusable scale spans 8–32px; pills and avatars use full rounding. Marketing previews use a 24px outer frame with a 16px white workspace inside. Fine borders organize content without the old heavy industrial edges.

## Components

### Buttons

Primary actions use blue with white text and a matching one-pixel edge. Soft actions pair blue tint with darker blue text; outline buttons use white and the input boundary. Secondary, ghost, destructive and underlined link variants remain available. Shared button hover changes fill; press moves by one pixel. Disabled controls reduce opacity and stop interaction. The global focus outline is two pixels with a two-pixel offset.

### Inputs / Fields

White, softly rounded fields use the input boundary, data-row typography and muted placeholders. Hover strengthens the boundary; invalid state uses a two-pixel destructive edge. Labels must remain visible and errors must be understandable without colour alone.

### Cards

White, bordered cards group related content. Header and footer separators are quiet. Content begins with a panel title and optional supporting text; cards are allowed in this system, including a white workspace within a tinted marketing region.

### Chips

Pill badges carry readable sentence-case state. Soft blue is the default; solid, secondary, outline and semantic variants retain their paired foregrounds. Passive badges are not buttons.

### Navigation

The public header uses text links with a 44px minimum height, gentle rounding and pale-blue hover. Mobile navigation exposes the same destinations. The light app shell keeps operational context separate from content through placement and selected-state tint rather than dark chrome.

### Interactive workspace

Four labelled feature tabs select illustrative workflows. A white active tab with blue text sits in a pale-blue tab tray. Source reveals, schedule review, draft inspection and simulated workflow results stay local to the example. Maintain keyboard operation and explicit illustrative labelling; never present the example as a live organization record.

## Do's and Don'ts

### Do:

- Do use semantic colours and shared controls for operational work.
- Do keep visible keyboard focus and reduced-motion behavior.
- Do use comfortable rounded groups and clear spacing to reveal hierarchy.
- Do label demonstrations and keep consequential actions under human control.
- Do validate contrast after changing colour tokens.

### Don't:

- Don't restore the dark olive shell, square control system or condensed uppercase identity.
- Don't communicate status using colour alone.
- Don't promote marketing's tiny demo labels to ordinary app body text.
- Don't fabricate customer proof, live activity or unshipped integrations.
