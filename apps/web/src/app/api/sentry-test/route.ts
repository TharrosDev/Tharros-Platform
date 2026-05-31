import * as Sentry from "@sentry/nextjs";

/**
 * TEMPORARY — Day 7 Sentry verification. Hit /api/sentry-test on the prod
 * deploy, confirm the event lands in the Sentry dashboard, then DELETE this
 * file. Sentry only reports in production (see instrumentation.ts), so this is
 * a no-op locally.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const id = Sentry.captureException(
    new Error("Sentry test error — Day 7 verification, safe to ignore"),
  );
  // Serverless functions can freeze before the event is sent — flush first.
  await Sentry.flush(2000);
  return Response.json({ ok: true, eventId: id });
}
