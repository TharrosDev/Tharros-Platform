import { EmailButton, EmailFallbackLink, EmailHeading, EmailLayout, EmailText } from "./layout";

/**
 * Day 45 — availability-request template. Drives an employee to the portal to set
 * their availability in plain language. Sent by the `availability-nudge` job
 * (first request + proactive follow-ups) with a tokenized portal magic-link.
 */
export type AvailabilityRequestEmailProps = {
  /** The employee's name (greeting). */
  employeeName: string;
  /** The business asking for availability. */
  orgName: string;
  /** Tokenized portal magic-link (deep-links to the availability page after enter). */
  portalUrl: string;
};

export function AvailabilityRequestEmail({
  employeeName,
  orgName,
  portalUrl,
}: AvailabilityRequestEmailProps) {
  return (
    <EmailLayout preview={`Set your ${orgName} availability`}>
      <EmailHeading>When can you work?</EmailHeading>
      <EmailText>
        Hi {employeeName}, {orgName} is putting together the schedule and needs to know your
        availability. Open your portal and tell us when you can work in plain language, like
        &ldquo;Mon to Fri 9 to 5, not Tuesdays after 5, off June 20 to 25.&rdquo;
      </EmailText>
      <EmailButton href={portalUrl}>Set my availability</EmailButton>
      <EmailText>
        It takes about a minute. This link is personal to you, so please don&apos;t forward it. If
        you didn&apos;t expect this, you can ignore the email.
      </EmailText>
      <EmailFallbackLink href={portalUrl} />
    </EmailLayout>
  );
}

export default AvailabilityRequestEmail;
