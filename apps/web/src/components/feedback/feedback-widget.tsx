"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { Bug, CheckCircle2, CircleHelp, Lightbulb, Minus, Send, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { spring } from "@/components/motion";
import { TharrosMark } from "@/components/brand/logo";
import { Textarea } from "@/components/ui/textarea";
import { sendFeedbackTurn } from "@/lib/feedback/actions";
import type { FeedbackKind, FeedbackMessage } from "@/lib/feedback/agent";

/**
 * The Suggestions/Questions widget: a docked pill in the bottom-right that
 * expands into a small two-tab panel. "Ask" answers questions about the
 * platform; "Suggest" walks a suggestion, bug report, or wish through the
 * feedback agent (which may ask a guiding question or two) and logs it for
 * review. Rewards are decided by the team on review, so the widget never
 * promises one.
 */

const KIND_OPTIONS: { value: FeedbackKind; label: string; icon: typeof Bug }[] = [
  { value: "suggestion", label: "Suggestion", icon: Lightbulb },
  { value: "bug", label: "Bug", icon: Bug },
  { value: "wish", label: "Wish", icon: Star },
];

const ASK_INTRO =
  "Hi! Ask me how anything in Tharros works. For ideas or problems, hop over to the Suggest tab.";
const SUGGEST_INTRO =
  "Found a bug, or have an idea? Pick what kind of feedback this is, describe it, and I'll log it for the team. Useful submissions can earn bonus AI usage.";

type TabState = {
  messages: FeedbackMessage[];
  logged: boolean;
};

