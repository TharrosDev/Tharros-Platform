import { EmailButton, EmailFallbackLink, EmailHeading, EmailLayout, EmailText } from "./layout";

/**
 * Day 55 — sent to each eligible employee when an open shift needs cover. Carries
 * the employee's portal magic-link; whoever accepts first on the portal wins.
 */
export type ReplacementOfferEmailProps = {
  employeeName: string;
  orgName: string;
  portalUrl: string;
  /** Human label for the open shift, e.g. "Mon Jun 15, 9:00 AM – 5:00 PM". */
  shiftLabel: string;
};

export function ReplacementOfferEmail({
  employeeName,
  orgName,
  portalUrl,
  shiftLabel,
}: ReplacementOfferEmailProps) {
  return (
    <EmailLayout preview={`A ${orgName} shift is up for grabs`}>
      <EmailHeading>A shift is available</EmailHeading>
      <EmailText>
        Hi {employeeName}, an open shift at {orgName} needs cover:
      </EmailText>
      <EmailText>
        <strong>{shiftLabel}</strong>
      </EmailText>
      <EmailText>
        If you can take it, open your schedule and accept it. It&rsquo;s first come, first served —
        the first person to accept gets the shift.
      </EmailText>
      <EmailButton href={portalUrl}>View &amp; accept</EmailButton>
      <EmailFallbackLink href={portalUrl} />
    </EmailLayout>
  );
}

export default ReplacementOfferEmail;
