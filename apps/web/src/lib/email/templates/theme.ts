/**
 * Email-safe Maple Pure palette. Email clients can't read CSS custom properties
 * or OKLCH, so these are static hex approximations of the light-mode tokens in
 * app/globals.css. Emails render light-mode only (dark-mode email support is
 * inconsistent across clients), mirroring the app's warm-stone canvas + maple
 * accent + grounded dark ink anchor.
 */
export const palette = {
  canvas: "#ECE7E2", // --background: warm light stone
  card: "#FCFBFA", // --card: near-white pillow
  ink: "#2B2520", // --foreground: warm near-black
  mutedInk: "#6A5F56", // --muted-foreground: AA on canvas + card
  border: "#DAD4CE", // --border
  maple: "#A8451F", // --primary: deeper maple (AA with white text)
  mapleDark: "#8F3A18", // hover/pressed maple
  mapleText: "#FBF6F0", // --primary-foreground: warm off-white on maple
  anchor: "#2C2622", // --sidebar: grounded warm-dark ink (footer)
  anchorText: "#E6E0DA",
  anchorMuted: "#A89E94",
} as const;

export const font =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
