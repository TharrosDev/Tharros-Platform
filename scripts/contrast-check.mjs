// OKLCH -> sRGB -> WCAG contrast checker for the Workshop design tokens.
// Keep the T map in sync with src/app/globals.css (light only); run after any token change
// to confirm every text pair still meets WCAG AA.
// Run: node scripts/contrast-check.mjs

function oklchToSrgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3,
    m = m_ ** 3,
    s = s_ ** 3;
  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const toGamma = (x) => {
    const c = Math.max(0, Math.min(1, x));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  };
  return [toGamma(r), toGamma(g), toGamma(bl)];
}
function relLum([r, g, b]) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(fg, bg) {
  const L1 = relLum(oklchToSrgb(...fg));
  const L2 = relLum(oklchToSrgb(...bg));
  const [a, b] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (a + 0.05) / (b + 0.05);
}

const T = {
  background: [0.976, 0.007, 265],
  card: [0.998, 0.002, 265],
  foreground: [0.205, 0.025, 265],
  mutedFg: [0.47, 0.025, 265],
  primary: [0.565, 0.205, 267],
  primaryFg: [0.99, 0.004, 265],
  primarySoftFg: [0.43, 0.17, 267],
  primarySoft: [0.935, 0.055, 267],
  accent: [0.945, 0.012, 265],
  success: [0.51, 0.13, 150],
  warning: [0.5, 0.1, 75],
  info: [0.52, 0.15, 255],
  destructive: [0.53, 0.2, 27],
  surface2: [0.962, 0.009, 265],
  surface2Fg: [0.205, 0.025, 265],
  sidebar: [0.992, 0.003, 265],
};

const need = (v, min, label) =>
  `${v.toFixed(2)}:1  ${v >= min ? "PASS" : "**FAIL**"}  (need ${min})  ${label}`;

console.log("SURFACES");
console.log(need(contrast(T.foreground, T.card), 4.5, "ink on card"));
console.log(need(contrast(T.foreground, T.background), 4.5, "ink on canvas"));
console.log(need(contrast(T.mutedFg, T.card), 4.5, "muted on card"));
console.log(need(contrast(T.mutedFg, T.background), 4.5, "muted on canvas"));
console.log(need(contrast(T.surface2Fg, T.surface2), 4.5, "ink on surface-2"));
console.log(need(contrast(T.mutedFg, T.surface2), 4.5, "muted on surface-2 (table header)"));
console.log(need(contrast(T.mutedFg, T.accent), 4.5, "muted on hover surface"));

console.log("\nCOBALT");
console.log(need(contrast(T.primaryFg, T.primary), 4.5, "white on cobalt (buttons, badges)"));
console.log(need(contrast(T.primary, T.card), 4.5, "cobalt text on card"));
console.log(need(contrast(T.primary, T.background), 3, "cobalt on canvas (LARGE text only)"));
console.log(need(contrast(T.primarySoftFg, T.primarySoft), 4.5, "soft-cobalt text on soft fill (active nav, badges)"));
console.log(need(contrast(T.primarySoftFg, T.card), 4.5, "soft-cobalt text on card"));
console.log(need(contrast(T.primarySoftFg, T.background), 4.5, "soft-cobalt labels on canvas"));

console.log("\nCHROME");
console.log(need(contrast(T.foreground, T.sidebar), 4.5, "nav text on sidebar"));
console.log(need(contrast(T.mutedFg, T.sidebar), 4.5, "nav muted on sidebar"));
console.log(need(contrast(T.card, T.foreground), 4.5, "tooltip text (card on ink)"));

console.log("\nSTATE");
for (const [name, v] of [["success", T.success], ["warning", T.warning], ["info", T.info], ["destructive", T.destructive]]) {
  console.log(need(contrast(v, T.card), 4.5, name + " text on card"));
  console.log(need(contrast(v, T.background), 4.5, name + " text on canvas"));
}
