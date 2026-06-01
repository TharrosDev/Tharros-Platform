import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/current-user";

/** An org the current user belongs to, flattened for the shell + switcher. */
export type UserOrg = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member";
  onboarded: boolean;
};

export type OrgContext = {
  orgs: UserOrg[];
  activeOrg: UserOrg | null;
  /** True when the active org still needs the first-run onboarding wizard. */
  needsOnboarding: boolean;
};

// Shape of the embedded PostgREST row (clients are untyped in this repo).
type MembershipRow = {
  role: UserOrg["role"];
  organizations: {
    id: string;
    name: string;
    slug: string;
    onboarded_at: string | null;
  } | null;
};

/**
 * Loads the caller's orgs, their active org (from profiles.current_org_id,
 * falling back to the first membership), and whether onboarding is still due.
 * `cache()` dedupes the work across the layout + sidebar within one request.
 */
export const getOrgContext = cache(async (): Promise<OrgContext> => {
  const user = await getAuthUser();
  if (!user) return { orgs: [], activeOrg: null, needsOnboarding: false };

  const supabase = await createClient();
  const [membershipsRes, profileRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("role, created_at, organizations(id, name, slug, onboarded_at)")
      // Scope to the caller's OWN memberships. The memberships RLS policy
      // exposes every co-member row in the user's orgs (the team page needs
      // that), so without this filter an org with N members would appear N
      // times in the switcher — once per co-member row.
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("current_org_id").eq("id", user.id).single(),
  ]);

  const rows = (membershipsRes.data ?? []) as unknown as MembershipRow[];
  const orgs: UserOrg[] = rows
    .filter((r) => r.organizations !== null)
    .map((r) => ({
      id: r.organizations!.id,
      name: r.organizations!.name,
      slug: r.organizations!.slug,
      role: r.role,
      onboarded: r.organizations!.onboarded_at !== null,
    }));

  const currentId =
    (profileRes.data as { current_org_id: string | null } | null)?.current_org_id ?? null;
  const activeOrg = orgs.find((o) => o.id === currentId) ?? orgs[0] ?? null;

  return {
    orgs,
    activeOrg,
    needsOnboarding: activeOrg ? !activeOrg.onboarded : false,
  };
});
