"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getURL } from "@/lib/site-url";
import {
  logInSchema,
  requestResetSchema,
  signUpSchema,
  updatePasswordSchema,
  type AuthFormState,
} from "@/lib/auth/schemas";

/**
 * Auth server actions. Each validates with its zod schema, calls the matching
 * `supabase.auth.*` method, and either returns an `AuthFormState` (errors stay
 * on the form) or `redirect()`s on success.
 *
 * Note: `redirect()` works by throwing, so it must live OUTSIDE any try/catch —
 * a catch-all would swallow the control-flow signal.
 */

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values: { fullName: raw.fullName, email: raw.email } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${getURL()}/auth/confirm?next=/dashboard`,
    },
  });

  if (error) {
    return { message: error.message, values: { fullName: raw.fullName, email: raw.email } };
  }

  redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function logIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const parsed = logInSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values: { email: raw.email } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Supabase returns this when the account exists but the email isn't verified.
    if (/confirm/i.test(error.message)) {
      return {
        message: "Please verify your email before signing in. Check your inbox for the confirmation link.",
        values: { email: raw.email },
      };
    }
    return { message: "That email or password doesn't match our records.", values: { email: raw.email } };
  }

  redirect("/dashboard");
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = { email: String(formData.get("email") ?? "") };
  const parsed = requestResetSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  // Ignore the result on purpose — never reveal whether an email is registered.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getURL()}/auth/confirm?next=/reset-password`,
  });

  return { message: "sent" };
}

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = { password: String(formData.get("password") ?? "") };
  const parsed = updatePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  // The recovery link (via /auth/confirm) established a session, so updateUser
  // applies to the right account.
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { message: error.message };
  }

  redirect("/dashboard");
}

export async function resendVerification(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { message: "Missing email address." };

  const supabase = await createClient();
  await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${getURL()}/auth/confirm?next=/dashboard` },
  });

  return { message: "resent" };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
