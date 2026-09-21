# Product

## Users

Tharros serves Canadian businesses and organizations, large and small, with owners, managers and teams as its primary users. Larger organizations should evaluate workflow, access, capacity and procurement fit before a wider rollout.
The product should feel like dependable operating software rather than an AI
demo. Trust, clarity, tenant isolation and accurate representation of shipped
capabilities take priority over novelty.

## Shipped product

Tharros is one operating workspace with four connected product surfaces:

1. **AI Business Assistant** — document ingestion, retrieval, grounded answers,
   citations and generation over the business knowledge base.
2. **AI Workforce Scheduling** — setup, availability, schedule generation and
   review, publishing, employee self-service, sick-call coverage, replacements,
   swaps, time off, analytics and activity history.
3. **Lead Capture** — manual leads, public tokenized capture forms/API, pipeline
   statuses, lead timelines, internal notes and human-reviewed AI follow-up
   drafts.
4. **Native Automations** — durable event-driven workflows over lead events.
   Current actions notify managers, update pipeline status, or prepare an AI
   follow-up draft. Every execution is recorded.

The four surfaces share organization membership, RLS, billing, AI usage limits,
notifications, auditability and the durable Postgres jobs runtime.

External SaaS connectors are not a shipped capability yet. Do not advertise
generic “connected tools”, CRM integrations, Nango, n8n, or automatic customer
email sending unless those capabilities are implemented end to end.

## Plan ladder

- **Starter** — AI Business Assistant.
- **Growth** — Starter + Workforce Scheduling + Lead Capture.
- **Pro** — Growth + Native Automations.

Pricing copy, route-level feature gates and backend actions must remain aligned
with this ladder.

## Product principles

- **Truth before breadth.** Public copy, pricing, plan gates, navigation and the
  actual implementation must agree.
- **Earned trust over flash.** Familiar, legible and predictable. AI output is
  bounded and honest about uncertainty.
- **Human control for consequential actions.** AI follow-up is drafted, not
  silently sent. Managers review schedules and can pause/test workflows.
- **Durable automation.** Background work uses the jobs runtime with retries and
  recorded execution state rather than request-lifetime fire-and-forget work.
- **Tenant isolation by default.** Organization boundaries are enforced in the
  database, not left to client convention.
- **Real data only.** Production surfaces never fabricate customers, metrics,
  activity or workflow results.

## Design direction

The production design direction is Common Ground: a bright, welcoming workspace with white and pale-blue surfaces, rounded controls, natural sentence-case typography and a clear blue action colour. Marketing uses mint, peach and lavender regions to distinguish real workflows. The user explicitly requested replacement of the dark, square Strip Board system. Canonical implementation guidance lives in `apps/web/docs/DESIGN.md`.

## Accessibility

WCAG AA is the baseline. Text contrast, visible focus, keyboard navigation,
reduced-motion behavior, semantic structure and non-colour-only state
communication are product requirements.
