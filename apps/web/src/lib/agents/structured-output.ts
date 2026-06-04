/**
 * Day 39 — structured-output harness. Coerces Claude into a validated JSON object
 * using the forced-tool pattern: a single `record_output` tool whose input_schema
 * is the zod schema, with `tool_choice` forcing Claude to call it. The tool's
 * `input` is zod-validated; on a validation miss the error is fed back as a
 * correction turn and the call retried, up to `maxRetries`.
 *
 * Pure (no `server-only`): the Anthropic client is injected, so this is
 * unit-testable with a fake. The server-only callers pass the real `anthropic`
 * seam + a usage recorder.
 *
 * NOTE: forced `tool_choice` is incompatible with extended thinking, so this path
 * deliberately omits `thinking` (unlike the conversational turn loop, which keeps
 * adaptive thinking under auto tool_choice).
 */

import { z } from "zod";
import type { Message, Tool, Usage } from "@anthropic-ai/sdk/resources/messages";

import { DEFAULT_MODEL } from "@/lib/anthropic/models";

export class StructuredOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StructuredOutputError";
  }
}

/** The minimal Anthropic surface this harness needs (the real SDK satisfies it). */
export type StructuredAnthropic = {
  messages: { create(req: Record<string, unknown>): Promise<Message> };
};

export type GenerateStructuredArgs<T> = {
  anthropic: StructuredAnthropic;
  schema: z.ZodType<T>;
  /** System prompt establishing the task. */
  system: string;
  /** The user content describing what to produce. */
  userContent: string;
  toolName?: string;
  toolDescription?: string;
  model?: string;
  maxTokens?: number;
  /** Retries after the first attempt on a schema-validation miss. Default 2. */
  maxRetries?: number;
  /** Called after every model call with its usage (metering seam). */
  onUsage?: (model: string, usage: Usage | null) => void | Promise<void>;
};

export type GenerateStructuredResult<T> = {
  data: T;
  usage: Usage | null;
  /** How many model calls it took (1 = first attempt succeeded). */
  attempts: number;
};

export async function generateStructured<T>(
  args: GenerateStructuredArgs<T>,
): Promise<GenerateStructuredResult<T>> {
  const toolName = args.toolName ?? "record_output";
  const maxRetries = args.maxRetries ?? 2;
  const tool: Tool = {
    name: toolName,
    description:
      args.toolDescription ?? "Return the result strictly as structured JSON via this tool.",
    // zod v4 ships JSON Schema generation; the shape satisfies Anthropic's input_schema.
    input_schema: z.toJSONSchema(args.schema) as Tool["input_schema"],
  };

  const messages: Array<Record<string, unknown>> = [
    { role: "user", content: args.userContent },
  ];

  let lastError = "no response";

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const resp = await args.anthropic.messages.create({
      model: args.model ?? DEFAULT_MODEL,
      max_tokens: args.maxTokens ?? 4096,
      system: args.system,
      messages,
      tools: [tool],
      tool_choice: { type: "tool", name: toolName },
    });
    await args.onUsage?.(resp.model, resp.usage);

    const block = resp.content.find(
      (b): b is Extract<typeof b, { type: "tool_use" }> =>
        b.type === "tool_use" && b.name === toolName,
    );

    const parsed = args.schema.safeParse(block?.input);
    if (parsed.success) {
      return { data: parsed.data, usage: resp.usage, attempts: attempt };
    }

    lastError = z.prettifyError(parsed.error);
    // Feed the failure back and let Claude correct it on the next attempt.
    messages.push({ role: "assistant", content: resp.content });
    messages.push({
      role: "user",
      content: `Your previous ${toolName} call did not match the required schema:\n${lastError}\n\nCall ${toolName} again with corrected values.`,
    });
  }

  throw new StructuredOutputError(
    `structured output failed validation after ${maxRetries + 1} attempts: ${lastError}`,
  );
}
