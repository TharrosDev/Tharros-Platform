import { z } from "zod";

/**
 * Validation for the team-invite form. Shared by the client form (for typing)
 * and the server action (the authoritative check). Mirrors the DB constraint on
 * invites.role — owner is never assignable by invite.
 */

export const INVITE_ROLE_OPTIONS = [
  { value: "member", label: "Member", hint: "Can use the workspace." },
  { value: "admin", label: "Admin", hint: "Can also manage team + settings." },
] as const;

const ROLE_VALUES = INVITE_ROLE_OPTIONS.map((o) => o.value) as [string, ...string[]];

export const inviteEmailSchema = z
  .email({ error: "Enter a valid email address." })
  .trim()
  .toLowerCase();

export const inviteRoleSchema = z.enum(ROLE_VALUES, { error: "Choose a role." });

export const inviteSchema = z.object({
  email: inviteEmailSchema,
  role: inviteRoleSchema,
});

/** Shape returned by the invite server action. `ok` drives the success toast. */
export type TeamFormState =
  | {
      ok?: boolean;
      errors?: Record<string, string[] | undefined>;
      message?: string;
      values?: Record<string, string>;
    }
  | undefined;
