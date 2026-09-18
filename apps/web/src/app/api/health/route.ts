import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

type CheckStatus = "up" | "down";
type ConfigurationStatus = "ready" | "incomplete";

async function checkDatabase(): Promise<CheckStatus> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("feature_flags")
      .select("key", { head: true, count: "exact" });
    return error ? "down" : "up";
  } catch (err) {
    logger.error("Health check: database probe threw", { err, check: "database" });
    return "down";
  }
}

function checkShippedConfiguration(): ConfigurationStatus {
  const required = [
    "SUPABASE_SECRET_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "DEEPSEEK_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "RESEND_API_KEY",
    "CRON_SECRET",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  ] as const;

  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    logger.warn("Health check: shipped runtime configuration is incomplete", {
      missing,
    });
    return "incomplete";
  }
  return "ready";
}

export async function GET() {
  const [database, configuration] = await Promise.all([
    checkDatabase(),
    Promise.resolve(checkShippedConfiguration()),
  ]);
  const healthy = database === "up" && configuration === "ready";

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      time: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
      checks: {
        database,
        configuration,
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
