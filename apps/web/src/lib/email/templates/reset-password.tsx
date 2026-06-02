import {
  EmailButton,
  EmailFallbackLink,
  EmailHeading,
  EmailLayout,
  EmailText,
} from "./layout";

/**
 * Password-reset template. Used by Supabase Auth (recovery): rendered to a
 * static HTML string and set as `mailer_templates_recovery_content`, so
 * `resetUrl` is passed the literal Go-template href
 * `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`.
 */
export type ResetPasswordProps = {
  resetUrl: string;
};

export function ResetPassword({ resetUrl }: ResetPasswordProps) {
  return (
    <EmailLayout preview="Reset your Tharros password">
      <EmailHeading>Reset your password</EmailHeading>
      <EmailText>
        We received a request to reset the password on your Tharros account.
        Click below to choose a new one.
      </EmailText>
      <EmailButton href={resetUrl}>Reset password</EmailButton>
      <EmailText>
        This link expires in 1 hour. If you didn&apos;t request a reset, you can
        ignore this email and your password won&apos;t change.
      </EmailText>
      <EmailFallbackLink href={resetUrl} />
    </EmailLayout>
  );
}

export default ResetPassword;
