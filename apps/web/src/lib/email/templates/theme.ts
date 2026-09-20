/**
 * Email-safe Strip Board palette. Email clients cannot read CSS custom
 * properties or OKLCH, so these are sRGB conversions of the tokens in
 * app/globals.css rather than a separate palette that drifts from it. Emails
 * render light only, which matches the product: stock is the reading surface
 * and the rack is the chrome anchor in the footer.
 *
 * Regenerate these by converting the matching token, not by eye.
 */
export const palette = {
  canvas: "#F0ECE5", // --background: the board
  card: "#FCFAF6", // --card: a strip
  ink: "#1A1710", // --foreground: press black
  mutedInk: "#58534B", // --muted-foreground: AA on board and strip
  border: "#D0CCC1", // --border: printed rule
  primary: "#F2C23D", // --primary: safety yellow, the control
  primaryDark: "#D3A329", // pressed
  primaryText: "#261D02", // --primary-foreground: press black on hi-vis
  anchor: "#242721", // --rack: anodized chrome anchor (footer)
  anchorText: "#E0E0D9",
  anchorMuted: "#9D9E95",
} as const;

export const font =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
