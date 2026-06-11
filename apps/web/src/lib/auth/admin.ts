/**
 * Platform-admin allowlist: the people who can review feedback submissions
 * and approve rewards across ALL orgs (not an org role — a Tharros-side
 * permission). Checked server-side before any admin-client read of the
 * deny-all feedback tables. Pure, so it's importable anywhere.
 */
const PLATFORM_ADMIN_EMAILS = ["magnus.abdelnour@gmail.com"];

export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return PLATFORM_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
