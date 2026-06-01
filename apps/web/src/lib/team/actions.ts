"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/current-user";
import { getDisplayUser } from "@/lib/auth/user";
import { getOrgContext } from "@/lib/org/queries";
import { getURL } from "@/lib/site-url";
import { sendEmail } from "@/lib/email/send";
import { checkRateLimit } from "@/lib/rate-limit";
import { InviteEmail } from "@/lib/email/templates/invite";
import { inviteSchema, type TeamFormState } from "@/lib/team/schemas";

/**
 * Team server actions. The invite create/resend/revoke paths go through the
 * Day-15 SECURITY DEFINER RPCs; member removal + role changes go through plain
 * table writes gated by the Day-11 memberships RLS policies + last-owner guard.
 * Every action revalidates /settings/team so the lists refresh.
 */

const TEAM_PATH = "/settings/team";

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

function acceptUrlFor(token: string): string {
  return `${getURL()}/invite/accept?token=${encodeURIComponent(token)}`;
}

/** Invite an email into the active org as member or admin, then email the link. */
export async function sendInvite(
  _prev: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const raw = {
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? ""),
  };
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values: raw };
  }

  const [user, { activeOrg }] = await Promise.all([getAuthUser(), getOrgContext()]);
  if (!user || !activeOrg) {
    return { message: "No active organization. Try refreshing the page.", values: raw };
  }

  // Throttle invite sends per inviter to cap Resend-quota abuse.
  const { allowed } = await checkRateLimit(`invite:${user.id}`, 20, 3600);
  if (!allowed) {
    return { message: "You're sending invites too quickly. Please try again later.", values: raw };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invite", {
    p_org: activeOrg.id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });

  if (error) {
    return { message: error.message, values: raw };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const token = row?.token as string | undefined;
  if (!token) {
    return { message: "Could not create the invite. Please try again.", values: raw };
  }

  const sent = await sendEmail({
    to: parsed.data.email,
    subject: `You're invited to ${activeOrg.name} on Tharros`,
    react: InviteEmail({
      inviterName: getDisplayUser(user).name,
      orgName: activeOrg.name,
      acceptUrl: acceptUrlFor(token),
    }),
  });

  revalidatePath(TEAM_PATH);

  if (!sent.ok) {
    // The invite exists; only the email failed. Tell the truth so they can resend.
    return {
      ok: true,
      message: `Invite created, but the email failed to send (${sent.error}). Use Resend to try again.`,
    };
  }

  return { ok: true, message: `Invite sent to ${parsed.data.email}.` };
}

/** Reissue a pending invite (new token + expiry) and re-send the email. */
export async function resendInvite(inviteId: string): Promise<{ error?: string }> {
  if (!inviteId) return { error: "Missing invite." };

  const [user, { activeOrg }] = await Promise.all([getAuthUser(), getOrgContext()]);
  if (!user || !activeOrg) return { error: "Not authenticated." };

  const { allowed } = await checkRateLimit(`invite:${user.id}`, 20, 3600);
  if (!allowed) return { error: "You're sending invites too quickly. Please try again later." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resend_invite", { p_invite: inviteId });
  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  const token = row?.token as string | undefined;
  const email = row?.email as string | undefined;
  if (token && email) {
    await sendEmail({
      to: email,
      subject: `You're invited to ${activeOrg.name} on Tharros`,
      react: InviteEmail({
        inviterName: getDisplayUser(user).name,
        orgName: activeOrg.name,
        acceptUrl: acceptUrlFor(token),
      }),
    });
  }

  revalidatePath(TEAM_PATH);
  return {};
}

/** Cancel a pending invite. */
export async function revokeInvite(inviteId: string): Promise<{ error?: string }> {
  if (!inviteId) return { error: "Missing invite." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invite", { p_invite: inviteId });
  if (error) return { error: error.message };

  revalidatePath(TEAM_PATH);
  return {};
}

/** Remove a member from the active org. Gated by RLS + the last-owner guard. */
export async function removeMember(userId: string): Promise<{ error?: string }> {
  if (!userId) return { error: "Missing member." };

  const { activeOrg } = await getOrgContext();
  if (!activeOrg) return { error: "No active organization." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("org_id", activeOrg.id)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath(TEAM_PATH);
  return {};
}

/** Change a member's role. Owners-only per the Day-11 UPDATE policy. */
export async function changeRole(
  userId: string,
  role: "admin" | "member",
): Promise<{ error?: string }> {
  if (!userId) return { error: "Missing member." };
  if (role !== "admin" && role !== "member") return { error: "Invalid role." };

  const { activeOrg } = await getOrgContext();
  if (!activeOrg) return { error: "No active organization." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .update({ role })
    .eq("org_id", activeOrg.id)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath(TEAM_PATH);
  return {};
}
