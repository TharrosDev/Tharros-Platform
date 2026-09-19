"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getURL } from "@/lib/site-url";
import { sanitizeNext } from "@/lib/auth/safe-redirect";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  opaqueRateLimitKey,
  requestFingerprint,
} from "@/lib/security/request";
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

async function authRequesterKey(namespace: string): Promise<string> {
  const h = await headers();
  return opaqueRateLimitKey(namespace, requestFingerprint(h));
}

async function authIdentityKey(namespace: string, value: string): Promise<string> {
  return opaqueRateLimitKey(namespace, value.trim().toLowerCase());
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

  const next = sanitizeNext(String(formData.get("next") ?? "")) ?? "/dashboard";

  const [requesterLimit, identityLimit] = await Promise.all([
    checkRateLimit(await authRequesterKey("signup-requester"), 8, 3600),
    checkRateLimit(await authIdentityKey("signup-email", parsed.data.email), 5, 3600),
  ]);
  if (!requesterLimit.allowed || !identityLimit.allowed) {
    return {
      message: "Too many signup attempts. Please try again later.",
      values: { fullName: raw.fullName, email: raw.email },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${getURL()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { message: error.message, values: { fullName: raw.fullName, email: raw.email } };
  }

  const verifyUrl =
    `/verify-email?email=${encodeURIComponent(parsed.data.email)}` +
    (next !== "/dashboard" ? `&next=${encodeURIComponent(next)}` : "");
  redirect(verifyUrl);
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

  const next = sanitizeNext(String(formData.get("next") ?? ""));

  const [requesterLimit, identityLimit] = await Promise.all([
    checkRateLimit(await authRequesterKey("login-requester"), 60, 900),
    checkRateLimit(await authIdentityKey("login-email", parsed.data.email), 12, 900),
  ]);
  if (!requesterLimit.allowed || !identityLimit.allowed) {
    return {
      message: "Too many sign-in attempts. Please try again later.",
      values: { email: raw.email },
    };
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

  redirect(next ?? "/dashboard");
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

  // Throttle by opaque email + requester buckets. On limit, return the same
  // neutral "sent" response: no account-enumeration signal and no email bombing.
  const [identityLimit, requesterLimit] = await Promise.all([
    checkRateLimit(await authIdentityKey("pwreset-email", parsed.data.email), 3, 900),
    checkRateLimit(await authRequesterKey("pwreset-requester"), 12, 900),
  ]);
  if (!identityLimit.allowed || !requesterLimit.allowed) return { message: "sent" };

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

  const next = sanitizeNext(String(formData.get("next") ?? "")) ?? "/dashboard";

  // Throttle by opaque identity + requester buckets; keep the response neutral.
  const [identityLimit, requesterLimit] = await Promise.all([
    checkRateLimit(await authIdentityKey("verify-email", email), 3, 900),
    checkRateLimit(await authRequesterKey("verify-requester"), 12, 900),
  ]);
  if (!identityLimit.allowed || !requesterLimit.allowed) return { message: "resent" };

  const supabase = await createClient();
  await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${getURL()}/auth/confirm?next=${encodeURIComponent(next)}` },
  });

  return { message: "resent" };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
