// OKLCH -> sRGB -> WCAG contrast gate for the Tharros design tokens.
//
// Reads the tokens straight out of apps/web/src/app/globals.css, so a token
// edit can never silently desync this file. Covers text contrast (WCAG 1.4.3)
// and non-text contrast for borders, fields, focus rings and solid fills
// (WCAG 1.4.11). Exits non-zero on any failure so CI can gate on it.
//
// Run: node scripts/contrast-check.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSS = join(ROOT, "apps", "web", "src", "app", "globals.css");

/* ---------------------------------------------------------------- parsing */

/** Pull `--name: value;` declarations out of the first `:root { … }` block. */
function readTokens(css) {
  const start = css.indexOf(":root");
  if (start === -1) throw new Error("no :root block in globals.css");
  const open = css.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = css.slice(open + 1, end).replace(/\/\*[\s\S]*?\*\//g, "");
  const raw = new Map();
  for (const [, name, value] of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    raw.set(name, value.trim());
  }
  return raw;
}

/** Resolve `var(--x)` aliases and parse `oklch(L C H)` into [L, C, H]. */
function resolveColors(raw) {
  const out = new Map();
  const seen = new Set();
  const resolve = (name) => {
    if (out.has(name)) return out.get(name);
    if (seen.has(name)) throw new Error(`circular token --${name}`);
    seen.add(name);
    const value = raw.get(name);
    if (value === undefined) return null;
    const alias = value.match(/^var\(\s*--([\w-]+)\s*\)$/);
    if (alias) {
      const target = resolve(alias[1]);
      if (target) out.set(name, target);
      return target;
    }
    const ok = value.match(
      /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*[\d.]+\s*)?\)$/,
    );
    if (!ok) return null;
    const triple = [Number(ok[1]), Number(ok[2]), Number(ok[3])];
    out.set(name, triple);
    return triple;
  };
  for (const name of raw.keys()) resolve(name);
  return out;
}

/* ------------------------------------------------------------ colour math */

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

/* ------------------------------------------------------------------ pairs */

const AA_TEXT = 4.5;
const AA_NONTEXT = 3;

/**
 * Each group is [heading, pairs], each pair [fg, bg, min, label].
 * Names are token names; the script fails loudly on a name that no longer
 * exists rather than silently skipping the check.
 */
