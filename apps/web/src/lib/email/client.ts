import "server-only";

import { Resend } from "resend";

import { env } from "@/env";

/**
 * Server-side Resend client. This is the single seam every app-sent email goes
 * through (team invites in Day 15, the lead follow-up agent in Phase 4), so
 * swapping providers or adding middleware later touches one file.
 *
 * Note: Supabase Auth email (verify / reset / invite-via-Supabase) does NOT go
 * through this client — it is sent by Supabase over custom SMTP configured at
 * the Supabase project (same Resend account, different transport). This client
 * is for mail the application itself originates.
 *
 * `server-only` guards against importing this into a client bundle (it would
 * leak the key). The key comes from validated `env`, not raw `process.env`, so
 * a missing/blank key fails fast at boot with a named error.
 */
export const resend = new Resend(env.RESEND_API_KEY);

/**
 * Default From identity for app-sent mail. `noreply@tharros.ca` on the verified
 * sending domain (SPF/DKIM/DMARC). Override per environment via `EMAIL_FROM`.
 */
export const EMAIL_FROM = env.EMAIL_FROM ?? "Tharros <noreply@tharros.ca>";
