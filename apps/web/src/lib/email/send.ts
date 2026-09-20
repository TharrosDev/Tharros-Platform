import "server-only";

import type { ReactElement } from "react";

import { logger } from "@/lib/observability/logger";

import { EMAIL_FROM, resend } from "./client";

/**
 * Generic transactional-email send. The one wrapper every app-sent email goes
 * through, so logging, error reporting, and From defaults live in one place.
 *
 * Renders a React Email template via Resend's `react` field (Resend handles the
 * HTML render + a generated text alternative). Failures are logged through the
 * observability seam (which forwards to Sentry) and returned as a typed result
 * rather than thrown — callers decide whether a failed notification should block
 * their flow. Resend itself does not throw on a send failure; it returns `error`.
 */
export type SendEmailParams = {
  to: string | string[];
  subject: string;
  react: ReactElement;
  /** Optional reply-to (e.g. a human inbox for invites). Defaults to none. */
  replyTo?: string | string[];
  /** Stable provider idempotency key for retryable/durable sends. */
  idempotencyKey?: string;
};

export type SendEmailResult = { ok: true; id: string } | { ok: false; error: string };

export async function sendEmail({
  to,
  subject,
  react,
  replyTo,
  idempotencyKey,
}: SendEmailParams): Promise<SendEmailResult> {
  try {
    const { data, error } = await resend.emails.send(
      {
        from: EMAIL_FROM,
        to,
        subject,
        react,
        ...(replyTo ? { replyTo } : {}),
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    if (error) {
      logger.error("email send failed", { err: error, subject });
      return { ok: false, error: error.message };
    }

    logger.info("email sent", { id: data?.id, subject });
    return { ok: true, id: data?.id ?? "" };
  } catch (err) {
    // Network / unexpected failure — Resend normally returns `error` instead.
    logger.error("email send threw", { err, subject });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}
