"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, BookOpen, ArrowUp, Mail, ClipboardList, FileText, X } from "lucide-react";

import type { Citation } from "@/lib/documents/rag-prompt";
import type { ChatMessage } from "@/lib/assistant/types";
import { createFrameDecoder } from "@/lib/assistant/stream-protocol";
import { TEMPLATES, type TemplateId } from "@/lib/assistant/templates";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ChatTurn } from "@/components/assistant/chat-message";
import { ChatComposer } from "@/components/assistant/chat-composer";

const TEMPLATE_ICONS: Record<TemplateId, React.ComponentType<{ className?: string }>> = {
  draft_email: Mail,
  write_sop: ClipboardList,
  summarize_policy: FileText,
};

const EXAMPLE_PROMPTS = [
  "What's our refund policy?",
  "Summarize our employee handbook.",
  "What are our hours and contact details?",
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
}: {
  selectedId: string | null;
  initialMessages: ChatMessage[];
  hasDocuments: boolean;
  readOnly?: boolean;
  /** Day 33 — org is at ≥80% of its monthly query cap; show a soft warning. */
  nearLimit?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Day 33 — set when the API returns a usage-cap 429; swaps the warning for a
  // hard "upgrade to continue" banner.
  const [capReached, setCapReached] = React.useState(false);
  const [activeTemplate, setActiveTemplate] = React.useState<TemplateId | null>(null);
  const activeMeta = activeTemplate ? TEMPLATES.find((t) => t.id === activeTemplate) : null;
  const pendingRef = React.useRef<Pending | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  // Keep the latest turn in view as content streams in.
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: streaming ? "auto" : "smooth", block: "end" });
  }, [messages, streaming]);

  const patch = React.useCallback((id: string, fn: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  const send = React.useCallback(
    async (question: string) => {
      if (streaming) return;
      setError(null);

      // Capture + clear the template mode for this turn; subsequent turns are
      // plain Q&A unless the user picks a template again.
      const template = activeTemplate;
      setActiveTemplate(null);

      const userId = crypto.randomUUID();
      const assistantId = crypto.randomUUID();
      pendingRef.current = { userId, assistantId };
      const now = new Date().toISOString();

      setMessages((prev) => [
        ...prev,
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
          const data = (await res.json().catch(() => null)) as { code?: string; error?: string } | null;
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
              patch(assistantId, (m) => ({ ...m, content: m.content + event.text }));
            } else if (event.type === "error") {
              throw new Error(event.message);
            } else if (event.type === "done") {
              patch(assistantId, (m) => ({ ...m, citations }));
            }
          }
        }
      } catch {
        if (controller.signal.aborted) {
          // User pressed Stop: keep whatever streamed, attach any citations.
          patch(assistantId, (m) => ({ ...m, citations }));
        } else {
          setError("Something went wrong generating that answer. Please try again.");
          patch(assistantId, (m) => ({
            ...m,
            content: m.content || "I couldn't finish that answer.",
          }));
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

  const showEmpty = messages.length === 0 && !streaming;

  return (
    <div className="flex min-h-[calc(100vh-16rem)] flex-col">
      <div className="flex-1">
        {showEmpty ? (
          <EmptyState
            hasDocuments={hasDocuments}
            onPick={send}
            onPickTemplate={setActiveTemplate}
            readOnly={readOnly}
          />
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            {messages.map((m, i) => (
              <ChatTurn
                key={m.id}
                message={m}
                streaming={
                  streaming && m.role === "assistant" && i === messages.length - 1
                }
              />
            ))}
            {error ? (
              <p className="text-destructive mx-auto text-sm" role="alert">
                {error}
              </p>
            ) : null}
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
          header={
            readOnly ? null : activeMeta ? (
              <ActiveTemplateChip label={activeMeta.label} onClear={() => setActiveTemplate(null)} />
            ) : (
              <TemplateChips active={null} onPick={setActiveTemplate} disabled={hasDocuments === false} />
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
  onPickTemplate,
  readOnly,
}: {
  hasDocuments: boolean;
  onPick: (q: string) => void;
  onPickTemplate: (id: TemplateId) => void;
  readOnly: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 pt-10 pb-6 text-center sm:pt-16">
      <span className="text-primary bg-primary-soft flex size-12 items-center justify-center rounded-xl">
        <Sparkles className="size-6" />
      </span>
      <h2 className="type-h1 mt-4">Ask about your business</h2>
      <p className="text-muted-foreground type-body mt-2 max-w-md">
        The assistant answers only from the documents in your Knowledge base, and cites the
        source for every answer.
      </p>

      {readOnly ? null : hasDocuments ? (
        <div className="mt-7 flex w-full flex-col gap-4">
          <div className="flex flex-col gap-2">
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPick(p)}
                className="group border-border bg-card hover:border-ring hover:bg-accent/50 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors"
              >
                <span className="text-foreground">{p}</span>
                <ArrowUp className="text-muted-foreground size-4 shrink-0 rotate-45 transition-transform group-hover:rotate-90" />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="border-border h-px flex-1 border-t" />
            <span className="text-muted-foreground text-xs">or generate something</span>
            <span className="border-border h-px flex-1 border-t" />
          </div>
          <TemplateChips active={null} onPick={onPickTemplate} disabled={false} />
        </div>
      ) : (
        <div className="border-border mt-7 flex w-full flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8">
          <p className="text-foreground text-sm font-medium">No documents yet</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Upload your SOPs, policies, and manuals first. Then the assistant can answer from
            them.
          </p>
          <Link href="/knowledge" className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-1")}>
            <BookOpen className="size-4" />
            Go to Knowledge
          </Link>
        </div>
      )}
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
              "border-border bg-card hover:border-ring hover:bg-accent/50 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active === t.id && "border-ring bg-accent",
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
function UsageNotice({
  tone,
  children,
}: {
  tone: "warning" | "error";
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "mb-2 rounded-lg border px-3 py-2 text-sm",
        tone === "error"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-border bg-accent/40 text-foreground",
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
