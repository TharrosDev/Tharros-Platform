import { z } from "zod";

/**
 * Validation for the personal-profile form. Shared by the client form (for
 * typing) and the server action (the authoritative check). Only the display
 * name is editable here; email is shown read-only (changing it needs a
 * re-verification flow that is out of Day-21 scope).
 */

export const displayNameSchema = z
  .string()
  .min(1, { error: "Enter your name." })
  .max(80, { error: "Keep your name under 80 characters." })
  .trim();

export const profileSchema = z.object({
  fullName: displayNameSchema,
});

/** Shape returned by the profile server action. `ok` drives the success toast. */
export type ProfileFormState =
  | {
      ok?: boolean;
      errors?: Record<string, string[] | undefined>;
      message?: string;
      values?: Record<string, string>;
    }
  | undefined;
