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
});

/**
 * Default model for product work. Opus 4.8 is the most capable model and the
 * baseline for the RAG assistant + agents (Phase 2+). Drop to a cheaper model
 * (`claude-haiku-4-5`) per-call for simple/classification tasks to manage cost
 * — Claude's only ceiling is cost, not capability (see the tech-stack notes).
 */
export const DEFAULT_MODEL = "claude-opus-4-8";
