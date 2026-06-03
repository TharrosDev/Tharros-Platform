import "server-only";

import type {
  MessageCreateParamsNonStreaming,
  TextBlockParam,
  Usage,
} from "@anthropic-ai/sdk/resources/messages";

import { anthropic, DEFAULT_MODEL } from "@/lib/anthropic/client";
import { searchChunks } from "@/lib/documents/retrieval";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import {
  buildCitations,
  buildContextBlock,
  NO_CONTEXT_ANSWER,
  SYSTEM_PROMPT,
  type Citation,
  type GroundingChunk,
} from "@/lib/documents/rag-prompt";

/**
 * Day 28 — RAG query pipeline. Ties the Day-27 retrieval seam to Claude:
 * retrieve top-k chunks → join their document filenames → ground Claude with a
 * cite-or-say-"I don't know" prompt. Day 29 layers a streaming chat UI on top,
 * reusing `buildRagRequest` so the prompt assembly lives in exactly one place.
 */

export type RagAnswer = {
  answer: string;
  citations: Citation[];
  /** True when the answer was generated from retrieved sources (vs. the no-context short-circuit). */
  grounded: boolean;
  /** Token usage from the Claude call (null on the no-context path — no call made). */
  usage: Usage | null;
};

export type AnswerOptions = {
  /** Max chunks to retrieve (RPC clamps to 1..50). Default 6. */
  limit?: number;
};

/**
 * Retrieve the top-k chunks for `question` in `orgId` and join each to its
 * document filename (for grounding + citations). Goes through the RLS
 * user-session client, so tenancy is enforced by the database. Returns [] on a
 * blank query, no matches, a lookup error, or when no chunk has a live document
 * row — i.e. the "no grounded context" signal the caller decides how to handle.
 *
 * Shared by `answerQuestion` (Day 28, non-streaming) and the Day-29 streaming
 * chat endpoint so the retrieval + filename-join logic lives in one place.
 */
export async function retrieveGroundingChunks(
  orgId: string,
  question: string,
  options: AnswerOptions = {},
): Promise<GroundingChunk[]> {
  const chunks = await searchChunks(orgId, question, { limit: options.limit ?? 6 });
  if (chunks.length === 0) return [];

  // Join chunk → document filename. RLS scopes this to the caller's orgs;
  // chunks whose document row is missing are dropped.
  const documentIds = [...new Set(chunks.map((c) => c.documentId))];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, filename")
    .in("id", documentIds);

  if (error) {
    logger.error("rag.filename_lookup_failed", { org_id: orgId, error: error.message });
    return [];
  }

  const filenameById = new Map(
    (data as { id: string; filename: string }[]).map((d) => [d.id, d.filename]),
  );
  return chunks.flatMap((c) => {
    const filename = filenameById.get(c.documentId);
    return filename ? [{ ...c, filename }] : [];
  });
}

/**
 * Build the (deterministic) Claude request for a question + its grounding
 * chunks. Prompt caching is wired from day one: a breakpoint on the system
 * prompt and one on the context block. Note the Opus 4.8 minimum cacheable
 * prefix is 4096 tokens, so short single-shot prompts may not register a cache
 * read yet — the payoff grows with large contexts and Day-29 multi-turn history.
 */
export function buildRagRequest(
  question: string,
  chunks: GroundingChunk[],
): MessageCreateParamsNonStreaming {
  const system: TextBlockParam[] = [
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  ];

  return {
    model: DEFAULT_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildContextBlock(chunks),
            cache_control: { type: "ephemeral" },
          },
          { type: "text", text: `Question: ${question}` },
        ],
      },
    ],
  };
}

/**
 * Answer `question` for `orgId` strictly from that org's uploaded documents.
 * Retrieval and the filename join both run through the RLS user-session client,
 * so tenancy is enforced by the database, not by this code.
 */
export async function answerQuestion(
  orgId: string,
  question: string,
  options: AnswerOptions = {},
): Promise<RagAnswer> {
  const grounded = await retrieveGroundingChunks(orgId, question, options);
  if (grounded.length === 0) {
    return { answer: NO_CONTEXT_ANSWER, citations: [], grounded: false, usage: null };
  }

  const response = await anthropic.messages.create(buildRagRequest(question, grounded));

  if (response.stop_reason === "refusal") {
    logger.warn("rag.answer_refused", { org_id: orgId });
    return {
      answer: "I can't help with that request.",
      citations: [],
      grounded: false,
      usage: response.usage,
    };
  }

  const answer = response.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return {
    answer: answer || NO_CONTEXT_ANSWER,
    citations: buildCitations(grounded),
    grounded: true,
    usage: response.usage,
  };
}
