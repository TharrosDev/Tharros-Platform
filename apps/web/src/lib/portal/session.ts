import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/env";

/**
 * Day 37 — employee portal session.
 *
 * The portal is auth-light: the employee has no Supabase account. The magic-link
 * carries an opaque token; on `enter` we validate it and store the SAME token in
 * an httpOnly cookie. Every portal request re-validates that cookie through the
 * `validate_portal_token` SECURITY DEFINER RPC (granted to `anon`) — the DB is the
 * sole authority on who the token belongs to, so there is no app-side tenancy
 * scoping to get wrong. Revocation is immediate: the manager rotates the token
 * (sets revoked_at) and the next request fails validation.
 *
 * No `import "server-only"` so the cookie-name/options constants stay importable;
 * the actual reads use next/headers, which only resolves on the server anyway.
 */

export const PORTAL_COOKIE = "tharros_portal";

/** Cookie attributes shared by the `enter` route (set) and sign-out (clear). */
export function portalCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/portal",
    // The DB token validity is authoritative; the cookie just needs to outlive a
    // typical session. 90 days keeps employees signed in between shifts.
    maxAge: 60 * 60 * 24 * 90,
  };
}

export type PortalSession = {
  employeeId: string;
  orgId: string;
  employeeName: string;
  orgName: string;
};

type ValidateRow = {
  employee_id: string;
  org_id: string;
  employee_name: string;
  org_name: string;
};

/** Anon Supabase client (no session) — the RPC is granted to the anon role. */
function anonClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Validate a raw token → the scoped employee identity, or null. */
export async function validatePortalToken(
  token: string | undefined | null,
): Promise<PortalSession | null> {
  if (!token) return null;
  const { data, error } = await anonClient().rpc("validate_portal_token", {
    p_token: token,
  });
  if (error) return null;
  const row = (Array.isArray(data) ? data[0] : data) as ValidateRow | undefined;
  if (!row) return null;
  return {
    employeeId: row.employee_id,
    orgId: row.org_id,
    employeeName: row.employee_name,
    orgName: row.org_name,
  };
}

/** Resolve the current portal session from the httpOnly cookie (or null). */
export async function getPortalSession(): Promise<PortalSession | null> {
  const store = await cookies();
  return validatePortalToken(store.get(PORTAL_COOKIE)?.value);
}

/** Clear the portal cookie (sign-out). */
export async function clearPortalCookie(): Promise<void> {
  const store = await cookies();
  store.delete({ name: PORTAL_COOKIE, path: "/portal" });
}
