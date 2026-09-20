import { EmailButton, EmailFallbackLink, EmailHeading, EmailLayout, EmailText } from "./layout";

/**
 * Day 40 — generic notification email. App-sent (via lib/email/send) by the
 * `notification-send` job handler, carrying a notification's title + body and an
 * optional action link. The in-app inbox is the canonical copy; this is the
 * email channel of the same `notification_events` row.
 */
export type NotificationEmailProps = {
  title: string;
  body: string;
  /** Optional call-to-action link. */
  actionUrl?: string;
  actionLabel?: string;
};

export function NotificationEmail({ title, body, actionUrl, actionLabel }: NotificationEmailProps) {
  return (
    <EmailLayout preview={title}>
      <EmailHeading>{title}</EmailHeading>
      <EmailText>{body}</EmailText>
      {actionUrl ? <EmailButton href={actionUrl}>{actionLabel ?? "View"}</EmailButton> : null}
      {actionUrl ? <EmailFallbackLink href={actionUrl} /> : null}
    </EmailLayout>
  );
}

export default NotificationEmail;
