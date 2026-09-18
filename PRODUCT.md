# Product

## Users

Tharros is built for non-technical small-business owners and managers in Canada.
They need dependable operational software, not an AI demo. Trust, clarity, and
accurate representation of what the product can do take priority over feature
count or novelty.

## Product purpose

Tharros is an operating workspace for a small business. The production product
currently has two primary capabilities:

1. **AI Business Assistant** — grounded answers and generation over a business's
   own knowledge base.
2. **AI Workforce Scheduling** — team setup, availability collection, schedule
   generation and review, publishing, employee self-service, sick-call coverage,
   swaps, time off, analytics, and activity history.

Lead capture, external-tool connectors, and workflow automation remain future
product work until their end-to-end implementations are production-ready. They
must not appear in paid-plan entitlements or public copy as shipped features.

## Product principles

- **Truth before breadth.** Public copy, pricing, plan gates, navigation, and the
  actual product must agree. A roadmap item is never presented as a current
  entitlement.
- **Earned trust over flash.** Familiar, legible and predictable. AI output must
  be bounded, attributable, and honest about uncertainty.
- **Speak human.** Use plain language and concrete outcomes instead of model,
  infrastructure, or automation jargon.
- **Quiet by default, clear under pressure.** Routine work stays calm. Errors,
  approvals, exceptions, and irreversible actions are unmistakable.
- **Human control for consequential actions.** Managers can review, edit,
  approve, reject, retry, or take over important operational decisions.
- **Tenant isolation by default.** Organization boundaries are enforced in the
  database, not left to UI convention.

## Design direction

The current design system is **Workshop**. It uses warm graphite chrome, a clean
light working canvas, and a restrained cobalt accent. The product should feel
like dependable operating software for a busy owner: confident and practical,
not decorative, developer-centric, or generic beige SaaS.

The canonical implementation guidance lives in
`apps/web/docs/DESIGN.md`.

## Accessibility

WCAG AA is the baseline. Text contrast, visible focus states, keyboard
navigation, reduced-motion behavior, semantic structure, and non-colour-only
state communication are product requirements rather than optional polish.
