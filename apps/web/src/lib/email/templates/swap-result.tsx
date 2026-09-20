import { EmailButton, EmailFallbackLink, EmailHeading, EmailLayout, EmailText } from "./layout";

/**
 * Day 56 — sent to the employee who proposed a swap once it's resolved
 * (approved/applied or denied). Carries their portal magic-link.
 */
export type SwapResultEmailProps = {
  employeeName: string;
  orgName: string;
  portalUrl: string;
  result: "approved" | "denied";
  /** The shift the swap concerned, e.g. "Mon Jun 15, 9:00 AM – 5:00 PM". */
  shiftLabel: string;
};

export function SwapResultEmail({
  employeeName,
  orgName,
  portalUrl,
  result,
  shiftLabel,
}: SwapResultEmailProps) {
  const approved = result === "approved";
  return (
    <EmailLayout preview={`Your ${orgName} shift swap was ${approved ? "approved" : "declined"}`}>
      <EmailHeading>{approved ? "Your swap went through" : "Your swap was declined"}</EmailHeading>
      <EmailText>
        Hi {employeeName}, your shift swap for <strong>{shiftLabel}</strong> at {orgName} was{" "}
        {approved ? "approved — your schedule has been updated." : "declined."}
      </EmailText>
      <EmailButton href={portalUrl}>View my schedule</EmailButton>
      <EmailFallbackLink href={portalUrl} />
    </EmailLayout>
  );
}

export default SwapResultEmail;
