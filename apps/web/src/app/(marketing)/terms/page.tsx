import type { Metadata } from "next";

import { PublicDocument } from "@/components/marketing/public-document";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms for using the Tharros platform.",
};

export default function TermsPage() {
  return (
    <PublicDocument
      eyebrow="Legal"
      title="Terms of service"
      intro="These terms describe the basic conditions for accessing and using Tharros."
      updated="September 18, 2026"
    >
      <section>
        <h2>Using Tharros</h2>
        <p>
          You may use Tharros for lawful business purposes and only with information you have the
          right to provide to the service. You are responsible for your organization, the people
          you authorize, and the accuracy of the operational rules and data you configure.
        </p>
      </section>

      <section>
        <h2>Accounts and access</h2>
        <p>
          Keep account credentials and employee portal links secure. Organization owners and
          administrators are responsible for granting appropriate access and removing access when
          it is no longer required. You must not attempt to bypass tenant isolation, authorization
          controls, usage limits, or other security measures.
        </p>
      </section>

      <section>
        <h2>Subscriptions and billing</h2>
        <p>
          Paid access is provided according to the plan selected at checkout. Prices shown in the
          product are monthly Canadian-dollar prices unless the checkout states otherwise. Taxes
          can be added where applicable. Trial length, included capabilities, usage limits, and
          cancellation options are described on the pricing and billing surfaces at the time of
          purchase.
        </p>
        <p>
          If payment fails or a subscription is no longer active, access to paid product areas can
          be limited while account and billing controls remain available.
        </p>
      </section>

      <section>
        <h2>AI and scheduling output</h2>
        <p>
          AI-generated answers, drafts, schedule recommendations, classifications, and other output
          can contain errors. Tharros is an operational aid, not a substitute for professional,
          legal, medical, accounting, employment, or safety advice. Managers remain responsible for
          reviewing schedules, employment decisions, policy interpretations, and other
          consequential actions before relying on them.
        </p>
      </section>

      <section>
        <h2>Your content</h2>
        <p>
          You retain your rights in the business documents, prompts, employee information, and
          other content you submit. You give Tharros permission to process that content only as
          needed to provide, secure, maintain, and improve the service and to meet applicable legal
          obligations.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>You must not use the service to:</p>
        <ul>
          <li>break the law or infringe another person&apos;s rights;</li>
          <li>upload malicious code or intentionally disrupt the platform;</li>
          <li>probe or exploit accounts, organizations, systems, or data you are not authorized to access;</li>
          <li>misrepresent AI output as independently verified when it has not been reviewed; or</li>
          <li>use the service in a way that creates unreasonable risk to other users or the platform.</li>
        </ul>
      </section>

      <section>
        <h2>Availability and changes</h2>
        <p>
          Tharros can change features, limits, providers, or infrastructure as the product evolves.
          The service may occasionally be unavailable because of maintenance or failures in
          third-party infrastructure. Material changes to paid capabilities should be reflected in
          the product and pricing information rather than silently represented as existing
          functionality.
        </p>
      </section>

      <section>
        <h2>Suspension and termination</h2>
        <p>
          Access may be suspended or terminated for non-payment, material violation of these terms,
          abusive or unlawful use, or security risk. You may cancel a subscription using the
          available billing controls. Data handling after termination follows the privacy notice
          and applicable provider retention requirements.
        </p>
      </section>

      <section>
        <h2>Service limitations</h2>
        <p>
          The platform is provided on an as-available basis. To the extent permitted by applicable
          law, Tharros does not guarantee uninterrupted operation, error-free AI output, or that a
          generated schedule or recommendation will satisfy every legal, contractual, collective
          agreement, safety, or business requirement. Users must validate requirements that matter
          to their organization.
        </p>
      </section>

      <section>
        <h2>Questions</h2>
        <p>
          Questions about these terms can be sent to
          <a href="mailto:tharrosdev@gmail.com"> tharrosdev@gmail.com</a>.
        </p>
      </section>
    </PublicDocument>
  );
}
