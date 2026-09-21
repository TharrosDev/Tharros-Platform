import Anthropic from "@anthropic-ai/sdk";
import type { Usage } from "@anthropic-ai/sdk/resources/messages";

import { getAuthUser } from "@/lib/auth/current-user";
import { getOrgContext } from "@/lib/org/queries";
import { createClient } from "@/lib/supabase/server";
import { anthropic, modelForTemplate } from "@/lib/anthropic/client";
import { checkQueryCap, recordUsage } from "@/lib/billing/usage";
import { buildRagRequest, retrieveGroundingChunks, standaloneQuery } from "@/lib/documents/rag";
import { buildCitations, NO_CONTEXT_ANSWER } from "@/lib/documents/rag-prompt";
import {
  appendMessage,
  conversationTitle,
  createConversation,
  getConversationMessages,
  touchConversation,
} from "@/lib/assistant/conversations";
import { buildHistory } from "@/lib/assistant/history";
import { encodeFrame, type ChatStreamEvent } from "@/lib/assistant/stream-protocol";
import {
  isTemplateId,
  TEMPLATES,
  templateSystemPrompt,
  type TemplateId,
} from "@/lib/assistant/templates";
import { logger } from "@/lib/observability/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSameOriginMutation, opaqueRateLimitKey, readJsonBody } from "@/lib/security/request";

// Node runtime: the RAG pipeline transitively uses the embeddings seam + the
// Anthropic SDK, and we hold a streaming response open — Node, not Edge.
export const runtime = "nodejs";

const MAX_QUESTION_LENGTH = 2000;
const MAX_BODY_BYTES = 16 * 1024;
const REFUSAL_ANSWER = "I can't help with that request.";

/**
 * Day 29 — streaming RAG chat endpoint. Persists the turn (per org/user) and
 * streams the answer as NDJSON (see `lib/assistant/stream-protocol`). Body:
 * `{ question, conversationId?, template? }`. A new conversation is created on
 * the first turn; its id comes back in the `meta` frame so the client can route
 * to it. Day 31: an optional `template` swaps the grounding system prompt for a
 * deliverable-shaped one (draft email / write SOP / summarize policy).
 */
