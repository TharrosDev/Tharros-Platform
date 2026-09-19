/**
 * Accept only same-origin relative paths as a post-auth redirect target, so a
 * `next` param (used by the team-invite accept flow and the email confirm/recovery
 * links) can't be turned into an open redirect. Rejects absolute URLs and
 * protocol-relative `//host` (which browsers treat as absolute).
 *
 * Shared by the auth server actions and the /auth/confirm route so the two paths
 * can't drift.
 */
export function sanitizeNext(value: string): string | undefined {
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  if (value.includes("\\") || /%5c/i.test(value)) return undefined;
  if (/[\u0000-\u001f\u007f]/u.test(value)) return undefined;

  try {
    const base = new URL("https://tharros.invalid");
    const resolved = new URL(value, base);
    return resolved.origin === base.origin ? value : undefined;
  } catch {
    return undefined;
  }
}
