"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, BookOpen, ArrowUp } from "lucide-react";

import type { Citation } from "@/lib/documents/rag-prompt";
import type { ChatMessage } from "@/lib/assistant/types";
import { createFrameDecoder } from "@/lib/assistant/stream-protocol";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ChatTurn } from "@/components/assistant/chat-message";
import { ChatComposer } from "@/components/assistant/chat-composer";

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
}: {
  selectedId: string | null;
  initialMessages: ChatMessage[];
  hasDocuments: boolean;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
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
          body: JSON.stringify({ question, conversationId: selectedId ?? undefined }),
          signal: controller.signal,
        });
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
    [streaming, selectedId, patch, router],
  );

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const showEmpty = messages.length === 0 && !streaming;

  return (
    <div className="flex min-h-[calc(100vh-16rem)] flex-col">
      <div className="flex-1">
        {showEmpty ? (
          <EmptyState hasDocuments={hasDocuments} onPick={send} readOnly={readOnly} />
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
        <ChatComposer onSend={send} onStop={stop} streaming={streaming} disabled={readOnly} />
      </div>
    </div>
  );
}

function EmptyState({
  hasDocuments,
  onPick,
  readOnly,
}: {
  hasDocuments: boolean;
  onPick: (q: string) => void;
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
        <div className="mt-7 flex w-full flex-col gap-2">
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
