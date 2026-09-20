import { EmailButton, EmailFallbackLink, EmailHeading, EmailLayout, EmailText } from "./layout";

/**
 * Day 53 — a reminder sent ~24h before a shift starts (scheduled at publish via
 * the Day-38 job runtime). Carries the employee's portal magic-link.
 */
export type ShiftReminderEmailProps = {
  employeeName: string;
  orgName: string;
  portalUrl: string;
  /** Human label for the shift, e.g. "Mon Jun 15, 9:00 AM – 5:00 PM". */
  shiftLabel: string;
};

export function ShiftReminderEmail({
  employeeName,
  orgName,
  portalUrl,
  shiftLabel,
}: ShiftReminderEmailProps) {
  return (
    <EmailLayout preview={`Reminder: your ${orgName} shift`}>
      <EmailHeading>You have a shift coming up</EmailHeading>
      <EmailText>
        Hi {employeeName}, this is a reminder of your upcoming {orgName} shift:
      </EmailText>
      <EmailText>
        <strong>{shiftLabel}</strong>
      </EmailText>
      <EmailButton href={portalUrl}>View my schedule</EmailButton>
      <EmailFallbackLink href={portalUrl} />
    </EmailLayout>
  );
}

export default ShiftReminderEmail;
