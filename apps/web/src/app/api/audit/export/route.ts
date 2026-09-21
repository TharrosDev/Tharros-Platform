import { getAuthUser } from "@/lib/auth/current-user";
import type { ActivityRow } from "@/lib/audit/present";
import { getSubscription } from "@/lib/billing/entitlements";
import { getOrgContext } from "@/lib/org/queries";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** ponytail: 20k-row cap keeps the export inside one request; stream/async-export if orgs outgrow it. */
const MAX_ROWS = 20_000;
const PAGE = 200; // the RPC clamps p_limit to 200

function csvCell(v: unknown): string {
  const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
  // Quote everything; neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Owner-only CSV download of the org's activity log (Enterprise). */
export async function GET(): Promise<Response> {
  const [user, { activeOrg }, sub] = await Promise.all([
    getAuthUser(),
    getOrgContext(),
    getSubscription(),
  ]);
  if (!user || !activeOrg) return new Response("Unauthorized", { status: 401 });
  if (activeOrg.role !== "owner") return new Response("Forbidden", { status: 403 });
  if (sub?.tier !== "enterprise") return new Response("Enterprise plan required", { status: 403 });

  // The RPC is owner/admin-gated SECURITY DEFINER; page through it newest-first.
  const supabase = await createClient();
  const rows: ActivityRow[] = [];
  let before: string | null = null;
  while (rows.length < MAX_ROWS) {
    const { data, error } = await supabase.rpc("org_activity_log", {
      p_org: activeOrg.id,
      p_limit: PAGE,
      p_before: before,
    });
    if (error) return new Response("Couldn't read the audit log.", { status: 500 });
    const page = (data ?? []) as ActivityRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
    before = page[page.length - 1].created_at;
  }

  const header = [
    "created_at",
    "source",
    "actor",
    "action",
    "entity_type",
    "entity_id",
    "model",
    "detail",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [r.created_at, r.source, r.actor, r.action, r.entity_type, r.entity_id, r.model, r.detail]
        .map(csvCell)
        .join(","),
    ),
  ];
  const date = new Date().toISOString().slice(0, 10);
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tharros-audit-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
