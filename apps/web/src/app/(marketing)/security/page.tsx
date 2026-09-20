import type { Metadata } from "next";

import { PublicDocument } from "@/components/marketing/public-document";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How Tharros approaches tenant isolation, access control, monitoring, and data handling.",
};

export default function SecurityPage() {
  return (
    <PublicDocument
      title="Security at Tharros"
      intro="Security controls are built into the application and database boundaries rather than relying only on what the interface hides."
      updated="September 18, 2026"
    >
      <section>
        <h2>Organization isolation</h2>
        <p>
          Business data is organization-scoped in Postgres and protected with Supabase Row-Level
          Security policies. User-session database access is evaluated against those policies, so
          tenant separation does not depend on a client-side filter.
        </p>
      </section>

      <section>
        <h2>Privileged access</h2>
        <p>
          Service-role database credentials are server-only and are reserved for narrowly scoped
          internal pipelines, fixture administration, and operations that cannot run through a
          normal user session. They are not exposed to browser code.
        </p>
      </section>

      <section>
        <h2>Authentication and employee access</h2>
        <p>
          Account authentication is provided through Supabase Auth. The employee portal uses
          account-less, token-scoped access designed to expose only the employee and organization
          information required for portal workflows. Portal tokens are validated by the server on
          requests rather than treated as a UI-only gate.
        </p>
      </section>

      <section>
        <h2>Billing</h2>
        <p>
          Subscription checkout and payment-method handling are delegated to Stripe. The Tharros
          application stores subscription state and provider identifiers needed to enforce access,
          but complete payment-card details are handled by Stripe.
        </p>
      </section>

      <section>
        <h2>Operational controls</h2>
        <p>
          Important scheduling and administrative operations use role checks, audit records, and
          database-side conflict protections. Durable background work is persisted in the database
          instead of relying on request-lifetime fire-and-forget tasks.
        </p>
      </section>

      <section>
        <h2>Monitoring and failure handling</h2>
        <p>
          The application has structured server logging, error boundaries, health checks, and
          optional Sentry reporting. CI performs strict type checking, linting, production builds,
          database-backed integration tests when the dedicated test dependency is available, and
          Playwright browser journeys.
        </p>
      </section>

      <section>
        <h2>AI providers</h2>
        <p>
          AI work is split by purpose rather than routed through one unrestricted agent. Assistant
          generation, embeddings, and scheduling-oriented structured tasks use separate provider
          seams. Product code should send only the context needed for the feature being executed.
        </p>
      </section>

      <section>
        <h2>Responsible disclosure</h2>
        <p>
          If you believe you have found a security issue, do not access data beyond what is
          necessary to demonstrate the problem. Send the details to{" "}
          <a href="mailto:tharrosdev@gmail.com">tharrosdev@gmail.com</a> so the issue can be
          investigated.
        </p>
      </section>

      <section>
        <h2>No absolute-security claim</h2>
        <p>
          No internet service is perfectly secure. These controls describe the current engineering
          approach and should be reviewed and improved as the product, threat model, and customer
          requirements evolve.
        </p>
      </section>
    </PublicDocument>
  );
}
