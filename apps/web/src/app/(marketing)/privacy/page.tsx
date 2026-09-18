import type { Metadata } from "next";

import { PublicDocument } from "@/components/marketing/public-document";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Tharros handles account, business, employee, billing, and AI-workflow data.",
};

export default function PrivacyPage() {
  return (
    <PublicDocument
      eyebrow="Trust"
      title="Privacy notice"
      intro="This notice explains the information Tharros processes to provide the platform, why it is used, and the service providers involved."
      updated="September 18, 2026"
    >
      <section>
        <h2>Information you provide</h2>
        <p>
          Tharros processes account details such as your name and email address; organization,
          team, employee and scheduling information you enter; documents uploaded to the knowledge
          workspace; messages and prompts sent to AI features; feedback you submit; and information
          required to administer your subscription.
        </p>
        <p>
          Employee portal data can include availability, assigned shifts, sick-call information,
          replacement responses, swap requests and time-off requests. Organizations are responsible
          for deciding what employee and business information they place in Tharros.
        </p>
      </section>

      <section>
        <h2>Information created by the service</h2>
        <p>
          The platform creates operational records needed to run the product, including
          organization memberships, document-processing state, AI conversation history, citations,
          token-usage records, schedules and schedule versions, notifications, audit events, job
          execution state, and security or diagnostic logs.
        </p>
      </section>

      <section>
        <h2>How information is used</h2>
        <p>
          Information is used to authenticate users, isolate organization data, provide the
          assistant and scheduling products, process documents, deliver notifications and email,
          operate subscriptions, measure plan usage, troubleshoot failures, secure the platform,
          and maintain an audit trail for important operational actions.
        </p>
      </section>

      <section>
        <h2>AI processing</h2>
        <p>
          Different AI providers are used for specific tasks. Anthropic is used for assistant
          generation, OpenAI is used for document embeddings, and DeepSeek is used for structured
          scheduling tasks. Only information required for the requested feature should be sent to
          the relevant provider. AI output can be incomplete or incorrect and should be reviewed
          before it is used for consequential business decisions.
        </p>
      </section>

      <section>
        <h2>Infrastructure and service providers</h2>
        <p>
          Tharros currently relies on Supabase for database, authentication and storage; Stripe for
          subscription billing; Resend for transactional email; Vercel for application hosting and
          performance analytics; Sentry when configured for error monitoring; and the AI providers
          described above. These providers process information under their own service terms and
          privacy commitments.
        </p>
        <p>
          Payment-card details are handled by Stripe. Tharros does not need to store complete card
          numbers in its application database.
        </p>
      </section>

      <section>
        <h2>Isolation and security</h2>
        <p>
          Organization-scoped application data is protected with database Row-Level Security.
          Server-only administrative credentials are restricted to backend operations, and employee
          portal access is token-scoped. No online service can guarantee absolute security, and
          account owners should use strong credentials and restrict access to authorized people.
        </p>
      </section>

      <section>
        <h2>Retention and deletion</h2>
        <p>
          Tharros keeps information while it is needed to operate an account, satisfy legitimate
          operational and security needs, and maintain records required for billing or dispute
          handling. Product deletion controls may remove organization or account data where the
          platform supports that action. Some records can remain for a limited period in backups,
          logs, payment-provider records, or other systems that have their own retention schedules.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>
          Users can update profile and organization information through the product, manage
          subscription settings through billing controls, and use available deletion or membership
          controls. Requests concerning personal information can be sent to
          <a href="mailto:tharrosdev@gmail.com"> tharrosdev@gmail.com</a>.
        </p>
      </section>

      <section>
        <h2>Changes to this notice</h2>
        <p>
          This notice may change as the product, providers, or legal requirements change. The date
          above identifies the current published version.
        </p>
      </section>
    </PublicDocument>
  );
}
