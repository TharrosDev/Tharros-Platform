import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Knowledge gaps for owners/admins: questions the documents couldn't answer
 * (searches that found nothing) and answers people marked unhelpful. Read with
 * the service role because conversations are private to their author; callers
 * must check the viewer is an owner/admin of `orgId` first.
 */
export type KnowledgeGaps = {
  misses: { query: string; at: string }[];
  unhelpful: { answer: string; at: string }[];
};

const WINDOW_DAYS = 30;

export async function getKnowledgeGaps(orgId: string): Promise<KnowledgeGaps> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const [{ data: missRows }, { data: downRows }] = await Promise.all([
    admin
      .from("messages")
      .select("usage, created_at")
      .eq("org_id", orgId)
      .eq("role", "assistant")
      .not("usage->knowledge_misses", "is", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("message_feedback")
      .select("created_at, messages(content)")
      .eq("org_id", orgId)
      .eq("rating", -1)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const seen = new Set<string>();
  const misses: KnowledgeGaps["misses"] = [];
  for (const row of (missRows ?? []) as {
    usage: { knowledge_misses?: string[] };
    created_at: string;
  }[]) {
    for (const q of row.usage.knowledge_misses ?? []) {
      const key = q.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      misses.push({ query: q, at: row.created_at });
    }
  }

  const unhelpful = (
    (downRows ?? []) as unknown as {
      created_at: string;
      messages: { content: string } | null;
    }[]
  )
    .filter((r) => r.messages)
    .map((r) => ({ answer: r.messages!.content, at: r.created_at }));

  return { misses: misses.slice(0, 25), unhelpful };
}
