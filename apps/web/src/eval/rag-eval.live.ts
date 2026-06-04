import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import { chunkText, type ChunkOptions } from "@/lib/documents/chunk";
import {
  buildCitations,
  buildContextBlock,
  SYSTEM_PROMPT,
  type GroundingChunk,
} from "@/lib/documents/rag-prompt";
import {
  citationSetMatch,
  citedDocsFromIndices,
  factHitRate,
  jaccard,
  mean,
  negativeHandled,
  parseCitationIndices,
  precision,
  recall,
  reciprocalRank,
} from "./metrics";
import { EVAL_QUESTIONS } from "./questions";

/**
 * Day 34 — RAG quality eval harness. NOT part of the default suite (excluded via
 * `**​/*.live.ts` and run only through `vitest.eval.config.ts` / `pnpm eval`).
 * Needs OPENAI_API_KEY + ANTHROPIC_API_KEY; self-skips otherwise so CI never
 * runs it.
 *
 * It reuses the real pure pipeline pieces — `chunkText`, `buildContextBlock`,
 * `buildCitations`, `SYSTEM_PROMPT` — and calls OpenAI/Anthropic directly
 * (the seam modules carry `server-only` and can't be imported here). Retrieval
 * is in-process cosine ranking, which equals the `match_document_chunks` cosine
 * metric at fixture scale. Two-tier to bound cost: cheap retrieval metrics
 * (embeddings only) across the full chunk×k sweep, then the expensive
 * answer+judge eval (Opus answers, Haiku faithfulness judge) on the baseline +
 * the retrieval winner.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const EMBEDDING_MODEL = "text-embedding-3-small";
// Mirror the shipping config: the default tier is Sonnet 4.6 at high effort.
const ANSWER_MODEL = "claude-sonnet-4-6";
const JUDGE_MODEL = "claude-haiku-4-5";

const CHUNK_CONFIGS: { label: string; opts: ChunkOptions }[] = [
  { label: "300/60", opts: { maxTokens: 300, overlapTokens: 60 } },
  { label: "500/80", opts: { maxTokens: 500, overlapTokens: 80 } }, // baseline
  { label: "800/120", opts: { maxTokens: 800, overlapTokens: 120 } },
];
const TOP_KS = [4, 6, 8];
// Shipping default after the Day-34 tuning: 500/80 chunks, top-k 4.
const BASELINE = { chunk: "500/80", k: 4 };

const fixturesDir = fileURLToPath(new URL("./fixtures", import.meta.url));
const resultsDir = fileURLToPath(new URL("./results", import.meta.url));

type EmbeddedChunk = { filename: string; chunkIndex: number; content: string; vector: number[] };

async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const batch = texts.slice(i, i + 64);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
    });
    if (!res.ok) throw new Error(`OpenAI embeddings failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    out.push(...json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
  }
  return out;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Top-k chunks for a query vector → GroundingChunk[] (mirrors retrieveGroundingChunks). */
function retrieve(queryVec: number[], chunks: EmbeddedChunk[], k: number): GroundingChunk[] {
  return chunks
    .map((c) => ({ c, similarity: cosine(queryVec, c.vector) }))
    .sort((x, y) => y.similarity - x.similarity)
    .slice(0, k)
    .map(({ c, similarity }) => ({
      id: `${c.filename}#${c.chunkIndex}`,
      documentId: c.filename,
      chunkIndex: c.chunkIndex,
      content: c.content,
      similarity,
      filename: c.filename,
    }));
}

const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY, maxRetries: 4 }) : null;

/** Replicate buildRagRequest's assembly (can't import rag.ts — server-only). */
async function answer(question: string, grounded: GroundingChunk[]): Promise<string> {
  const res = await anthropic!.messages.create({
    model: ANSWER_MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildContextBlock(grounded), cache_control: { type: "ephemeral" } },
          { type: "text", text: `Question: ${question}` },
        ],
      },
    ],
  });
  return res.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Haiku faithfulness judge: 0..1 how well the answer is supported by the sources. */
