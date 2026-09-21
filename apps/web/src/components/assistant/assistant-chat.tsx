"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  BookOpen,
  ArrowUpRight,
  Mail,
  ClipboardList,
  FileText,
  RefreshCw,
  X,
  Users,
  CalendarDays,
  Workflow,
} from "lucide-react";

import type { Citation } from "@/lib/documents/rag-prompt";
import type { ChatMessage } from "@/lib/assistant/types";
import type { ProductFeature } from "@/lib/billing/plans";
import { createFrameDecoder } from "@/lib/assistant/stream-protocol";
import { TEMPLATES, type TemplateId } from "@/lib/assistant/templates";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { FadeIn } from "@/components/motion";
import { ChatTurn } from "@/components/assistant/chat-message";
import { ChatComposer } from "@/components/assistant/chat-composer";

const TEMPLATE_ICONS: Record<TemplateId, React.ComponentType<{ className?: string }>> = {
  draft_email: Mail,
  write_sop: ClipboardList,
  summarize_policy: FileText,
};

/** Starter prompts per product; the empty state shows the ones on the org's plan. */
const EXAMPLE_PROMPTS: {
  product: ProductFeature;
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}[] = [
  { product: "assistant", icon: BookOpen, text: "What's our refund policy?" },
  { product: "assistant", icon: BookOpen, text: "Summarize our employee handbook." },
  { product: "leads", icon: Users, text: "Which new leads haven't been contacted yet?" },
  { product: "scheduling", icon: CalendarDays, text: "Who's working this weekend?" },
  { product: "scheduling", icon: CalendarDays, text: "Any pending time-off requests?" },
  { product: "automations", icon: Workflow, text: "Did any automations fail this week?" },
];

type Pending = { userId: string; assistantId: string };

/**
 * Day 29 — the assistant chat island. Owns the live thread for the selected
 * conversation: optimistic user turn, a streamed assistant turn read from the
 * NDJSON endpoint, citations, Stop (abort), and routing a brand-new conversation
 * to its own URL once it's persisted. The page keys this by the selected id, so
 * switching conversations remounts it cleanly from server-loaded messages.
 */
