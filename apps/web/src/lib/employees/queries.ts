import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getOrgContext, type UserOrg } from "@/lib/org/queries";
import { logger } from "@/lib/observability/logger";

/**
 * Day 37 — employee roster reads for the manager surface. Both the employees and
 * the portal-token rows are RLS-scoped (members read employees; owners/admins
 * read tokens), so this never leaks across orgs. `cache()` dedupes within a render.
 */

export type Employee = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  /** Whether a live (un-revoked) portal token exists — i.e. a link has been sent. */
  hasPortalAccess: boolean;
  /** When the live token was last used to open the portal, if ever. */
  lastUsedAt: string | null;
};

export type Roster = {
  activeOrg: UserOrg | null;
  /** The viewer's role — drives whether management controls show. */
  viewerRole: "owner" | "admin" | "member" | null;
  employees: Employee[];
};

type EmployeeRow = {
  id: string;
  name: string;
  email: string;
  active: boolean;
};

type TokenRow = {
  employee_id: string;
  last_used_at: string | null;
};

export const getRoster = cache(async (): Promise<Roster> => {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) {
    return { activeOrg: null, viewerRole: null, employees: [] };
  }

  const supabase = await createClient();
  const [employeesRes, tokensRes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, name, email, active")
      .eq("org_id", activeOrg.id)
      .order("created_at", { ascending: true }),
    // Live tokens only (revoked_at is null). Manager-readable via RLS; returns
    // nothing for a plain member, which is fine — they don't see the controls.
    supabase
      .from("employee_portal_tokens")
      .select("employee_id, last_used_at")
      .eq("org_id", activeOrg.id)
      .is("revoked_at", null),
  ]);

  if (employeesRes.error) {
    logger.error("getRoster: employees query failed", {
      err: employeesRes.error,
      orgId: activeOrg.id,
    });
  }
  if (tokensRes.error) {
    logger.error("getRoster: tokens query failed", {
      err: tokensRes.error,
      orgId: activeOrg.id,
    });
  }

  const liveTokens = new Map(
    ((tokensRes.data ?? []) as unknown as TokenRow[]).map((t) => [t.employee_id, t]),
  );

  const employees: Employee[] = ((employeesRes.data ?? []) as unknown as EmployeeRow[]).map(
    (e) => {
      const token = liveTokens.get(e.id);
      return {
        id: e.id,
        name: e.name,
        email: e.email,
        active: e.active,
        hasPortalAccess: Boolean(token),
        lastUsedAt: token?.last_used_at ?? null,
      };
    },
  );

  return { activeOrg, viewerRole: activeOrg.role, employees };
});