async function judge(contextBlock: string, answerText: string): Promise<number> {
  const res = await anthropic!.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 100,
    system: [
      {
        type: "text",
        text:
          "You are a strict grader. Score how well the ANSWER is supported by the SOURCES. " +
          "1 = every factual claim is directly supported; 0 = the answer asserts facts not in the sources. " +
          'Declining to answer when the sources lack the info scores 1. Respond with ONLY JSON: {"score": <number 0..1>}.',
      },
    ],
    messages: [{ role: "user", content: `SOURCES:\n${contextBlock}\n\nANSWER:\n${answerText}` }],
  });
  const text = res.content.find((b) => b.type === "text");
  const m = text && "text" in text ? text.text.match(/\{[^}]*\}/) : null;
  if (!m) return 0;
  try {
    const score = Number((JSON.parse(m[0]) as { score?: unknown }).score);
    return Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0;
  } catch {
    return 0;
  }
}

describe.skipIf(!OPENAI_API_KEY || !ANTHROPIC_API_KEY)("RAG quality eval", () => {
  it(
    "sweeps chunk size × top-k, runs answer+judge on baseline + winner, writes results",
    async () => {
      // 1. Load fixtures.
      const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".md"));
      const docs = files.map((filename) => ({
        filename,
        text: readFileSync(`${fixturesDir}/${filename}`, "utf8"),
      }));
      const questions = EVAL_QUESTIONS;

      // 2. Embed each chunk config's corpus once; embed questions once (shared).
      const questionVecs = await embedTexts(questions.map((q) => q.question));
      const embeddedByConfig = new Map<string, EmbeddedChunk[]>();
      for (const cfg of CHUNK_CONFIGS) {
        const flat: { filename: string; chunkIndex: number; content: string }[] = [];
        for (const d of docs) {
          for (const ch of chunkText(d.text, cfg.opts)) {
            flat.push({ filename: d.filename, chunkIndex: ch.index, content: ch.content });
          }
        }
        const vecs = await embedTexts(flat.map((c) => c.content));
        embeddedByConfig.set(
          cfg.label,
          flat.map((c, i) => ({ ...c, vector: vecs[i] })),
        );
      }

      // 3. Retrieval sweep (embeddings only — cheap).
      type RetrievalRow = { chunk: string; k: number; recall: number; precision: number; mrr: number };
      const retrievalRows: RetrievalRow[] = [];
      for (const cfg of CHUNK_CONFIGS) {
        const chunks = embeddedByConfig.get(cfg.label)!;
        for (const k of TOP_KS) {
          const recalls: number[] = [];
          const precisions: number[] = [];
          const mrrs: number[] = [];
          questions.forEach((q, qi) => {
            if (q.negative) return; // retrieval recall is undefined for negatives
            const grounded = retrieve(questionVecs[qi], chunks, k);
            const retrievedDocs = [...new Set(grounded.map((g) => g.filename))];
            recalls.push(recall(retrievedDocs, q.expectedDocs));
            precisions.push(precision(retrievedDocs, q.expectedDocs));
            mrrs.push(reciprocalRank(retrievedDocs, q.expectedDocs));
          });
          retrievalRows.push({
            chunk: cfg.label,
            k,
            recall: mean(recalls),
            precision: mean(precisions),
            mrr: mean(mrrs),
          });
        }
      }

      // 4. Pick the retrieval winner: max recall, then MRR, then fewer-k/cheaper.
      const winner = [...retrievalRows].sort(
        (a, b) => b.recall - a.recall || b.mrr - a.mrr || a.k - b.k,
      )[0];
      const baselineRow = retrievalRows.find((r) => r.chunk === BASELINE.chunk && r.k === BASELINE.k)!;
      const answerConfigs = [
        { chunk: BASELINE.chunk, k: BASELINE.k, tag: "baseline" },
        ...(winner.chunk === BASELINE.chunk && winner.k === BASELINE.k
          ? []
          : [{ chunk: winner.chunk, k: winner.k, tag: "winner" }]),
      ];

      // 5. Answer + judge eval on the chosen configs (Opus answers, Haiku judge).
      type AnswerRow = {
        tag: string;
        chunk: string;
        k: number;
        citationAccuracy: number;
        citationJaccard: number;
        citeCoverage: number;
        factHit: number;
        faithfulness: number;
        negativeHandled: number;
      };
      const answerRows: AnswerRow[] = [];
      const perQuestionLog: string[] = [];

      for (const ac of answerConfigs) {
        const chunks = embeddedByConfig.get(ac.chunk)!;
        const citAcc: number[] = [];
        const citJac: number[] = [];
        const coverage: number[] = [];
        const facts: number[] = [];
        const faith: number[] = [];
        const negs: number[] = [];

        for (let qi = 0; qi < questions.length; qi++) {
          const q = questions[qi];
          const grounded = retrieve(questionVecs[qi], chunks, ac.k);
          const citations = buildCitations(grounded);
          const contextBlock = buildContextBlock(grounded);
          const ans = await answer(q.question, grounded);
          const citedDocs = citedDocsFromIndices(parseCitationIndices(ans), citations);

          if (q.negative) {
            negs.push(negativeHandled(ans, citedDocs.length) ? 1 : 0);
          } else {
            citAcc.push(citationSetMatch(citedDocs, q.expectedDocs));
            citJac.push(jaccard(citedDocs, q.expectedDocs));
            coverage.push(citedDocs.length > 0 ? 1 : 0);
            facts.push(factHitRate(ans, q.expectedFacts));
            faith.push(await judge(contextBlock, ans));
          }
          if (ac.tag === "baseline") {
            perQuestionLog.push(
              `- **${q.id}** (${q.negative ? "neg" : q.expectedDocs.join(",")}) → cited [${citedDocs.join(", ")}]`,
            );
          }
        }

        answerRows.push({
          tag: ac.tag,
          chunk: ac.chunk,
          k: ac.k,
          citationAccuracy: mean(citAcc),
          citationJaccard: mean(citJac),
          citeCoverage: mean(coverage),
          factHit: mean(facts),
          faithfulness: mean(faith),
          negativeHandled: mean(negs),
        });
      }

      // 6. Write the results artifact.
      const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
      const num = (n: number) => n.toFixed(2);
      const lines: string[] = [];
      lines.push("# RAG Eval Results");
      lines.push("");
      lines.push(`Corpus: ${docs.length} fixtures · ${questions.length} questions (${questions.filter((q) => q.negative).length} negatives).`);
      lines.push(`Embeddings: ${EMBEDDING_MODEL}. Answers: ${ANSWER_MODEL}. Judge: ${JUDGE_MODEL}.`);
      lines.push("");
      lines.push("## Retrieval sweep (chunk × top-k)");
      lines.push("");
      lines.push("| chunk | k | recall | precision | MRR |");
      lines.push("| --- | --- | --- | --- | --- |");
      for (const r of retrievalRows) {
        lines.push(`| ${r.chunk} | ${r.k} | ${pct(r.recall)} | ${pct(r.precision)} | ${num(r.mrr)} |`);
      }
      lines.push("");
      lines.push(`**Retrieval winner:** chunk ${winner.chunk}, k=${winner.k} (recall ${pct(winner.recall)}, MRR ${num(winner.mrr)}). Baseline ${BASELINE.chunk}/k${BASELINE.k}: recall ${pct(baselineRow.recall)}, MRR ${num(baselineRow.mrr)}.`);
      lines.push("");
      lines.push("## Answer quality (baseline + winner)");
      lines.push("");
      lines.push("| config | chunk | k | citation acc | cite jaccard | cite coverage | fact-hit | faithfulness | negatives handled |");
      lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
      for (const r of answerRows) {
        lines.push(
          `| ${r.tag} | ${r.chunk} | ${r.k} | ${pct(r.citationAccuracy)} | ${num(r.citationJaccard)} | ${pct(r.citeCoverage)} | ${pct(r.factHit)} | ${num(r.faithfulness)} | ${pct(r.negativeHandled)} |`,
        );
      }
      lines.push("");
      lines.push("## Baseline per-question citations");
      lines.push("");
      lines.push(...perQuestionLog);
      lines.push("");

      mkdirSync(resultsDir, { recursive: true });
      writeFileSync(`${resultsDir}/latest.md`, lines.join("\n"));
      console.log("\n" + lines.join("\n") + "\n");

      // 7. Soft gates on the baseline answer config (regression guard when run).
      const base = answerRows.find((r) => r.tag === "baseline")!;
      expect(baselineRow.recall, "baseline recall").toBeGreaterThanOrEqual(0.8);
      expect(base.citationAccuracy, "baseline citation accuracy").toBeGreaterThanOrEqual(0.8);
      expect(base.citeCoverage, "baseline cite coverage").toBeGreaterThanOrEqual(0.9);
      // Negatives are a small (4-item) set, so the per-item granularity is coarse
      // and LLM-noisy; floor the gate at "majority handled" (catches regression to
      // the pre-tuning ~25% state) rather than the exact run value.
      expect(base.negativeHandled, "baseline negatives handled").toBeGreaterThanOrEqual(0.5);
    },
    900_000,
  );
});
