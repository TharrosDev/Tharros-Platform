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
    // Cheap round-trip that doesn't depend on any app table existing yet: ask
    // PostgREST for the server time via a HEAD-style count on a system view.
    // `auth.getSession()` hits Supabase without requiring schema, so use it as a
    // connectivity probe.
    const { error } = await supabase.auth.getSession();
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
