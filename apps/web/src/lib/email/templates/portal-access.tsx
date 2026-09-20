import { EmailButton, EmailFallbackLink, EmailHeading, EmailLayout, EmailText } from "./layout";

/**
 * Employee portal-access template. App-sent (not Supabase Auth) — passed as a
 * React element to lib/email/send with a tokenized magic-link. The employee has
 * no account; opening the link signs them into their org's scheduling portal.
 * Wired by the Day-37 employee portal foundation.
 */
export type PortalAccessEmailProps = {
  /** The employee's name (greeting). */
  employeeName: string;
  /** The business they're being given portal access to. */
  orgName: string;
  /** Tokenized portal magic-link. */
  portalUrl: string;
};

export function PortalAccessEmail({ employeeName, orgName, portalUrl }: PortalAccessEmailProps) {
  return (
    <EmailLayout preview={`Your ${orgName} schedule access`}>
      <EmailHeading>Your {orgName} schedule</EmailHeading>
      <EmailText>
        Hi {employeeName}, {orgName} uses Tharros to manage scheduling. Open your personal portal to
        set your availability, view your shifts, and handle time-off — no account or password
        needed.
      </EmailText>
      <EmailButton href={portalUrl}>Open my portal</EmailButton>
      <EmailText>
        This link is personal to you — please don&apos;t forward it. If you didn&apos;t expect this,
        you can ignore the email.
      </EmailText>
      <EmailFallbackLink href={portalUrl} />
    </EmailLayout>
  );
}

export default PortalAccessEmail;
