import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getOrgContext, type UserOrg } from "@/lib/org/queries";
import { logger } from "@/lib/observability/logger";

export type TeamRole = "owner" | "admin" | "member";

export type TeamMember = {
  userId: string;
  email: string;
  name: string | null;
  role: TeamRole;
};

export type PendingInvite = {
  id: string;
  email: string;
  role: "admin" | "member";
  expiresAt: string;
};

export type Team = {
  /** The org these members belong to, or null when the user has no active org. */
  activeOrg: UserOrg | null;
  /** The viewer's role in the active org — drives which actions the UI shows. */
  viewerRole: TeamRole | null;
  members: TeamMember[];
  /** Live (un-accepted, un-revoked, un-expired) invites. Empty for non-managers. */
  pendingInvites: PendingInvite[];
};

// PostgREST row shapes (clients are untyped in this repo).
type MembershipRow = {
  user_id: string;
  role: TeamRole;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type InviteRow = {
  id: string;
  email: string;
  role: "admin" | "member";
  expires_at: string;
};

/**
 * Loads the active org's members + pending invites. Reads ride the Day-11
 * memberships/profiles policies (co-members are visible) and the Day-15 invites
 * policy (only owners/admins see invite rows). `cache()` dedupes within a render.
 */
export const getTeam = cache(async (): Promise<Team> => {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) {
    return { activeOrg: null, viewerRole: null, members: [], pendingInvites: [] };
  }

  const supabase = await createClient();
  // Members are fetched in two steps rather than via a PostgREST embed:
  // `memberships` has no FK to `profiles` (both only reference auth.users), so
  // `memberships.select("...profiles(...)")` errors with PGRST200. We fetch
  // memberships, then the matching profiles, and join in JS — the same
  // separate-query pattern getOrgContext uses. Both reads are RLS-scoped to the
  // caller's co-members.
  const [membersRes, invitesRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, role, created_at")
      .eq("org_id", activeOrg.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("invites")
      .select("id, email, role, expires_at")
      .eq("org_id", activeOrg.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true }),
  ]);

  if (membersRes.error) {
    logger.error("getTeam: memberships query failed", {
      err: membersRes.error,
      orgId: activeOrg.id,
    });
  }
  if (invitesRes.error) {
    logger.error("getTeam: invites query failed", {
      err: invitesRes.error,
      orgId: activeOrg.id,
    });
  }

  const membershipRows = (membersRes.data ?? []) as unknown as MembershipRow[];

  const userIds = membershipRows.map((r) => r.user_id);
  let profilesById = new Map<string, ProfileRow>();
  if (userIds.length > 0) {
    const profilesRes = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);
    if (profilesRes.error) {
      logger.error("getTeam: profiles query failed", {
        err: profilesRes.error,
        orgId: activeOrg.id,
      });
    }
    profilesById = new Map(
      ((profilesRes.data ?? []) as unknown as ProfileRow[]).map((p) => [p.id, p]),
    );
  }

  const members: TeamMember[] = membershipRows.map((r) => {
    const profile = profilesById.get(r.user_id);
    return {
      userId: r.user_id,
      email: profile?.email ?? "",
      name: profile?.full_name ?? null,
      role: r.role,
    };
  });

  const pendingInvites: PendingInvite[] = (
    (invitesRes.data ?? []) as unknown as InviteRow[]
  ).map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    expiresAt: r.expires_at,
  }));

  return { activeOrg, viewerRole: activeOrg.role, members, pendingInvites };
});
