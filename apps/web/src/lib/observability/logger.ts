/**
 * Structured logger. One small surface for every server-side log line so we get
 * consistent, machine-parseable output in production (Vercel log drains, future
 * ingestion) and readable lines in development.
 *
 * - Production: one JSON object per line (`{ level, msg, time, ...context }`).
 * - Development: a compact human-readable line, same fields.
 *
 * `logger.error` is also the seam to our error tracker: it forwards the error to
 * Sentry (a no-op until a DSN is configured — see ./sentry). Call it with an
 * `Error` in the context's `err` field to get a captured exception; otherwise it
 * captures the message.
 *
 * Keep this dependency-light and edge-safe: it must run in the Node and Edge
 * runtimes and inside instrumentation, so no Node-only APIs at module scope.
 */
import { captureError, captureMessage } from "./sentry";

type LogLevel = "debug" | "info" | "warn" | "error";

/** Arbitrary structured fields attached to a log line. `err` is special-cased. */
export type LogContext = Record<string, unknown> & { err?: unknown };

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const isProd = process.env.NODE_ENV === "production";

// In production keep debug noise out unless explicitly opted in via LOG_LEVEL.
const minLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ?? (isProd ? "info" : "debug");

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { value: err };
}

function emit(level: LogLevel, msg: string, context: LogContext = {}) {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) return;

  const { err, ...rest } = context;
  const record: Record<string, unknown> = {
    level,
    msg,
    time: new Date().toISOString(),
    ...rest,
  };
  if (err !== undefined) record.err = serializeError(err);

  // Route to the matching console method so platform log levels line up.
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (isProd) {
    sink(JSON.stringify(record));
  } else {
    const ctxKeys = Object.keys(rest).length || err !== undefined;
    sink(
      `${level.toUpperCase().padEnd(5)} ${msg}`,
      ctxKeys ? { ...rest, ...(err !== undefined ? { err } : {}) } : "",
    );
  }
}

export const logger = {
  debug: (msg: string, context?: LogContext) => emit("debug", msg, context),
  info: (msg: string, context?: LogContext) => emit("info", msg, context),
  warn: (msg: string, context?: LogContext) => emit("warn", msg, context),
  /**
   * Log an error AND forward it to the error tracker. Pass the thrown value as
   * `context.err` to capture a real exception with its stack.
   */
  error: (msg: string, context?: LogContext) => {
    emit("error", msg, context);
    const err = context?.err;
    const { err: _omit, ...extra } = context ?? {};
    if (err !== undefined) {
      captureError(err, { message: msg, ...extra });
    } else {
      captureMessage(msg, extra);
    }
  },
};
