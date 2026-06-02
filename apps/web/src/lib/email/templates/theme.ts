/**
 * Email-safe "Workshop" palette. Email clients can't read CSS custom properties
 * or OKLCH, so these are static hex approximations of the light-mode tokens in
 * app/globals.css. Emails render light-mode only (dark-mode email support is
 * inconsistent across clients), mirroring the app's clean cool canvas + cobalt
 * accent + warm-graphite chrome anchor.
 */
export const palette = {
  canvas: "#F5F7F9", // --background: whisper-cool off-white
  card: "#FDFDFE", // --card: near-pure white
  ink: "#1C1F26", // --foreground: near-black
  mutedInk: "#545861", // --muted-foreground: AA on canvas + card
  border: "#DCDEE1", // --border
  primary: "#3862C4", // --primary: cobalt (AA with white text)
  primaryDark: "#2850B0", // hover/pressed cobalt
  primaryText: "#FAFCFF", // --primary-foreground: off-white on cobalt
  anchor: "#211D1A", // --sidebar: warm-graphite chrome anchor (footer)
  anchorText: "#F3F1EF",
  anchorMuted: "#A9A49E",
} as const;

export const font =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
