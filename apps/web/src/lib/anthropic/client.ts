import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { env } from "@/env";

/**
 * Server-side Anthropic (Claude) client. Claude is the primary LLM for all
 * three Tharros products, so this is the single seam every server route /
 * action goes through to reach the API — swapping config or adding middleware
 * later touches one file.
 *
 * `server-only` guards against ever importing this into a client bundle (it
 * would leak the secret key). The key comes from the validated `env`, not raw
 * `process.env`, so a missing/blank key fails fast at boot with a named error.
 */
export const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
  // Day 33 — rate-limit resilience. The SDK retries 408/409/429/5xx with
  // exponential backoff and honors the `Retry-After` header on its own; we just
  // raise the ceiling from the default 2 (matches the embeddings seam's
  // MAX_RETRIES = 4). A 429 the SDK can't recover from surfaces as an
  // Anthropic.APIError(status: 429) for the caller to handle gracefully.
  maxRetries: 4,
});

// Model ids + routing live in the pure `./models` module (so they're testable
// without this server-only seam); re-export for existing call sites.
export { CHEAP_MODEL, DEFAULT_MODEL, modelForTemplate } from "./models";
