import "server-only";

import type { User } from "@supabase/supabase-js";

import { getAuthUser } from "@/lib/auth/current-user";
import { getFeatureAccess } from "@/lib/billing/entitlements";
import { getOrgContext, type UserOrg } from "@/lib/org/queries";

export type SchedulingAccess =
  | { ok: true; user: User; activeOrg: UserOrg }
  | { ok: false; message: string };

/**
 * Authoritative Scheduling product gate for Server Actions/API-like entry
 * points. Page layouts are UX only; mutations and AI spend must recheck access.
 */
export async function requireSchedulingAccess(): Promise<SchedulingAccess> {
  const [user, { activeOrg }, access] = await Promise.all([
    getAuthUser(),
    getOrgContext(),
    getFeatureAccess("scheduling"),
  ]);

  if (!user || !activeOrg) {
    return { ok: false, message: "Not authenticated." };
  }
  if (!access.entitled) {
    return {
      ok: false,
      message: "Your current plan does not include Workforce Scheduling.",
    };
  }
  return { ok: true, user, activeOrg };
}
