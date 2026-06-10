"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { env } from "@/env";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/current-user";
import { profileSchema, type ProfileFormState } from "@/lib/profile/schemas";

/**
 * Personal-profile server actions. The display name lives in two places that
 * must stay in sync: `profiles.full_name` (app-facing, RLS self-update) and the
 * auth user's `user_metadata.full_name` (what `getDisplayUser` reads to render
 * the sidebar/topbar identity). Same for `avatar_url`. We update both, then
 * revalidate the whole layout so the shell picks up the change.
 */

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const raw = {
    fullName: text(formData, "fullName"),
    jobTitle: text(formData, "jobTitle"),
    bio: text(formData, "bio"),
    phone: text(formData, "phone"),
    location: text(formData, "location"),
    timezone: text(formData, "timezone"),
  };
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values: raw };
  }

  const user = await getAuthUser();
  if (!user) {
    return { message: "You must be signed in.", values: raw };
  }

  const supabase = await createClient();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      job_title: parsed.data.jobTitle || null,
      bio: parsed.data.bio || null,
      phone: parsed.data.phone || null,
      location: parsed.data.location || null,
      timezone: parsed.data.timezone || null,
    })
    .eq("id", user.id);
  if (profileError) {
    return { message: profileError.message, values: raw };
  }

  const { error: authError } = await supabase.auth.updateUser({
    data: { full_name: parsed.data.fullName },
  });
  if (authError) {
    return { message: authError.message, values: raw };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Your profile has been updated." };
}

/**
 * Records a freshly-uploaded avatar (the browser uploads the file straight to
 * the public `avatars` bucket, owner-gated by Storage RLS) on both the profile
 * row and the auth metadata the shell renders from.
 */
export async function setAvatarUrl(avatarUrl: string): Promise<{ error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "You must be signed in." };

  // Only accept URLs into this user's own folder of our public avatars bucket —
  // anything else could smuggle an arbitrary external image into the shell.
  const allowedPrefix = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.id}/`;
  if (!avatarUrl.startsWith(allowedPrefix) || avatarUrl.length > 500) {
    return { error: "Invalid avatar URL." };
  }

  const supabase = await createClient();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);
  if (profileError) return { error: profileError.message };

  const { error: authError } = await supabase.auth.updateUser({
    data: { avatar_url: avatarUrl },
  });
  if (authError) return { error: authError.message };

  revalidatePath("/", "layout");
  return {};
}
