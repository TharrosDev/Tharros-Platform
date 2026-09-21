import type { Citation } from "@/lib/documents/rag-prompt";

/**
 * Day 29 — assistant chat domain types, shared by the server data-access layer,
 * the page, and the client components. Pure types (no `server-only`) so client
 * islands can import them.
 */

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  /** Sources for an assistant turn (empty for user turns / ungrounded answers). */
  citations: Citation[];
  /** Changes the assistant proposed in this turn (confirm cards). */
  proposals?: ProposalView[];
  /** Transient, client-only: what the assistant is doing right now ("Checking the schedule"). */
  statusLabel?: string;
  /** Client-only: the stored id of a turn streamed this session (its `id` is a temp one). */
  persistedId?: string;
  createdAt: string;
};

export type ProposalView = {
  id: string;
  kind: "lead_status" | "follow_up_draft" | "notify_team";
  summary: string;
  status: "pending" | "confirmed" | "dismissed" | "failed";
};

export type Conversation = {
  id: string;
  title: string;
  /** Author of the thread. */
  userId: string;
  /**
   * Display name of the author. Populated only when the viewer is the org owner
   * reading someone else's thread; null otherwise. The UI shows it when
   * `userId !== viewerId`.
   */
  askerName: string | null;
  createdAt: string;
  updatedAt: string;
};
