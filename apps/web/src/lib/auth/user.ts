import type { User } from "@supabase/supabase-js";

/** Display identity derived from a Supabase auth user, shaped for the shell. */
export type DisplayUser = {
  name: string;
  email: string;
  /** 1–2 letters for the avatar fallback. */
  initials: string;
  /** Public avatar image URL, when the user has uploaded one. */
  avatarUrl: string | null;
  /** Active org name — populated by the (app) layout from the org context. */
  company: string | null;
};

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Maps a Supabase `User` to the `DisplayUser` the sidebar/topbar render.
 * Name comes from the `full_name` set at signup, falling back to the email
 * local-part. Company starts null; the (app) layout fills it from the active org.
 */
export function getDisplayUser(user: User): DisplayUser {
  const email = user.email ?? "";
  const fullName =
    (typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "") || email.split("@")[0];

  const avatarUrl =
    typeof user.user_metadata?.avatar_url === "string" && user.user_metadata.avatar_url
      ? user.user_metadata.avatar_url
      : null;

  return {
    name: fullName,
    email,
    initials: initialsFrom(fullName),
    avatarUrl,
    company: null,
  };
}
