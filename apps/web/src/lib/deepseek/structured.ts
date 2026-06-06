/**
 * Day 45 — DeepSeek structured-output harness. Coerces a DeepSeek model into a
 * zod-validated object: a single `record_output` function tool whose `parameters`
 * is the zod schema. The returned arguments are JSON-parsed + zod-validated; on a
 * miss (no tool call, bad JSON, or schema violation) the error is fed back as a
 * correction turn and the call retried, up to `maxRetries`.
 *
 * This is the DeepSeek counterpart to `lib/agents/structured-output.ts` (Claude),
 * kept OpenAI-shaped because DeepSeek speaks the OpenAI Chat Completions dialect.
 * Pure (no `server-only`): the chat-completion fn is injected, so it's unit-
 * testable with a fake. The server-only caller passes the real `chatCompletion`
 * seam (`lib/deepseek/client`) + a usage recorder.
 *
 * `tool_choice` is `"auto"`, NOT a forced specific function: DeepSeek's default
 * thinking mode rejects forcing a named tool ("Thinking mode does not support this
 * tool_choice"). With a single tool + a task-shaped prompt the model reliably
 * calls it; if it ever answers in text instead, that's treated as a miss and the
 * retry loop nudges it. Correction turns are appended as plain `user` messages.
 */

import { z } from "zod";

export class DeepSeekStructuredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeepSeekStructuredError";
  }
}

/** DeepSeek/OpenAI usage block (token accounting differs from Anthropic's). */
export type DeepSeekUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  /** Tokens served from the context cache (billed at the cache-hit rate). */
  prompt_cache_hit_tokens?: number;
  /** Tokens NOT served from cache (billed at the input rate). */
  prompt_cache_miss_tokens?: number;
};

type DeepSeekToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type DeepSeekChatResponse = {
  model?: string;
  choices: Array<{
    message: { content: string | null; tool_calls?: DeepSeekToolCall[] };
  }>;
  usage: DeepSeekUsage | null;
};

/** The injected chat-completion call (real = client.chatCompletion; tests = fake). */
export type DeepSeekChat = (req: Record<string, unknown>) => Promise<DeepSeekChatResponse>;

export type GenerateStructuredDeepSeekArgs<T> = {
  chat: DeepSeekChat;
  schema: z.ZodType<T>;
  /** System prompt establishing the task. */
  system: string;
  /** The user content describing what to produce. */
  userContent: string;
  toolName?: string;
  toolDescription?: string;
  model?: string;
  maxTokens?: number;
  /** Retries after the first attempt on a parse/validation miss. Default 2. */
  maxRetries?: number;
  /** Called after every model call with its usage (metering seam). */
  onUsage?: (model: string, usage: DeepSeekUsage | null) => void | Promise<void>;
};

export type GenerateStructuredDeepSeekResult<T> = {
  data: T;
  usage: DeepSeekUsage | null;
  /** How many model calls it took (1 = first attempt succeeded). */
  attempts: number;
};

const DEFAULT_MODEL = "deepseek-v4-flash";

export async function generateStructuredDeepSeek<T>(
  args: GenerateStructuredDeepSeekArgs<T>,
): Promise<GenerateStructuredDeepSeekResult<T>> {
  const toolName = args.toolName ?? "record_output";
  const maxRetries = args.maxRetries ?? 2;
  const model = args.model ?? DEFAULT_MODEL;

  const tool = {
    type: "function",
    function: {
      name: toolName,
      description:
        args.toolDescription ?? "Return the result strictly as structured JSON via this tool.",
      // zod v4 ships JSON Schema generation; the shape satisfies OpenAI's `parameters`.
      parameters: z.toJSONSchema(args.schema),
    },
  };

  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: args.system },
    { role: "user", content: args.userContent },
  ];

  let lastError = "no response";

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const resp = await args.chat({
      model,
      max_tokens: args.maxTokens ?? 4096,
      messages,
      tools: [tool],
      // "auto", not a forced named function — thinking mode rejects the latter.
      tool_choice: "auto",
    });
    await args.onUsage?.(resp.model ?? model, resp.usage);

    const call = resp.choices[0]?.message?.tool_calls?.find((c) => c.function.name === toolName);

    let value: unknown;
    let parseError: string | null = null;
    try {
      value = call ? JSON.parse(call.function.arguments) : undefined;
    } catch {
      parseError = `the ${toolName} arguments were not valid JSON`;
    }

    if (!parseError) {
      const parsed = args.schema.safeParse(value);
      if (parsed.success) {
        return { data: parsed.data, usage: resp.usage, attempts: attempt };
      }
      parseError = z.prettifyError(parsed.error);
    }

    lastError = parseError;
    // Feed the failure back and re-force the tool on the next attempt.
    messages.push({
      role: "user",
      content: `Your previous ${toolName} call did not match the required schema:\n${lastError}\n\nCall ${toolName} again with corrected values.`,
    });
  }

  throw new DeepSeekStructuredError(
    `structured output failed validation after ${maxRetries + 1} attempts: ${lastError}`,
  );
}
