import {
  EmailButton,
  EmailFallbackLink,
  EmailHeading,
  EmailLayout,
  EmailText,
} from "./layout";

/**
 * Day 53 — sent to each assigned employee when a manager publishes a schedule.
 * Carries a tokenized magic-link that lands on their hosted portal schedule.
 */
export type ScheduleDeliveryEmailProps = {
  employeeName: string;
  orgName: string;
  /** Tokenized portal magic-link → /portal/schedule. */
  portalUrl: string;
  /** Number of shifts in the published window. */
  shiftCount: number;
  /** Human label for the period, e.g. "Jun 15 – Jun 28". */
  periodLabel: string;
};

export function ScheduleDeliveryEmail({
  employeeName,
  orgName,
  portalUrl,
  shiftCount,
  periodLabel,
}: ScheduleDeliveryEmailProps) {
  return (
    <EmailLayout preview={`Your ${orgName} schedule is ready`}>
      <EmailHeading>Your schedule is ready</EmailHeading>
      <EmailText>
        Hi {employeeName}, {orgName} just published the schedule for {periodLabel}. You have{" "}
        {shiftCount} {shiftCount === 1 ? "shift" : "shifts"} coming up. Open your portal to see the
        details and add them to your calendar.
      </EmailText>
      <EmailButton href={portalUrl}>View my schedule</EmailButton>
      <EmailText>
        This link is personal to you — please don&apos;t forward it.
      </EmailText>
      <EmailFallbackLink href={portalUrl} />
    </EmailLayout>
  );
}

export default ScheduleDeliveryEmail;
