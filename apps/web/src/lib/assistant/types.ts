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
  createdAt: string;
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
