import "server-only";

import { env } from "@/env";
import { logger } from "@/lib/observability/logger";

import { DEEPSEEK_BASE_URL } from "./models";
import type { DeepSeekChatResponse } from "./structured";

/**
 * Day 45 — DeepSeek chat-completions seam. DeepSeek speaks the OpenAI dialect, so
 * this is a thin `fetch` wrapper (no SDK dep — mirrors `lib/documents/embeddings`)
 * that every scheduling AI call goes through. Swapping config or middleware later
 * touches one file.
 *
 * `server-only` keeps the secret out of the client bundle. The key is `.optional()`
 * in `env` until it's vaulted for every Vercel environment, so we fail fast here
 * with a named error if a call is made without it (same contract as embeddings).
 * Retries 429/5xx with exponential backoff (matches the embeddings MAX_RETRIES).
 */

const CHAT_COMPLETIONS_URL = `${DEEPSEEK_BASE_URL}/chat/completions`;
const MAX_RETRIES = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Call DeepSeek's chat completions endpoint. `req` is an OpenAI-shaped body. */
export async function chatCompletion(req: Record<string, unknown>): Promise<DeepSeekChatResponse> {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error(
      "DEEPSEEK_API_KEY is not set — scheduling AI is unavailable until it is vaulted.",
    );
  }

  let lastError = "";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req),
    });

    if (res.ok) {
      return (await res.json()) as DeepSeekChatResponse;
    }

    // Retry transient failures (rate limit + 5xx); fail fast on 4xx (bad request).
    const retryable = res.status === 429 || res.status >= 500;
    lastError = `DeepSeek ${res.status}: ${await res.text().catch(() => res.statusText)}`;
    if (!retryable || attempt === MAX_RETRIES) break;

    const backoffMs = 500 * 2 ** attempt;
    logger.warn("deepseek.retry", { status: res.status, attempt, backoffMs });
    await sleep(backoffMs);
  }

  throw new Error(`DeepSeek chat completion failed: ${lastError}`);
}
