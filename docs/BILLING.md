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
| Starter | $99           | `tharros_starter_monthly`  | `STRIPE_PRICE_STARTER` |
| Growth  | $299          | `tharros_growth_monthly`   | `STRIPE_PRICE_GROWTH`  |
| Pro     | $499          | `tharros_pro_monthly`      | `STRIPE_PRICE_PRO`     |

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

## Webhooks (Day 18)

Endpoint: **`POST /api/webhooks/stripe`** (Node runtime; excluded from the proxy
auth gate). Signature-verified with `STRIPE_WEBHOOK_SECRET` via
`stripe.webhooks.constructEvent`, then `handleStripeEvent` (in `lib/billing/webhook.ts`)
persists to `public.subscriptions` through the **service-role** client
(`lib/supabase/admin.ts`) — the table's only writer.

**Idempotent:** every processed event id is recorded in `public.stripe_events`;
a duplicate delivery short-circuits with a 200 and no write. The id is recorded
only *after* successful handling, so a failure returns 500 and Stripe retries
(the subscription upsert is itself idempotent).

**Events handled:** `customer.subscription.created` / `updated` / `deleted`
(upsert the row, keyed on `org_id` from the subscription metadata set at
Checkout) and `invoice.payment_failed` (mark `past_due`). Other types are
acknowledged + recorded so Stripe stops retrying.

**Responses:** `400` bad/missing signature or no secret · `500` handler error
(retried) · `200` processed or duplicate.

### Local testing

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe   # prints whsec_
stripe trigger customer.subscription.created                    # row appears
```

Put the printed `whsec_` in `apps/web/.env.local` as `STRIPE_WEBHOOK_SECRET`.

### Deploy

Create the endpoint in **Dashboard → Developers → Webhooks** (URL
`https://<env>/api/webhooks/stripe`, the four event types above), copy its
signing secret, and vault `STRIPE_WEBHOOK_SECRET` per environment in Vercel.

## Going live (Day 99)

Swap `sk_test_*`/`pk_test_*`/`whsec_*` for live keys, re-run the catalog script
against the live account, re-add the live registration + portal config, and update
the three `STRIPE_PRICE_*` env vars to the live Price IDs.
