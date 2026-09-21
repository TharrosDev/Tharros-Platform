import "server-only";

import type {
  MessageCreateParamsNonStreaming,
  MessageParam,
  OutputConfig,
  TextBlockParam,
  Usage,
} from "@anthropic-ai/sdk/resources/messages";

import { anthropic, CHEAP_MODEL, DEFAULT_MODEL } from "@/lib/anthropic/client";
import { buildRewriteRequest } from "@/lib/assistant/history";
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
  /** Max chunks to retrieve (RPC clamps to 1..50). Default 4 (Day-34 eval:
   * fewer chunks → less tangential context → better "I don't know" behavior on
   * out-of-corpus questions, with no recall loss; also cheaper). */
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
  const chunks = await searchChunks(orgId, question, { limit: options.limit ?? 4 });
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
export type RagRequestOptions = {
  /** Override the grounding system prompt (Day 31 generation templates). Defaults to `SYSTEM_PROMPT`. */
  systemPrompt?: string;
  /** Label the user turn carries (Day 31 templates use "Task" instead of "Question"). */
  instructionLabel?: string;
  /**
   * Override the Claude model (Day 33 routing). Defaults to `DEFAULT_MODEL`
   * (Sonnet 5). Templates pass `CHEAP_MODEL` (Haiku). Caching breakpoints are
   * unchanged — Haiku's minimum cacheable prefix is no larger.
   */
  model?: string;
  /**
   * Reasoning effort for the default (highest) tier. Defaults to `"high"` — the
   * "Sonnet at high effort" the customer-facing path runs at. Pass `null` to omit
   * it entirely, which the cheap template path does so Haiku stays cheap.
   */
  effort?: OutputConfig["effort"] | null;
  /** Prior conversation turns (from `buildHistory`), sent before this turn's sources + question. */
  history?: MessageParam[];
};

export function buildRagRequest(
  instruction: string,
  chunks: GroundingChunk[],
  options: RagRequestOptions = {},
): MessageCreateParamsNonStreaming {
  const {
    systemPrompt = SYSTEM_PROMPT,
    instructionLabel = "Question",
    model = DEFAULT_MODEL,
    effort = "high",
    history = [],
  } = options;
  const system: TextBlockParam[] = [
    { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
  ];

  return {
    model,
    max_tokens: 16000,
    // Haiku 4.5 supports neither adaptive thinking nor effort.
    ...(model === CHEAP_MODEL ? {} : { thinking: { type: "adaptive" as const } }),
    // High reasoning effort on the default (Sonnet) tier; omitted for the cheap
    // template path (effort: null) so Haiku stays inexpensive.
    ...(effort && model !== CHEAP_MODEL ? { output_config: { effort } } : {}),
    system,
    messages: [
      // Cache breakpoint on the last history turn so the growing prefix is reused
      // turn over turn (system + history + context = 3 of the 4 allowed breakpoints).
      ...history.map((m, i) =>
        i === history.length - 1
          ? {
              role: m.role,
              content: [
                {
                  type: "text" as const,
                  text: m.content as string,
                  cache_control: { type: "ephemeral" as const },
                },
              ],
            }
          : m,
      ),
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildContextBlock(chunks),
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            // With history, a bare "Question:" after SOURCES gets read as source
            // text (and ignored as untrusted), so the model re-answers the earlier
            // turn. Label the latest message explicitly; single-turn is unchanged.
            text:
              history.length > 0
                ? `${instructionLabel} (the user's latest message, not part of the SOURCES; answer this, earlier turns are context only): ${instruction}`
                : `${instructionLabel}: ${instruction}`,
          },
        ],
      },
    ],
  };
}

/**
 * Rewrite a follow-up into a standalone retrieval query using the conversation.
 * First turn (no history) skips the call. Any failure falls back to the raw
 * question — retrieval quality degrades, the answer path never breaks.
 */
export async function standaloneQuery(history: MessageParam[], question: string): Promise<string> {
  if (history.length === 0) return question;
  try {
    const res = await anthropic.messages.create(
      buildRewriteRequest(history, question, CHEAP_MODEL),
    );
    const text = res.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text && res.stop_reason === "end_turn" ? text : question;
  } catch (err) {
    logger.warn("rag.rewrite_failed", { err });
    return question;
  }
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
