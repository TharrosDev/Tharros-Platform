import { getAuthUser } from "@/lib/auth/current-user";
import { getOrgContext } from "@/lib/org/queries";
import { answerQuestion } from "@/lib/documents/rag";
import { logger } from "@/lib/observability/logger";

// Node runtime: the RAG pipeline transitively uses the embeddings seam +
// Anthropic SDK, which expect Node, not Edge.
export const runtime = "nodejs";

const MAX_QUESTION_LENGTH = 2000;

/**
 * Day 28 — RAG query endpoint. Authorizes via the user session, resolves the
 * active org, and answers the question strictly from that org's documents.
 * Returns JSON for now; Day 29 swaps this to a streaming response + chat UI.
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

  let question: unknown;
  try {
    ({ question } = (await req.json()) as { question?: unknown });
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof question !== "string" || question.trim().length === 0) {
    return Response.json({ error: "A non-empty 'question' is required" }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return Response.json({ error: "Question is too long" }, { status: 400 });
  }

  try {
    const result = await answerQuestion(activeOrg.id, question);
    return Response.json({
      answer: result.answer,
      citations: result.citations,
      grounded: result.grounded,
      usage: result.usage,
    });
  } catch (err) {
    logger.error("assistant.query_failed", { org_id: activeOrg.id, err });
    return Response.json({ error: "Couldn't generate an answer. Please try again." }, { status: 500 });
  }
}
