// OKLCH -> sRGB -> WCAG contrast checker for the Maple Pure design tokens.
// Keep the T map in sync with src/app/globals.css; run after any token change
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
  // light
  background: [0.94, 0.006, 40],
  sidebar: [0.965, 0.005, 40],
  card: [0.99, 0.003, 40],
  foreground: [0.26, 0.014, 40],
  mutedFg: [0.49, 0.02, 40],
  primary: [0.53, 0.17, 40],
  primaryFg: [0.99, 0.01, 80],
  primarySoftFg: [0.46, 0.15, 40],
  primarySoft: [0.93, 0.05, 45],
  success: [0.52, 0.13, 150],
  warning: [0.52, 0.11, 70],
  info: [0.52, 0.13, 250],
  destructive: [0.53, 0.2, 27],
  // dark
  dBg: [0.205, 0.01, 40],
  dCard: [0.245, 0.01, 40],
  dFg: [0.96, 0.006, 80],
  dMutedFg: [0.71, 0.015, 70],
  dPrimary: [0.7, 0.16, 45],
  dPrimaryFg: [0.2, 0.02, 50],
};

const need = (v, min, label) =>
  `${v.toFixed(2)}:1  ${v >= min ? "PASS" : "**FAIL**"}  (need ${min})  ${label}`;

console.log("LIGHT");
console.log(need(contrast(T.foreground, T.card), 4.5, "ink on card"));
console.log(need(contrast(T.foreground, T.background), 4.5, "ink on canvas"));
console.log(need(contrast(T.foreground, T.sidebar), 4.5, "ink on sidebar"));
console.log(need(contrast(T.mutedFg, T.card), 4.5, "muted on card"));
console.log(need(contrast(T.mutedFg, T.background), 4.5, "muted on canvas"));
console.log(need(contrast(T.mutedFg, T.sidebar), 4.5, "muted on sidebar"));
console.log(need(contrast(T.primaryFg, T.primary), 4.5, "white on maple (btn text)"));
console.log(need(contrast(T.primary, T.card), 3, "maple on card (large/icon)"));
console.log(need(contrast(T.primarySoftFg, T.primarySoft), 4.5, "soft-maple text on soft fill"));
console.log(need(contrast(T.success, T.card), 4.5, "success text on card"));
console.log(need(contrast(T.warning, T.card), 4.5, "warning text on card"));
console.log(need(contrast(T.info, T.card), 4.5, "info text on card"));
console.log(need(contrast(T.destructive, T.card), 4.5, "destructive text on card"));

console.log("\nDARK");
console.log(need(contrast(T.dFg, T.dCard), 4.5, "ink on card"));
console.log(need(contrast(T.dFg, T.dBg), 4.5, "ink on canvas"));
console.log(need(contrast(T.dMutedFg, T.dCard), 4.5, "muted on card"));
console.log(need(contrast(T.dMutedFg, T.dBg), 4.5, "muted on canvas"));
console.log(need(contrast(T.dPrimaryFg, T.dPrimary), 4.5, "ink on maple (btn text)"));
console.log(need(contrast(T.dPrimary, T.dCard), 3, "maple on card (large)"));
