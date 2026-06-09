import { z } from "zod";

/**
 * Validation for the personal-profile form. Shared by the client form (for
 * typing) and the server action (the authoritative check). Email is shown
 * read-only (changing it needs a re-verification flow that is out of scope).
 */

export const displayNameSchema = z
  .string()
  .min(1, { error: "Enter your name." })
  .max(80, { error: "Keep your name under 80 characters." })
  .trim();

const optionalText = (max: number, label: string) =>
  z
    .string()
    .max(max, { error: `Keep your ${label} under ${max} characters.` })
    .trim()
    .optional()
    .or(z.literal(""));

export const profileSchema = z.object({
  fullName: displayNameSchema,
  jobTitle: optionalText(80, "job title"),
  bio: optionalText(500, "about section"),
  phone: optionalText(40, "phone number"),
  location: optionalText(120, "location"),
  timezone: optionalText(80, "timezone"),
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
