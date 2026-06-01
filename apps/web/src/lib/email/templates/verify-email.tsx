import {
  EmailButton,
  EmailFallbackLink,
  EmailHeading,
  EmailLayout,
  EmailText,
} from "./layout";

/**
 * Email-verification template. Used by Supabase Auth (signup confirmation):
 * rendered to a static HTML string and set as `mailer_templates_confirmation_content`,
 * so `confirmUrl` is passed the literal Go-template href
 * `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard`.
 */
export type VerifyEmailProps = {
  confirmUrl: string;
};

export function VerifyEmail({ confirmUrl }: VerifyEmailProps) {
  return (
    <EmailLayout preview="Confirm your email to finish setting up Tharros">
      <EmailHeading>Confirm your email</EmailHeading>
      <EmailText>
        Welcome to Tharros. Confirm this email address to activate your account
        and get started.
      </EmailText>
      <EmailButton href={confirmUrl}>Confirm email</EmailButton>
      <EmailText>This link expires in 24 hours.</EmailText>
      <EmailFallbackLink href={confirmUrl} />
    </EmailLayout>
  );
}

export default VerifyEmail;
