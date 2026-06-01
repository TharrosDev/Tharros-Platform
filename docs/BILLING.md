# Billing (Stripe) — operator guide

Stripe powers Tharros subscriptions. **Test mode until Day 99**, when live keys swap
in. This doc covers the parts that live in the Stripe Dashboard / account config —
the code lives in `apps/web/src/lib/billing/` and `scripts/stripe/`.

## Pricing model

Flat monthly **per business** (not per seat), three tiers, 14-day trial with the
card collected up front at Checkout. Source of truth for amounts + copy is
`apps/web/src/lib/billing/plans.ts`; the matching Stripe Products/Prices are created
by the script below. Keep the two in sync.

| Tier    | Monthly (CAD) | Stripe `lookup_key`        | env var                |
| ------- | ------------- | -------------------------- | ---------------------- |
| Starter | $149          | `tharros_starter_monthly`  | `STRIPE_PRICE_STARTER` |
| Growth  | $349          | `tharros_growth_monthly`   | `STRIPE_PRICE_GROWTH`  |
| Pro     | $699          | `tharros_pro_monthly`      | `STRIPE_PRICE_PRO`     |

## Catalog setup script

```bash
node scripts/stripe/setup-products.mjs
```

Idempotent: matches Products via their Price `lookup_key` (immediately consistent,
unlike product search) and reuses what exists. It prints the three Price IDs —
paste them into `apps/web/.env.local` and vault them in Vercel (all three
environments). Changing an amount creates a new immutable Price and moves the
`lookup_key` onto it automatically.

## Stripe Tax (GST/HST)

Two-step. The code sets `automatic_tax: { enabled: true }` on the Checkout Session
(Day 17) and Prices carry `tax_behavior: exclusive` + the SaaS tax code
`txcd_10000000`. The **registration is a Dashboard step you must do**:

1. Dashboard → **Tax → Registrations** → add a **Canada** registration (GST/HST).
2. Confirm the head-office origin address under Tax → Settings.

It is safe to enable `automatic_tax` before a registration exists — Stripe simply
won't collect tax until one is active. Add provincial registrations as nexus grows.

## Customer Portal

Self-service plan management (Day 20 generates portal sessions). Configure once in
**Dashboard → Settings → Billing → Customer portal** (test mode):

- Allow **cancel** (at period end), **update payment method**, and **view invoice
  history**.
- Set business name + support email; link the Terms/Privacy URLs once the legal
  pages land (Day 86) — placeholders are fine for now.

## Webhooks

Not configured yet — Day 18. `STRIPE_WEBHOOK_SECRET` stays unset until then.

## Going live (Day 99)

Swap `sk_test_*`/`pk_test_*`/`whsec_*` for live keys, re-run the catalog script
against the live account, re-add the live registration + portal config, and update
the three `STRIPE_PRICE_*` env vars to the live Price IDs.
