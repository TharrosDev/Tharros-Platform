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

**⚠️ Required before any checkout works.** `automatic_tax: { enabled: true }` (set
on every Checkout Session) rejects the session with *"You must have a valid head
office address to enable automatic tax calculation"* until the **head-office
address** is set under **Tax → Settings**. So both steps are hard prerequisites
for Day-17 Checkout in each mode (test now, live at Day 99):

1. Tax → Settings → set the **head-office (origin) address**.
2. Tax → Registrations → add the **Canada GST/HST** registration.

A registration alone is *not* enough — Stripe won't *collect* tax until a
registration is active, but it won't even *create the session* without the
head-office address.

## Customer Portal

Self-service plan management (Day 20 generates portal sessions). Configure once in
**Dashboard → Settings → Billing → Customer portal** (test mode):

- Allow **cancel** (at period end), **update payment method**, and **view invoice
  history**.
- Set business name + support email; link the Terms/Privacy URLs once the legal
  pages land (Day 86) — placeholders are fine for now.

## Checkout (Day 17)

**Embedded** Checkout, subscription mode, owner-only. `lib/billing/actions.ts`
`createCheckoutClientSecret(tier)` ensures one Stripe Customer per org (persisted
to `organizations.stripe_customer_id`), then creates an `embedded_page` session
tied to the org (`client_reference_id` + metadata `org_id`/`tier`), with a 14-day
trial, **card up front** (`payment_method_collection: "always"`), `automatic_tax`
+ `tax_id_collection`. The client component (`components/billing/embedded-checkout.tsx`)
mounts it; the `return_url` lands on `/billing/return`, which reads the session
for a confirmation. New users are routed to `/billing` straight after onboarding.

The subscription is **not** persisted here — the Day-18 webhook is the source of
truth. The `/billing/return` page reads the session directly from Stripe for the
"trial started" confirmation only.

CSP: `next.config.ts` allows `js.stripe.com` (script + frame), `checkout.stripe.com`
(frame + connect), `hooks.stripe.com` (frame, 3DS), and `api.stripe.com` (connect).

## Webhooks

Not configured yet — Day 18. `STRIPE_WEBHOOK_SECRET` stays unset until then.

## Going live (Day 99)

Swap `sk_test_*`/`pk_test_*`/`whsec_*` for live keys, re-run the catalog script
against the live account, re-add the live registration + portal config, and update
the three `STRIPE_PRICE_*` env vars to the live Price IDs.
