import "server-only";

import { env } from "@/env";
import { logger } from "@/lib/observability/logger";

/**
 * Day 26 — embeddings seam. The single place the platform turns text into
 * vectors, so swapping providers (Voyage, NVIDIA NIM — see roadmap "considered &
 * deferred") later touches one file. MVP provider: OpenAI text-embedding-3-small
 * (1536-dim — matches the document_chunks.embedding column). Uses plain fetch
 * (no SDK dep); the key comes from the validated `env` and is optional there, so
 * we fail fast with a clear message if it's unset.
 */

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

/** Max inputs per OpenAI embeddings request. Kept modest to stay well under the
 * per-request token cap and the lower free-tier rate limits. */
const BATCH_SIZE = 64;
const MAX_RETRIES = 4;

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Embed one batch (≤ BATCH_SIZE inputs) with retry/backoff on 429 + 5xx. */
async function embedBatch(inputs: string[], apiKey: string): Promise<number[][]> {
  let lastError = "";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(OPENAI_EMBEDDINGS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs }),
    });

    if (res.ok) {
      const json = (await res.json()) as {
        data: { index: number; embedding: number[] }[];
      };
      // OpenAI may return out of order — sort by index to align with `inputs`.
      return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    }

    lastError = `${res.status} ${await res.text()}`;
    // Retry rate-limits + transient server errors with exponential backoff.
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const backoffMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(2 ** attempt * 500, 8000);
      logger.warn("embeddings.retry", { status: res.status, attempt, backoffMs });
      await sleep(backoffMs);
      continue;
    }
    break;
  }
  throw new Error(`OpenAI embeddings failed: ${lastError}`);
}

/**
 * Embed an array of texts → an array of 1536-dim vectors, index-aligned with the
 * input. Batches internally. Throws if the key is missing or the API fails.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set — add it to the environment before embedding documents.",
    );
  }

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    out.push(...(await embedBatch(batch, apiKey)));
  }
  return out;
}

/** Format a vector as the pgvector text literal PostgREST expects: `[a,b,c]`. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