export async function POST(req: Request): Promise<Response> {
  if (!isSameOriginMutation(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { activeOrg } = await getOrgContext();
  if (!activeOrg) {
    return Response.json({ error: "No active organization" }, { status: 403 });
  }

  const [userBurst, orgBurst] = await Promise.all([
    checkRateLimit(opaqueRateLimitKey("assistant-user", activeOrg.id, user.id), 30, 60, {
      failOpen: false,
    }),
    checkRateLimit(opaqueRateLimitKey("assistant-org", activeOrg.id), 180, 60, { failOpen: false }),
  ]);
  if (!userBurst.allowed || !orgBurst.allowed) {
    return Response.json(
      { error: "Too many assistant requests. Please try again shortly.", code: "rate_limit" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // Day 33 — plan cap. Hard-block once the org hits its tier's monthly query
  // limit, before any retrieval or generation spend. The (subscribed) layout has
  // already ensured an active/trialing subscription.
  const cap = await checkQueryCap(activeOrg.id);
  if (!cap.allowed) {
    return Response.json(
      {
        error: "You've reached this month's AI query limit. Upgrade your plan to continue.",
        code: "usage_cap",
        used: cap.used,
        cap: cap.cap,
      },
      { status: 429 },
    );
  }

  type QueryBody = { question?: unknown; conversationId?: unknown; template?: unknown };
  const bodyResult = await readJsonBody<QueryBody>(req, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    return Response.json(
      {
        error:
          bodyResult.reason === "too_large" ? "Request body is too large" : "Invalid JSON body",
      },
      { status: bodyResult.reason === "too_large" ? 413 : 400 },
    );
  }
  const body = bodyResult.value;

  const question = body.question;
  if (typeof question !== "string" || question.trim().length === 0) {
    return Response.json({ error: "A non-empty 'question' is required" }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return Response.json({ error: "Question is too long" }, { status: 400 });
  }
  const conversationIdInput =
    typeof body.conversationId === "string" && body.conversationId ? body.conversationId : null;

  // Optional Day-31 generation template. Absent → plain Q&A. Reject unknown ids
  // rather than silently falling back, so a typo surfaces instead of misbehaving.
  let template: TemplateId | null = null;
  if (body.template !== undefined && body.template !== null) {
    if (!isTemplateId(body.template)) {
      return Response.json({ error: "Unknown template" }, { status: 400 });
    }
    template = body.template;
  }

  // One client for the whole request — built here in request scope and reused
  // inside the stream so we never call cookies() after the response is returned.
  const supabase = await createClient();
  const orgId = activeOrg.id;

  // Resolve (or create) the conversation, then persist the user turn up front —
  // a failure here is a clean HTTP error before any streaming begins.
  let conversationId = conversationIdInput;
  if (!conversationId) {
    const templateLabel = template ? TEMPLATES.find((t) => t.id === template)?.label : null;
    conversationId = await createConversation(supabase, {
      orgId,
      userId: user.id,
      title: conversationTitle(templateLabel ? `${templateLabel}: ${question}` : question),
    });
  }
  if (!conversationId) {
    return Response.json({ error: "Couldn't start the conversation." }, { status: 500 });
  }

  // Prior turns, read before appending this one. RLS scopes the read; a thread
  // the caller can't see yields [] and the append below rejects it anyway.
  const history = conversationIdInput
    ? buildHistory((await getConversationMessages(conversationId)).messages)
    : [];

  const userMessageId = await appendMessage(supabase, {
    conversationId,
    orgId,
    role: "user",
    content: question.trim(),
  });
  if (!userMessageId) {
    // RLS rejects appending to a thread that isn't the caller's own, or the
    // conversation id was bogus — treat as forbidden rather than a 500.
    return Response.json({ error: "Couldn't post to this conversation." }, { status: 403 });
  }

  // Retrieve grounding before opening the stream so the `meta` frame can carry
  // citations immediately and a retrieval failure is still a graceful empty set.
  // Follow-ups ("what about part-timers?") retrieve on a standalone rewrite.
  // ponytail: the ~200-token Haiku rewrite isn't metered — each ai_usage_events
  // row counts as one query toward the plan cap, so a row here would double-bill.
  const retrievalQuery = await standaloneQuery(history, question);
  const grounded = await retrieveGroundingChunks(orgId, retrievalQuery);
  const citations = buildCitations(grounded);
  const finalConversationId = conversationId;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) =>
        controller.enqueue(encoder.encode(encodeFrame(event)));

      try {
        send({
          type: "meta",
          conversationId: finalConversationId,
          citations,
          grounded: grounded.length > 0,
        });

        let answer = "";
        let usage: Usage | null = null;
        // Day 33 — route the structured generation templates to the cheaper
        // model; open-ended grounded Q&A runs the default tier (Sonnet, high effort).
        const model = modelForTemplate(template);

        if (grounded.length === 0) {
          answer = NO_CONTEXT_ANSWER;
          send({ type: "delta", text: answer });
        } else {
          const claudeStream = anthropic.messages.stream(
            template
              ? buildRagRequest(question, grounded, {
                  systemPrompt: templateSystemPrompt(template),
                  instructionLabel: "Task",
                  model,
                  // Cheap template path (Haiku) — skip the high-effort config.
                  effort: null,
                  history,
                })
              : buildRagRequest(question, grounded, { model, history }),
          );
          for await (const event of claudeStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              answer += event.delta.text;
              send({ type: "delta", text: event.delta.text });
            }
          }
          const finalMessage = await claudeStream.finalMessage();
          usage = finalMessage.usage;
          if (finalMessage.stop_reason === "refusal") {
            logger.warn("assistant.answer_refused", { org_id: orgId });
            answer = REFUSAL_ANSWER;
            // Overwrite the streamed text on the client with the refusal line.
            send({ type: "delta", text: answer });
          }
        }

        const refused = grounded.length > 0 && answer === REFUSAL_ANSWER;
        await appendMessage(supabase, {
          conversationId: finalConversationId,
          orgId,
          role: "assistant",
          content: answer,
          citations: refused ? [] : citations,
          usage,
        });
        await touchConversation(supabase, finalConversationId);

        // Day 33 — meter the spend (best-effort; skips the no-context path where
        // usage is null). Counts toward the org's monthly cap.
        await recordUsage(orgId, user.id, model, usage);

        send({ type: "done" });
        controller.close();
      } catch (err) {
        // A rate limit the SDK couldn't retry away surfaces as a 429/529 — tell
        // the user it's transient rather than implying their answer failed.
        if (err instanceof Anthropic.APIError && (err.status === 429 || err.status === 529)) {
          logger.warn("assistant.rate_limited", { org_id: orgId, status: err.status });
          send({
            type: "error",
            message: "The assistant is busy right now. Please try again in a moment.",
          });
        } else {
          logger.error("assistant.stream_failed", { org_id: orgId, err });
          send({ type: "error", message: "Couldn't generate an answer. Please try again." });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
