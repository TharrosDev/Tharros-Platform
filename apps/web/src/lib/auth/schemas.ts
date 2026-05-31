import { z } from "zod";

/**
 * Shared validation for the auth forms. Used by both the client form components
 * (for `useActionState` typing) and the server actions (the authoritative check).
 */

export const emailSchema = z.email({ error: "Please enter a valid email." }).trim();

// Password strength for NEW passwords (signup + reset). Login intentionally only
// checks "non-empty" so the rules can tighten later without locking anyone out.
export const passwordSchema = z
  .string()
  .min(8, { error: "Use at least 8 characters." })
  .regex(/[a-zA-Z]/, { error: "Include at least one letter." })
  .regex(/[0-9]/, { error: "Include at least one number." });

export const fullNameSchema = z
  .string()
  .min(2, { error: "Enter your name." })
  .trim();

export const signUpSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const logInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Enter your password." }),
});

export const requestResetSchema = z.object({ email: emailSchema });

export const updatePasswordSchema = z.object({ password: passwordSchema });

/** Shape returned by every auth server action on failure. */
export type AuthFormState =
  | {
      errors?: Record<string, string[] | undefined>;
      message?: string;
      values?: Record<string, string>;
    }
  | undefined;