export function AssistantChat({
  selectedId,
  initialMessages,
  hasDocuments,
  readOnly = false,
  nearLimit = false,
  olderTruncated = false,
  products = [],
}: {
  /** Products on the org's plan: decides which live-data prompts to suggest. */
  products?: readonly ProductFeature[];
  selectedId: string | null;
  initialMessages: ChatMessage[];
  hasDocuments: boolean;
  readOnly?: boolean;
  /** Day 33 — org is at ≥80% of its monthly query cap; show a soft warning. */
  nearLimit?: boolean;
  /** Older turns exist beyond the loaded window (very long thread). */
  olderTruncated?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Day 33 — set when the API returns a usage-cap 429; swaps the warning for a
  // hard "upgrade to continue" banner.
  const [capReached, setCapReached] = React.useState(false);
  // Day 35 — the last thing we tried to send, so a failed answer can be retried.
  const [lastAttempt, setLastAttempt] = React.useState<{
    question: string;
    template: TemplateId | null;
  } | null>(null);
  const [activeTemplate, setActiveTemplate] = React.useState<TemplateId | null>(null);
  const activeMeta = activeTemplate ? TEMPLATES.find((t) => t.id === activeTemplate) : null;
  const pendingRef = React.useRef<Pending | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  // Turns loaded from the server render statically; only turns appended in
  // this session animate in. Captured once on mount.
  const [initialCount] = React.useState(initialMessages.length);

  // Keep the latest turn in view as content streams in.
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: streaming ? "auto" : "smooth", block: "end" });
  }, [messages, streaming]);

  const patch = React.useCallback((id: string, fn: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  const send = React.useCallback(
    async (question: string, templateArg?: TemplateId | null) => {
      if (streaming) return;
      setError(null);

      // Capture + clear the template mode for this turn; subsequent turns are
      // plain Q&A unless the user picks a template again. A retry passes the
      // original template explicitly (templateArg) so it isn't lost.
      const template = templateArg !== undefined ? templateArg : activeTemplate;
      setActiveTemplate(null);
      setLastAttempt({ question, template });

      const userId = crypto.randomUUID();
      const assistantId = crypto.randomUUID();
      pendingRef.current = { userId, assistantId };
      const now = new Date().toISOString();

      setMessages((prev) => [
        ...prev.map((m) => (m.suggestions ? { ...m, suggestions: undefined } : m)),
        { id: userId, role: "user", content: question, citations: [], createdAt: now },
        { id: assistantId, role: "assistant", content: "", citations: [], createdAt: now },
      ]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let newConversationId: string | null = null;
      let citations: Citation[] = [];

      try {
        const res = await fetch("/api/assistant/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            conversationId: selectedId ?? undefined,
            template: template ?? undefined,
          }),
          signal: controller.signal,
        });
        if (res.status === 429) {
          const data = (await res.json().catch(() => null)) as {
            code?: string;
            error?: string;
          } | null;
          if (data?.code === "usage_cap") {
            // Drop the optimistic turns — no answer is coming — and surface the
            // hard cap banner instead.
            setMessages((prev) => prev.filter((m) => m.id !== userId && m.id !== assistantId));
            setCapReached(true);
            setError(data.error ?? "You've reached this month's AI query limit.");
            return;
          }
        }
        if (!res.ok || !res.body) {
          throw new Error("request failed");
        }

        const reader = res.body.getReader();
        const textDecoder = new TextDecoder();
        const frames = createFrameDecoder();

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const event of frames.push(textDecoder.decode(value, { stream: true }))) {
            if (event.type === "meta") {
              citations = event.citations;
              if (!selectedId) newConversationId = event.conversationId;
            } else if (event.type === "delta") {
              patch(assistantId, (m) => ({
                ...m,
                content: m.content + event.text,
                statusLabel: undefined,
              }));
            } else if (event.type === "status") {
              patch(assistantId, (m) => ({
                ...m,
                statusLabel: event.label,
                steps: [...(m.steps ?? []), event.label],
              }));
            } else if (event.type === "data") {
              patch(assistantId, (m) => ({ ...m, data: [...(m.data ?? []), event.block] }));
            } else if (event.type === "suggestions") {
              patch(assistantId, (m) => ({ ...m, suggestions: event.items }));
            } else if (event.type === "proposal") {
              patch(assistantId, (m) => ({
                ...m,
                proposals: [...(m.proposals ?? []), event.proposal],
              }));
            } else if (event.type === "sources") {
              citations = event.citations;
              patch(assistantId, (m) => ({ ...m, citations }));
            } else if (event.type === "error") {
              throw new Error(event.message);
            } else if (event.type === "done") {
              patch(assistantId, (m) => ({
                ...m,
                citations,
                statusLabel: undefined,
                persistedId: event.messageId,
              }));
            }
          }
        }
      } catch {
        if (controller.signal.aborted) {
          // User pressed Stop: keep whatever streamed, attach any citations.
          patch(assistantId, (m) => ({ ...m, citations }));
        } else {
          // Drop the failed turn and surface a retryable error above the
          // composer (the user's question is preserved in `lastAttempt`).
          setMessages((prev) => prev.filter((m) => m.id !== userId && m.id !== assistantId));
          setError("Something went wrong generating that answer.");
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
        pendingRef.current = null;
        // A brand-new conversation now exists + is persisted: route to its URL so
        // it gets a shareable address and joins the history list.
        if (newConversationId) {
          router.replace(`/assistant?c=${newConversationId}`, { scroll: false });
        }
      }
    },
    [streaming, selectedId, patch, router, activeTemplate],
  );

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retry = React.useCallback(() => {
    if (!lastAttempt) return;
    setError(null);
    void send(lastAttempt.question, lastAttempt.template);
  }, [lastAttempt, send]);

  // Re-ask the latest question (keeps the earlier answer in the thread).
  const regenerate = React.useCallback(() => {
    const lastQuestion = [...messages].reverse().find((m) => m.role === "user");
    if (lastQuestion) void send(lastQuestion.content);
  }, [messages, send]);

  const showEmpty = messages.length === 0 && !streaming;

  return (
    <div className="relative flex min-h-[calc(100dvh-13rem)] flex-col">
      <div className="flex-1">
        {showEmpty ? (
          <EmptyState
            hasDocuments={hasDocuments}
            onPick={send}
            readOnly={readOnly}
            products={products}
          />
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-4">
            {olderTruncated ? (
              <p className="text-muted-foreground rounded-xl border border-dashed py-2 text-center text-xs">
                Showing the most recent messages in this conversation.
              </p>
            ) : null}
            {messages.map((m, i) => {
              const turn = (
                <ChatTurn
                  message={m}
                  streaming={streaming && m.role === "assistant" && i === messages.length - 1}
                  isLast={!streaming && !readOnly && i === messages.length - 1}
                  onRegenerate={regenerate}
                  onSuggest={(q) => void send(q)}
                />
              );
              return i >= initialCount ? (
                <FadeIn key={m.id}>{turn}</FadeIn>
              ) : (
                <React.Fragment key={m.id}>{turn}</React.Fragment>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-3xl">
        {capReached ? (
          <UsageNotice tone="error">
            {error ?? "You've reached this month's AI query limit."}{" "}
            <Link href="/billing" className="font-medium underline underline-offset-2">
              Upgrade your plan
            </Link>
          </UsageNotice>
        ) : error ? (
          <UsageNotice tone="error">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{error}</span>
              {lastAttempt ? (
                <button
                  type="button"
                  onClick={retry}
                  className="text-destructive inline-flex items-center gap-1 font-medium underline underline-offset-2"
                >
                  <RefreshCw className="size-3.5" />
                  Try again
                </button>
              ) : null}
            </span>
          </UsageNotice>
        ) : nearLimit ? (
          <UsageNotice tone="warning">
            You&apos;re close to this month&apos;s AI query limit.{" "}
            <Link href="/billing" className="font-medium underline underline-offset-2">
              Review your plan
            </Link>
          </UsageNotice>
        ) : null}
        <ChatComposer
          onSend={send}
          onStop={stop}
          streaming={streaming}
          disabled={readOnly}
          placeholder={activeMeta?.placeholder}
          templates={readOnly || hasDocuments === false ? [] : TEMPLATES}
          onPickTemplate={setActiveTemplate}
          header={
            readOnly ? null : activeMeta ? (
              <ActiveTemplateChip
                label={activeMeta.label}
                onClear={() => setActiveTemplate(null)}
              />
            ) : (
              <TemplateChips
                active={null}
                onPick={setActiveTemplate}
                disabled={hasDocuments === false}
              />
            )
          }
        />
      </div>
    </div>
  );
}

function EmptyState({
  hasDocuments,
  onPick,
  readOnly,
  products,
}: {
  hasDocuments: boolean;
  onPick: (q: string) => void;
  readOnly: boolean;
  products: readonly ProductFeature[];
}) {
  const liveData = products.some((p) => p !== "assistant");
  const prompts = EXAMPLE_PROMPTS.filter(
    (p) => products.includes(p.product) && (p.product !== "assistant" || hasDocuments),
  ).slice(0, 4);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-1 pt-8 pb-10 sm:pt-16">
      <span
        className="bg-primary-soft text-primary-soft-foreground flex size-11 items-center justify-center rounded-2xl"
        aria-hidden
      >
        <Sparkles className="size-5" />
      </span>
      <h2 className="mt-5 text-[1.625rem] font-bold tracking-[-0.025em] text-balance">
        What can I help you with today?
      </h2>
      <p className="text-muted-foreground type-body mt-2 max-w-xl text-pretty">
        {liveData
          ? "Ask about your documents, leads, schedule or automations. Answers from documents cite their source, and any change I suggest waits for you to confirm it."
          : "Ask about anything in your Knowledge base. Every answer cites the document it came from."}
      </p>

      {readOnly ? null : prompts.length > 0 ? (
        <ul className="mt-8 grid w-full gap-2 sm:grid-cols-2">
          {prompts.map(({ text, icon: Icon }) => (
            <li key={text}>
              <button
                type="button"
                onClick={() => onPick(text)}
                className="bg-card hover:border-primary-edge/35 hover:bg-primary-soft/30 focus-visible:ring-ring/40 group flex h-full w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-colors outline-none focus-visible:ring-[3px]"
              >
                <Icon className="text-muted-foreground group-hover:text-primary mt-0.5 size-4 shrink-0 transition-colors" />
                <span className="text-foreground flex-1">{text}</span>
                <ArrowUpRight
                  className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!readOnly && !hasDocuments ? (
        <div className="bg-card mt-6 flex w-full flex-col gap-4 rounded-xl border p-5 text-left">
          <p className="text-foreground font-semibold">
            Add documents for policy and how-to answers
          </p>
          <ol className="text-muted-foreground flex flex-col gap-2.5 text-sm">
            {[
              "Upload your SOPs, policies, price lists or FAQs, or import a web page.",
              "Ask a question in plain language.",
              "Get an answer with the source it came from.",
            ].map((step, i) => (
              <li key={step} className="flex items-start gap-2.5">
                <span className="bg-primary-soft text-primary-soft-foreground mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                  {i + 1}
                </span>
                <span className="text-foreground">{step}</span>
              </li>
            ))}
          </ol>
          <Link
            href="/knowledge"
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "self-start")}
          >
            <BookOpen className="size-4" />
            Add documents
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/** The three quick-action buttons that put the composer into a template mode. */
function TemplateChips({
  active,
  onPick,
  disabled,
}: {
  active: TemplateId | null;
  onPick: (id: TemplateId) => void;
  disabled: boolean;
}) {
  if (disabled) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {TEMPLATES.map((t) => {
        const Icon = TEMPLATE_ICONS[t.id];
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.id)}
            aria-pressed={active === t.id}
            title={t.description}
            className={cn(
              "rounded-xl bg-card inline-flex h-8 items-center gap-1.5 border px-3 text-[0.8125rem] font-medium transition-colors hover:border-input hover:bg-accent ",
              active === t.id &&
                "border-primary-edge/30 bg-primary-soft text-primary-soft-foreground",
            )}
          >
            <Icon className="text-muted-foreground size-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Day 33 — a small inline notice above the composer for usage-cap states. */
function UsageNotice({ tone, children }: { tone: "warning" | "error"; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "mb-2 rounded-xl border px-3.5 py-2.5 text-sm",
        tone === "error"
          ? "border-destructive/25 bg-destructive/[0.06] text-destructive"
          : "border-warning/25 bg-warning/[0.07] text-foreground",
      )}
    >
      {children}
    </div>
  );
}

/** The chip shown above the composer once a template is selected. */
function ActiveTemplateChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="bg-primary-soft text-primary-soft-foreground inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium">
      <Sparkles className="size-3.5" />
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear template"
        className="hover:bg-background/40 -mr-1 ml-0.5 inline-flex size-4 items-center justify-center rounded-full transition-colors"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
