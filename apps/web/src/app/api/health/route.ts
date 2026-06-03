import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";

/**
 * Liveness/readiness probe. Returns the app's status plus a lightweight check of
 * each external dependency it can't run without. Used by uptime monitors and for
 * a quick "is prod actually wired" smoke test after deploys.
 *
 *   200 { status: "ok",       checks: { database: "up" } }
 *   503 { status: "degraded", checks: { database: "down" } }
 *
 * Always request-time and never cached — a cached health check is a lie.
 */
export const dynamic = "force-dynamic";

type CheckStatus = "up" | "down";

async function checkDatabase(): Promise<CheckStatus> {
  try {
    const supabase = await createClient();
    // Real connectivity probe: a HEAD-style count against feature_flags (Day 7,
    // public-read under RLS). This makes an actual PostgREST round-trip, so it
    // fails when Postgres/Supabase is unreachable. (auth.getSession() only reads
    // the local cookie and would report healthy even with the DB down.)
    const { error } = await supabase
      .from("feature_flags")
      .select("key", { head: true, count: "exact" });
    return error ? "down" : "up";
  } catch (err) {
    logger.error("Health check: database probe threw", { err, check: "database" });
    return "down";
  }
}

export async function GET() {
  const database = await checkDatabase();
  const healthy = database === "up";

  const body = {
    status: healthy ? "ok" : "degraded",
    time: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
    checks: { database },
  };

  return Response.json(body, { status: healthy ? 200 : 503 });
}
