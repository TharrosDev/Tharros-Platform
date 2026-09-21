// Fails the build if the emitted stylesheet does not match src/app/globals.css.
//
// Why this exists: Next 16.3 turned on Turbopack's filesystem build cache by
// default, and a warm cache can reuse a stale compilation of globals.css after
// the file changes. On 2026-09-20 production shipped new components on top of
// the previous design system's stylesheet because Vercel restored that cache
// from the prior deploy. The build was green and the site was wrong.
//
// Every custom property declared in globals.css's :root block is passed
// through to the output verbatim, so the emitted CSS must contain every one
// of them. If any are missing, the stylesheet is stale or broken, and this
// exits non-zero so the deploy fails instead of shipping it.
//
// Usage: node scripts/verify-css-build.mjs [cssDirOrFile]
//   default target: .next/static

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(APP, "src", "app", "globals.css");
const target = process.argv[2] ?? join(APP, ".next", "static");

/** Custom property names declared directly in the first :root block. */
function rootTokens(css) {
  const start = css.indexOf(":root");
  const open = css.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  const body = css.slice(open + 1, end).replace(/\/\*[\s\S]*?\*\//g, "");
  return [...new Set([...body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))];
}

function cssFiles(path) {
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  const out = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) out.push(...cssFiles(full));
    else if (entry.name.endsWith(".css")) out.push(full);
  }
  return out;
}

const tokens = rootTokens(readFileSync(SOURCE, "utf8"));
if (tokens.length === 0) {
  console.error("verify-css-build: found no :root tokens in globals.css; refusing to pass.");
  process.exit(1);
}

let files;
try {
  files = cssFiles(target);
} catch {
  console.error(`verify-css-build: ${target} does not exist. Run next build first.`);
  process.exit(1);
}
if (files.length === 0) {
  console.error(`verify-css-build: no .css files under ${target}.`);
  process.exit(1);
}

const emitted = files.map((f) => readFileSync(f, "utf8")).join("\n");
const missing = tokens.filter((token) => !emitted.includes(`${token}:`));

if (missing.length) {
  console.error(
    `verify-css-build: the emitted CSS is missing ${missing.length} of ${tokens.length} ` +
      `tokens declared in globals.css, so it was not compiled from the current source.\n` +
      `  missing: ${missing.slice(0, 12).join(", ")}${missing.length > 12 ? ", …" : ""}\n` +
      `  This is usually a stale build cache. Clear .next/cache and rebuild.`,
  );
  process.exit(1);
}

console.log(
  `verify-css-build: all ${tokens.length} globals.css tokens present across ${files.length} stylesheet(s).`,
);
