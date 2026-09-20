import { EmailButton, EmailFallbackLink, EmailHeading, EmailLayout, EmailText } from "./layout";

/**
 * Team-invite template. App-sent (not Supabase Auth) — passed as a React
 * element to lib/email/send with a real tokenized accept URL. Built here; the
 * invite send + accept flow is wired in Day 15 (team management).
 */
export type InviteEmailProps = {
  /** Who sent the invite (name or email). */
  inviterName: string;
  /** Org the recipient is being invited into. */
  orgName: string;
  /** Tokenized accept URL. */
  acceptUrl: string;
};

export function InviteEmail({ inviterName, orgName, acceptUrl }: InviteEmailProps) {
  return (
    <EmailLayout preview={`${inviterName} invited you to ${orgName} on Tharros`}>
      <EmailHeading>You&apos;ve been invited to {orgName}</EmailHeading>
      <EmailText>
        {inviterName} invited you to join <strong>{orgName}</strong> on Tharros, the AI operating
        layer for small businesses. Accept the invite to set up your account and get started.
      </EmailText>
      <EmailButton href={acceptUrl}>Accept invite</EmailButton>
      <EmailText>This invite expires in 7 days.</EmailText>
      <EmailFallbackLink href={acceptUrl} />
    </EmailLayout>
  );
}

export default InviteEmail;
