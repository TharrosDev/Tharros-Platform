import { getAuthUser } from "@/lib/auth/current-user";
import { getOrgContext } from "@/lib/org/queries";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/anthropic/client";
import { buildRagRequest, retrieveGroundingChunks } from "@/lib/documents/rag";
import { buildCitations, NO_CONTEXT_ANSWER } from "@/lib/documents/rag-prompt";
import {
  appendMessage,
  conversationTitle,
  createConversation,
  touchConversation,
} from "@/lib/assistant/conversations";
import { encodeFrame, type ChatStreamEvent } from "@/lib/assistant/stream-protocol";
import {
  isTemplateId,
  TEMPLATES,
  templateSystemPrompt,
  type TemplateId,
} from "@/lib/assistant/templates";
import { logger } from "@/lib/observability/logger";

// Node runtime: the RAG pipeline transitively uses the embeddings seam + the
// Anthropic SDK, and we hold a streaming response open — Node, not Edge.
export const runtime = "nodejs";

const MAX_QUESTION_LENGTH = 2000;
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
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { activeOrg } = await getOrgContext();
  if (!activeOrg) {
    return Response.json({ error: "No active organization" }, { status: 403 });
  }

  let body: { question?: unknown; conversationId?: unknown; template?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

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
  const grounded = await retrieveGroundingChunks(orgId, question);
  const citations = buildCitations(grounded);
  const finalConversationId = conversationId;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) =>
        controller.enqueue(encoder.encode(encodeFrame(event)));

      try {
        send({ type: "meta", conversationId: finalConversationId, citations, grounded: grounded.length > 0 });

        let answer = "";
        let usage: unknown = null;

        if (grounded.length === 0) {
          answer = NO_CONTEXT_ANSWER;
          send({ type: "delta", text: answer });
        } else {
          const claudeStream = anthropic.messages.stream(
            template
              ? buildRagRequest(question, grounded, {
                  systemPrompt: templateSystemPrompt(template),
                  instructionLabel: "Task",
                })
              : buildRagRequest(question, grounded),
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

        send({ type: "done" });
        controller.close();
      } catch (err) {
        logger.error("assistant.stream_failed", { org_id: orgId, err });
        send({ type: "error", message: "Couldn't generate an answer. Please try again." });
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