const GROUPS = [
  [
    "STOCK — the printed board and strips",
    [
      ["foreground", "card", AA_TEXT, "press black on a strip"],
      ["foreground", "background", AA_TEXT, "press black on the board"],
      ["muted-foreground", "card", AA_TEXT, "secondary on a strip"],
      ["muted-foreground", "background", AA_TEXT, "secondary on the board"],
      ["surface-2-foreground", "surface-2", AA_TEXT, "ink on an inset"],
      ["muted-foreground", "surface-2", AA_TEXT, "secondary on an inset (table header)"],
      ["surface-3-foreground", "surface-3", AA_TEXT, "ink on a deep inset"],
      ["accent-foreground", "accent", AA_TEXT, "ink on hover"],
      ["muted-foreground", "accent", AA_TEXT, "secondary on hover"],
      ["secondary-foreground", "secondary", AA_TEXT, "ink on secondary fill"],
    ],
  ],
  [
    "RACK — the anodized chrome",
    [
      ["rack-foreground", "rack", AA_TEXT, "engraved label on the rack"],
      ["rack-muted-foreground", "rack", AA_TEXT, "secondary label on the rack"],
      ["rack-foreground", "rack-deep", AA_TEXT, "engraved label in a rail well"],
      ["rack-muted-foreground", "rack-deep", AA_TEXT, "secondary label in a rail well"],
      ["sidebar-foreground", "sidebar", AA_TEXT, "nav text on the rail"],
      ["sidebar-muted-foreground", "sidebar", AA_TEXT, "nav secondary on the rail"],
      [
        "sidebar-accent-foreground",
        "sidebar-accent",
        AA_TEXT,
        "current page: ink on hi-vis",
      ],
    ],
  ],
  [
    "SAFETY YELLOW — the control",
    [
      ["primary-foreground", "primary", AA_TEXT, "ink on a hi-vis control"],
      ["primary-soft-foreground", "primary-soft", AA_TEXT, "ochre on a hi-vis wash"],
      ["primary-soft-foreground", "card", AA_TEXT, "ochre text on a strip"],
      ["primary-soft-foreground", "background", AA_TEXT, "ochre text on the board"],
    ],
  ],
  [
    "STATE — semantic ink on stock",
    [
      ["destructive", "card", AA_TEXT, "signal red text on a strip"],
      ["destructive", "background", AA_TEXT, "signal red text on the board"],
      ["destructive-foreground", "destructive", AA_TEXT, "ink on a signal-red fill"],
      ["success", "card", AA_TEXT, "cleared text on a strip"],
      ["success", "background", AA_TEXT, "cleared text on the board"],
      ["success-foreground", "success", AA_TEXT, "ink on a cleared fill"],
      ["warning", "card", AA_TEXT, "warning text on a strip"],
      ["warning", "background", AA_TEXT, "warning text on the board"],
      ["warning-foreground", "warning", AA_TEXT, "ink on a warning fill"],
      ["info", "card", AA_TEXT, "procedure cyan text on a strip"],
      ["info", "background", AA_TEXT, "procedure cyan text on the board"],
      ["info-foreground", "info", AA_TEXT, "ink on a procedure-cyan fill"],
    ],
  ],
  [
    "STOCK TINTS — state is the paper, so the paper must still read",
    [
      ["foreground", "stock-pending", AA_TEXT, "press black on pending stock"],
      ["muted-foreground", "stock-pending", AA_TEXT, "secondary on pending stock"],
      ["foreground", "stock-signal", AA_TEXT, "press black on signal stock"],
      ["muted-foreground", "stock-signal", AA_TEXT, "secondary on signal stock"],
      ["foreground", "stock-cleared", AA_TEXT, "press black on cleared stock"],
      ["muted-foreground", "stock-cleared", AA_TEXT, "secondary on cleared stock"],
      ["foreground", "stock-procedure", AA_TEXT, "press black on procedure stock"],
      ["muted-foreground", "stock-procedure", AA_TEXT, "secondary on procedure stock"],
    ],
  ],
  [
    "NON-TEXT (WCAG 1.4.11) — rules, fields, rings and fills",
    [
      ["input", "card", AA_NONTEXT, "field border against a strip"],
      ["input", "background", AA_NONTEXT, "field border against the board"],
      ["ring", "card", AA_NONTEXT, "focus ring against a strip"],
      ["ring", "background", AA_NONTEXT, "focus ring against the board"],
      ["sidebar-ring", "sidebar", AA_NONTEXT, "focus ring against the rail"],
      ["rack-edge", "rack", AA_NONTEXT, "machined seam against the rack"],
      ["primary-edge", "background", AA_NONTEXT, "hi-vis control edge against the board"],
      ["primary-edge", "card", AA_NONTEXT, "hi-vis control edge against a strip"],
      ["destructive", "card", AA_NONTEXT, "signal-red fill against a strip"],
      ["success", "card", AA_NONTEXT, "cleared fill against a strip"],
      ["info", "card", AA_NONTEXT, "procedure fill against a strip"],
      ["foreground", "primary", AA_NONTEXT, "icon ink on a hi-vis control"],
      // A stock tint reinforces state; the tab is what carries it. The tab has
      // to clear 3:1 against the tinted strip it sits on, because that is the
      // non-colour-dependent signal a reader actually resolves.
      ["warning", "stock-pending", AA_NONTEXT, "pending tab on pending stock"],
      ["destructive", "stock-signal", AA_NONTEXT, "signal tab on signal stock"],
      ["success", "stock-cleared", AA_NONTEXT, "cleared tab on cleared stock"],
      ["info", "stock-procedure", AA_NONTEXT, "procedure tab on procedure stock"],
    ],
  ],
];

/* ------------------------------------------------------------------- main */

const tokens = resolveColors(readTokens(readFileSync(CSS, "utf8")));

let failures = 0;
let missing = 0;

for (const [heading, pairs] of GROUPS) {
  console.log(`\n${heading}`);
  for (const [fgName, bgName, min, label] of pairs) {
    const fg = tokens.get(fgName);
    const bg = tokens.get(bgName);
    if (!fg || !bg) {
      missing += 1;
      const which = !fg ? `--${fgName}` : `--${bgName}`;
      console.log(`  ????  **MISSING**  ${which} is not an oklch token  ${label}`);
      continue;
    }
    const value = contrast(fg, bg);
    const ok = value >= min;
    if (!ok) failures += 1;
    console.log(
      `  ${value.toFixed(2)}:1  ${ok ? "pass" : "**FAIL**"}  (need ${min})  ${label}`,
    );
  }
}

const problems = failures + missing;
console.log(
  `\n${problems === 0 ? "All pairs pass." : `${failures} failing, ${missing} missing.`}`,
);
process.exit(problems === 0 ? 0 : 1);
