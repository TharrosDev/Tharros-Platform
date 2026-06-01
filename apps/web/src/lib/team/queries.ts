import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getOrgContext, type UserOrg } from "@/lib/org/queries";

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

// Embedded PostgREST row shapes (clients are untyped in this repo).
type MemberRow = {
  user_id: string;
  role: TeamRole;
  profiles: { email: string | null; full_name: string | null } | null;
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
  const [membersRes, invitesRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, role, created_at, profiles(email, full_name)")
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

  const members: TeamMember[] = ((membersRes.data ?? []) as unknown as MemberRow[]).map(
    (r) => ({
      userId: r.user_id,
      email: r.profiles?.email ?? "",
      name: r.profiles?.full_name ?? null,
      role: r.role,
    }),
  );

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