export function FeedbackWidget() {
  const [open, setOpen] = React.useState(false);
  // The assistant docks its composer at the bottom; on small screens the launcher would cover Send.
  const overComposer = usePathname().startsWith("/assistant");
  const [tab, setTab] = React.useState<"ask" | "suggest">("ask");
  const [kind, setKind] = React.useState<FeedbackKind | null>(null);
  const [ask, setAsk] = React.useState<TabState>({ messages: [], logged: false });
  const [suggest, setSuggest] = React.useState<TabState>({ messages: [], logged: false });
  const [input, setInput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLElement>(null);
  const launcherRef = React.useRef<HTMLButtonElement>(null);

  /*
    This is a non-modal helper panel, not a modal dialog: it does not trap the
    page and the rest of the app stays usable behind it. It previously claimed
    role="dialog" while providing none of what that role promises. It is now an
    ordinary disclosure, and it owes Escape and focus return, which it now has.
  */
  React.useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      launcherRef.current?.focus();
    }
    const node = panelRef.current;
    node?.addEventListener("keydown", onKey);
    return () => node?.removeEventListener("keydown", onKey);
  }, [open]);

  const state = tab === "ask" ? ask : suggest;
  const setState = tab === "ask" ? setAsk : setSuggest;

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [ask.messages.length, suggest.messages.length, pending]);

  const canSend =
    input.trim().length > 0 && !pending && !(tab === "suggest" && (kind === null || state.logged));

  function send() {
    if (!canSend) return;
    const text = input.trim();
    const nextMessages: FeedbackMessage[] = [...state.messages, { role: "user", content: text }];
    setState({ ...state, messages: nextMessages });
    setInput("");
    setError(null);

    const activeTab = tab;
    const activeKind = kind ?? undefined;
    startTransition(async () => {
      const res = await sendFeedbackTurn({
        tab: activeTab,
        kind: activeTab === "suggest" ? activeKind : undefined,
        messages: nextMessages,
      });
      const apply = activeTab === "ask" ? setAsk : setSuggest;
      if (res.ok) {
        apply({
          messages: [...nextMessages, { role: "assistant", content: res.reply }],
          logged: res.logged,
        });
      } else {
        setError(res.message);
      }
    });
  }

  function resetSuggest() {
    setSuggest({ messages: [], logged: false });
    setKind(null);
    setError(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className={cn("z-widget fixed right-4 bottom-4", overComposer && "max-lg:hidden")}>
      <AnimatePresence initial={false} mode="popLayout">
        {open ? (
          <m.section
            key="panel"
            layoutId="feedback-widget"
            transition={spring.gentle}
            ref={panelRef}
            id="feedback-panel"
            tabIndex={-1}
            aria-label="Help and feedback"
            className="bg-popover shadow-modal flex h-[32rem] max-h-[calc(100dvh-6rem)] w-[24rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden border"
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b px-4 py-3">
              <span className="text-primary-soft-foreground bg-primary-soft flex size-8 items-center justify-center rounded-lg">
                <TharrosMark className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-tight font-semibold">Help &amp; ideas</p>
                <p className="text-muted-foreground text-xs leading-tight">
                  Questions, suggestions, and bug reports
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Minimize"
                className="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex size-10 items-center justify-center rounded-lg transition-colors "
              >
                <Minus className="size-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b px-3 py-2">
              {(["ask", "suggest"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTab(t);
                    setError(null);
                  }}
                  aria-current={tab === t ? "page" : undefined}
                  className={cn(
                    " relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors ",
                    tab === t
                      ? "text-primary-soft-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab === t ? (
                    <m.span
                      layoutId="feedback-tab"
                      transition={spring.snappy}
                      className="bg-primary-soft absolute inset-0 rounded-md"
                      aria-hidden
                    />
                  ) : null}
                  <span className="relative">{t === "ask" ? "Ask" : "Suggest"}</span>
                </button>
              ))}
            </div>

            {/* Conversation */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              <AgentBubble>{tab === "ask" ? ASK_INTRO : SUGGEST_INTRO}</AgentBubble>

              {tab === "suggest" && !state.logged ? (
                <div className="flex flex-wrap gap-1.5 pl-8">
                  {KIND_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setKind(value)}
                      data-active={kind === value || undefined}
                      className={cn(
                        " inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-medium transition-colors ",
                        kind === value
                          ? "border-primary-edge/40 bg-primary-soft text-primary-soft-foreground"
                          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <Icon className="size-3" aria-hidden />
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}

              {state.messages.map((msg, i) =>
                msg.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="bg-surface-2 text-foreground max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <AgentBubble key={i}>{msg.content}</AgentBubble>
                ),
              )}

              {pending ? (
                <AgentBubble>
                  <span className="flex items-center gap-1 py-0.5" aria-label="Thinking">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="bg-muted-foreground/60 size-1.5 animate-pulse motion-reduce:animate-none"
                        style={{ animationDelay: `${i * 160}ms` }}
                      />
                    ))}
                  </span>
                </AgentBubble>
              ) : null}

              {state.logged && tab === "suggest" ? (
                <div className="bg-success/10 text-success flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="text-foreground/90">
                    Logged for the team. Valuable submissions can earn bonus AI usage, applied to
                    your workspace after review.{" "}
                    <button
                      type="button"
                      onClick={resetSuggest}
                      className="text-primary-soft-foreground font-medium hover:underline"
                    >
                      Send another
                    </button>
                  </span>
                </div>
              ) : null}

              {error ? (
                <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
                  {error}
                </p>
              ) : null}
              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <div className="border-t p-3">
              <div className="border-input bg-card focus-within:border-ring focus-within:ring-ring/25 flex items-end gap-2 rounded-lg border p-1.5 transition-[box-shadow,border-color] focus-within:ring-[3px]">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  disabled={tab === "suggest" && state.logged}
                  placeholder={
                    tab === "ask"
                      ? "Ask how something works…"
                      : state.logged
                        ? "Submission logged."
                        : kind
                          ? `Describe your ${kind}…`
                          : "Pick a type above, then describe it…"
                  }
                  aria-label={tab === "ask" ? "Ask a question" : "Describe your feedback"}
                  className="max-h-28 min-h-9 resize-none border-0 bg-transparent px-2 py-1.5 text-sm shadow-none "
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={!canSend}
                  aria-label="Send"
                  className="bg-primary text-primary-foreground hover:bg-primary/92 disabled:bg-muted disabled:text-muted-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-md transition-colors "
                >
                  <Send className="size-3.5" />
                </button>
              </div>
            </div>
          </m.section>
        ) : (
          <m.button
            key="pill"
            layoutId="feedback-widget"
            transition={spring.gentle}
            ref={launcherRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={false}
            aria-controls="feedback-panel"
            className="bg-card text-foreground shadow-raised hover:text-primary-soft-foreground flex size-11 items-center justify-center border transition-colors"
            aria-label="Open help and feedback"
            title="Help & feedback"
          >
            <CircleHelp className="size-5" aria-hidden />
          </m.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function AgentBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span
        aria-hidden
        className="text-primary-soft-foreground bg-primary-soft mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary-edge/10"
      >
        <TharrosMark className="size-3" />
      </span>
      <div className="bg-surface-2 text-foreground/90 max-w-[85%] rounded-2xl rounded-tl-md border border-border/50 px-3.5 py-2.5 text-sm shadow-xs whitespace-pre-wrap">
        {children}
      </div>
    </div>
  );
}
