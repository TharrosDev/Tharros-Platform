"use server";

import { getAuthUser } from "@/lib/auth/current-user";
import { getOrgContext } from "@/lib/org/queries";
import { createClient } from "@/lib/supabase/server";

/** Thumbs up/down on an assistant answer. RLS: own row, message in own org. */
export async function rateMessage(messageId: string, rating: 1 | -1): Promise<{ ok: boolean }> {
  const [user, { activeOrg }] = await Promise.all([getAuthUser(), getOrgContext()]);
  if (!user || !activeOrg || (rating !== 1 && rating !== -1)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("message_feedback")
    .upsert(
      { message_id: messageId, user_id: user.id, org_id: activeOrg.id, rating },
      { onConflict: "message_id,user_id" },
    );
  return { ok: !error };
}
