import { timingSafeEqual } from "node:crypto";

import { env } from "@/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDueJobs } from "@/lib/jobs/runner";
import { logger } from "@/lib/observability/logger";

// Node runtime: the worker uses the service-role client + node crypto for the
// constant-time secret compare, and may hold the response open while handlers run.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Day 38 — the durable job worker tick. Called every minute by pg_cron via
 * pg_net (see docs/JOBS.md), or by Vercel Cron — both send
 * `Authorization: Bearer <CRON_SECRET>`. Reaps stalled jobs, claims a due batch,
 * dispatches handlers, returns a summary.
 *
 * Excluded from the proxy auth gate (PUBLIC_PATHS + matcher) so the unauthenticated
 * pg_net POST isn't bounced to /login — the Bearer secret is the authorization.
 *   503 — CRON_SECRET not configured
 *   401 — missing/wrong secret
 *   200 — ran; body is the {reaped,claimed,succeeded,failed,dead} summary
 */
function authorized(req: Request, secret: string): boolean {
  const provided = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual requires equal lengths; an unequal length is already a mismatch.
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: Request): Promise<Response> {
  const secret = env.CRON_SECRET;
  if (!secret) {
    logger.error("jobs.cron_secret_missing", {});
    return Response.json({ error: "Cron not configured" }, { status: 503 });
  }
  if (!authorized(req, secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runDueJobs(createAdminClient());
  logger.info("jobs.tick", summary);
  return Response.json({ ok: true, ...summary });
}

export const GET = handle;
export const POST = handle;
