"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/current-user";
import { profileSchema, type ProfileFormState } from "@/lib/profile/schemas";

/**
 * Personal-profile server action. The display name lives in two places that
 * must stay in sync: `profiles.full_name` (app-facing, RLS self-update) and the
 * auth user's `user_metadata.full_name` (what `getDisplayUser` reads to render
 * the sidebar/topbar identity). We update both, then revalidate the whole layout
 * so the shell picks up the new name.
 */

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const raw = { fullName: String(formData.get("fullName") ?? "") };
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
    .update({ full_name: parsed.data.fullName })
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
