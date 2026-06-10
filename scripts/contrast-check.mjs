// OKLCH -> sRGB -> WCAG contrast checker for the Workshop design tokens.
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
  background: [0.975, 0.004, 264],
  card: [0.995, 0.0015, 264],
  foreground: [0.24, 0.014, 264],
  mutedFg: [0.46, 0.015, 264],
  primary: [0.52, 0.16, 264],
  primaryFg: [0.99, 0.005, 264],
  primarySoftFg: [0.45, 0.14, 264],
  primarySoft: [0.94, 0.035, 264],
  success: [0.51, 0.13, 150],
  warning: [0.5, 0.1, 75],
  info: [0.52, 0.15, 255],
  destructive: [0.53, 0.2, 27],
  surface2: [0.962, 0.005, 264],
  surface2Fg: [0.24, 0.014, 264],
  // light — grounded warm-graphite chrome + cobalt active pill
  sidebar: [0.235, 0.008, 70],
  sidebarFg: [0.96, 0.004, 70],
  sidebarMutedFg: [0.72, 0.01, 70],
  sidebarAccent: [0.52, 0.16, 264],
  sidebarAccentFg: [0.99, 0.005, 264],
  // dark
  dBg: [0.2, 0.007, 70],
  dCard: [0.238, 0.007, 70],
  dFg: [0.96, 0.004, 70],
  dMutedFg: [0.72, 0.012, 70],
  dPrimary: [0.66, 0.15, 264],
  dPrimaryFg: [0.18, 0.02, 264],
  dSurface2: [0.26, 0.007, 70],
  dSurface2Fg: [0.96, 0.004, 70],
  // dark — sidebar
  dSidebar: [0.215, 0.007, 70],
  dSidebarFg: [0.96, 0.004, 70],
  dSidebarMutedFg: [0.72, 0.012, 70],
  dSidebarAccent: [0.55, 0.16, 264],
  dSidebarAccentFg: [0.99, 0.005, 264],
};

const need = (v, min, label) =>
  `${v.toFixed(2)}:1  ${v >= min ? "PASS" : "**FAIL**"}  (need ${min})  ${label}`;

console.log("LIGHT");
console.log(need(contrast(T.foreground, T.card), 4.5, "ink on card"));
console.log(need(contrast(T.foreground, T.background), 4.5, "ink on canvas"));
console.log(need(contrast(T.mutedFg, T.card), 4.5, "muted on card"));
console.log(need(contrast(T.mutedFg, T.background), 4.5, "muted on canvas"));
console.log(need(contrast(T.primaryFg, T.primary), 4.5, "white on cobalt (btn text)"));
console.log(need(contrast(T.primary, T.card), 3, "cobalt on card (large/icon)"));
console.log(need(contrast(T.primarySoftFg, T.primarySoft), 4.5, "soft-cobalt text on soft fill"));
console.log(need(contrast(T.success, T.card), 4.5, "success text on card"));
console.log(need(contrast(T.warning, T.card), 4.5, "warning text on card"));
console.log(need(contrast(T.info, T.card), 4.5, "info text on card"));
console.log(need(contrast(T.destructive, T.card), 4.5, "destructive text on card"));
console.log(need(contrast(T.surface2Fg, T.surface2), 4.5, "ink on surface-2"));
console.log(need(contrast(T.mutedFg, T.surface2), 4.5, "muted on surface-2"));

console.log("\nLIGHT — warm-graphite chrome");
console.log(need(contrast(T.sidebarFg, T.sidebar), 4.5, "sidebar text on sidebar"));
console.log(need(contrast(T.sidebarMutedFg, T.sidebar), 4.5, "sidebar muted on sidebar"));
console.log(need(contrast(T.sidebarAccentFg, T.sidebarAccent), 4.5, "active-nav text on accent"));
console.log(need(contrast(T.primaryFg, T.primary), 4.5, "badge text on cobalt chip"));

console.log("\nDARK");
console.log(need(contrast(T.dFg, T.dCard), 4.5, "ink on card"));
console.log(need(contrast(T.dFg, T.dBg), 4.5, "ink on canvas"));
console.log(need(contrast(T.dMutedFg, T.dCard), 4.5, "muted on card"));
console.log(need(contrast(T.dMutedFg, T.dBg), 4.5, "muted on canvas"));
console.log(need(contrast(T.dPrimaryFg, T.dPrimary), 4.5, "ink on cobalt (btn text)"));
console.log(need(contrast(T.dPrimary, T.dCard), 3, "cobalt on card (large)"));
console.log(need(contrast(T.dSurface2Fg, T.dSurface2), 4.5, "ink on surface-2"));
console.log(need(contrast(T.dMutedFg, T.dSurface2), 4.5, "muted on surface-2"));

console.log("\nDARK — sidebar");
console.log(need(contrast(T.dSidebarFg, T.dSidebar), 4.5, "sidebar text on sidebar"));
console.log(need(contrast(T.dSidebarMutedFg, T.dSidebar), 4.5, "sidebar muted on sidebar"));
console.log(need(contrast(T.dSidebarAccentFg, T.dSidebarAccent), 4.5, "active-nav text on accent"));
