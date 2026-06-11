// Day 16 — Stripe catalog setup (idempotent).
//
// Creates / updates the three Tharros subscription Products and their monthly
// CAD Prices in whatever Stripe mode STRIPE_SECRET_KEY points at (test until
// Day 99). Safe to re-run: Products are matched by metadata.tier and Prices by
// lookup_key, so a second run reuses what exists instead of duplicating.
//
// Usage (from repo root):
//   node scripts/stripe/setup-products.mjs
//
// Reads STRIPE_SECRET_KEY from apps/web/.env.local (falls back to the ambient
// env). Prints the resulting Price IDs — paste them into apps/web/.env.local and
// vault them in Vercel as STRIPE_PRICE_STARTER / _GROWTH / _PRO.
//
// Keep the TIERS amounts in sync with apps/web/src/lib/billing/plans.ts.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "../../apps/web/.env.local");

// stripe is installed in apps/web, not at the repo root — resolve it from there
// so this root-level script needs no duplicate dependency.
const require = createRequire(resolve(__dirname, "../../apps/web/package.json"));
const Stripe = require("stripe");

/** Minimal .env loader — pulls STRIPE_SECRET_KEY without adding a dep. */
function loadSecretKey() {
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY;
  try {
    const text = readFileSync(ENV_PATH, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*STRIPE_SECRET_KEY\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* fall through to the error below */
  }
  return undefined;
}

// SaaS / electronically supplied service — drives Stripe Tax (GST/HST) rates.
const SAAS_TAX_CODE = "txcd_10000000";

const TIERS = [
  {
    tier: "starter",
    name: "Tharros Starter",
    description: "AI Business Assistant for solo owners.",
    lookupKey: "tharros_starter_monthly",
    unitAmount: 9900,
  },
  {
    tier: "growth",
    name: "Tharros Growth",
    description: "Assistant + Lead Capture & AI Follow-Up for growing teams.",
    lookupKey: "tharros_growth_monthly",
    unitAmount: 29900,
  },
  {
    tier: "pro",
    name: "Tharros Pro",
    description: "All three products + workflow automation for scaling businesses.",
    lookupKey: "tharros_pro_monthly",
    unitAmount: 49900,
  },
];

const CURRENCY = "cad";

const secretKey = loadSecretKey();
if (!secretKey) {
  console.error(
    `✗ STRIPE_SECRET_KEY not found in env or ${ENV_PATH}. Set it and retry.`,
  );
  process.exit(1);
}
if (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("rk_test_")) {
  console.warn(
    "⚠ Key is not a test-mode key (sk_test_/rk_test_). This will mutate LIVE Stripe data.",
  );
}

const stripe = new Stripe(secretKey, { apiVersion: "2026-05-27.dahlia" });

// Idempotency anchor: the Price `lookup_key`. Unlike product *search* (which is
// eventually consistent and lags a fresh create by seconds), prices.list by
// lookup_key is immediately consistent — so we never duplicate on a re-run.
// The canonical Product is whichever one the existing Price points at; we only
// create a Product when no Price for the lookup_key exists yet.

async function ensureProductAndPrice(t) {
  const found = await stripe.prices.list({
    lookup_keys: [t.lookupKey],
    active: true,
    limit: 1,
    expand: ["data.product"],
  });

  if (found.data.length > 0) {
    const price = found.data[0];
    const product = price.product; // expanded object
    await stripe.products.update(product.id, {
      name: t.name,
      description: t.description,
      tax_code: SAAS_TAX_CODE,
      metadata: { tier: t.tier },
    });
    const mismatch =
      price.unit_amount !== t.unitAmount ||
      price.currency !== CURRENCY ||
      price.recurring?.interval !== "month";
    if (mismatch) {
      // Prices are immutable — move the lookup_key onto a fresh Price.
      await stripe.prices.update(price.id, { lookup_key: null });
      const replacement = await createPrice(t, product.id);
      return { product, price: replacement, pc: false, prc: true, replaced: price.id };
    }
    return { product, price, pc: false, prc: false };
  }

  const product = await stripe.products.create({
    name: t.name,
    description: t.description,
    tax_code: SAAS_TAX_CODE,
    metadata: { tier: t.tier },
  });
  const price = await createPrice(t, product.id);
  return { product, price, pc: true, prc: true };
}

function createPrice(t, productId) {
  return stripe.prices.create({
    product: productId,
    currency: CURRENCY,
    unit_amount: t.unitAmount,
    recurring: { interval: "month" },
    // Tax computed on top of the listed price (Stripe Tax / GST/HST).
    tax_behavior: "exclusive",
    lookup_key: t.lookupKey,
    transfer_lookup_key: true,
    metadata: { tier: t.tier },
  });
}

const envLines = { starter: "", growth: "", pro: "" };

for (const t of TIERS) {
  const { product, price, pc, prc, replaced } = await ensureProductAndPrice(t);
  envLines[t.tier] = price.id;
  console.log(
    `${t.tier.padEnd(8)} product ${product.id} ${pc ? "(created)" : "(reused)"}  ` +
      `price ${price.id} ${prc ? "(created)" : "(reused)"}` +
      (replaced ? ` — replaced ${replaced}` : ""),
  );
}

console.log("\nPaste into apps/web/.env.local and vault in Vercel:");
console.log(`STRIPE_PRICE_STARTER=${envLines.starter}`);
console.log(`STRIPE_PRICE_GROWTH=${envLines.growth}`);
console.log(`STRIPE_PRICE_PRO=${envLines.pro}`);
