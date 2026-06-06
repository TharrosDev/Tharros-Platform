/**
 * Day 45 — DeepSeek model ids + endpoint, kept pure (no `server-only`) so they're
 * importable by the unit harness and any caller. DeepSeek is the provider for ALL
 * scheduling AI (cheap at the hundreds-of-calls/month scheduling drives); the RAG
 * assistant stays on Claude (see `lib/anthropic/models`).
 *
 * DeepSeek is OpenAI-compatible — the client (`./client`) talks to it with plain
 * `fetch` against the Chat Completions endpoint, no SDK (mirrors the embeddings
 * seam). The legacy `deepseek-chat`/`deepseek-reasoner` ids deprecate 2026-07-24
 * in favour of the `deepseek-v4-*` family below.
 *
 * NOTE: the v4 models default to THINKING mode (kept on — it improves parse
 * accuracy). Thinking mode rejects a forced named `tool_choice`, so the
 * structured-output harness uses `tool_choice: "auto"`. Reasoning tokens count as
 * output tokens (billed at the output rate), so a thinking call costs more output
 * than a bare completion — still a fraction of a cent per parse.
 */

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

/**
 * Default scheduling model: `deepseek-v4-flash` — cheapest tier (~$0.14/M in,
 * $0.28/M out), 1M context. Ample for availability NL-parsing and the high-volume
 * agent steps; individual callers can override per call.
 */
export const SCHEDULING_MODEL = "deepseek-v4-flash";

/**
 * Stronger reasoning tier (~3× the price). Reserved for quality-critical agent
 * steps later (Day 47–49 forecasting / intent / judge); not used by Day 45.
 */
export const SCHEDULING_MODEL_PRO = "deepseek-v4-pro";
