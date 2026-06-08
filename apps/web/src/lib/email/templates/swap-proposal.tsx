import {
  EmailButton,
  EmailFallbackLink,
  EmailHeading,
  EmailLayout,
  EmailText,
} from "./layout";

/**
 * Day 56 — sent to a coworker when an employee proposes swapping a shift with them
 * (a trade, or handing one off). Carries the coworker's portal magic-link.
 */
export type SwapProposalEmailProps = {
  /** The coworker being asked (recipient). */
  employeeName: string;
  /** The employee who proposed the swap. */
  fromName: string;
  orgName: string;
  portalUrl: string;
  /** The shift they'd take on, e.g. "Mon Jun 15, 9:00 AM – 5:00 PM". */
  shiftLabel: string;
  /** The shift they'd give up in a trade, or null for a handoff. */
  tradeForLabel: string | null;
};

export function SwapProposalEmail({
  employeeName,
  fromName,
  orgName,
  portalUrl,
  shiftLabel,
  tradeForLabel,
}: SwapProposalEmailProps) {
  return (
    <EmailLayout preview={`${fromName} wants to swap a ${orgName} shift`}>
      <EmailHeading>A shift swap for you</EmailHeading>
      <EmailText>
        Hi {employeeName}, {fromName} at {orgName} would like you to take this shift:
      </EmailText>
      <EmailText>
        <strong>{shiftLabel}</strong>
      </EmailText>
      {tradeForLabel ? (
        <EmailText>
          In exchange, you&rsquo;d give up your <strong>{tradeForLabel}</strong> shift.
        </EmailText>
      ) : null}
      <EmailText>Open your portal to accept or decline.</EmailText>
      <EmailButton href={portalUrl}>Review the swap</EmailButton>
      <EmailFallbackLink href={portalUrl} />
    </EmailLayout>
  );
}

export default SwapProposalEmail;
