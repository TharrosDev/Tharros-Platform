import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/current-user";
import { getOrgContext } from "@/lib/org/queries";
import { hasAnyDocument } from "@/lib/documents/queries";
import { checkQueryCap } from "@/lib/billing/usage";
import {
  getConversation,
  getConversationMessages,
  listConversationsPage,
} from "@/lib/assistant/conversations";
import { PageHeader } from "@/components/page-header";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { getSubscription } from "@/lib/billing/entitlements";
import { getPlan } from "@/lib/billing/plans";
import { ConversationHistory } from "@/components/assistant/conversation-history";

export const metadata = { title: "AI Assistant" };

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const [user, { activeOrg }, { c: selectedParam }] = await Promise.all([
    getAuthUser(),
    getOrgContext(),
    searchParams,
  ]);

  // The (app) + (subscribed) layouts already gate auth + org; this is defensive.
  if (!user || !activeOrg) redirect("/login");

  const [convPage, hasDocuments, cap, sub] = await Promise.all([
    listConversationsPage(activeOrg.id),
    hasAnyDocument(activeOrg.id),
    checkQueryCap(activeOrg.id),
    getSubscription(),
  ]);
  // Which live-data tools the assistant has, so the empty state suggests them.
  const products = sub?.tier ? getPlan(sub.tier).products : [];

  // Resolve the selected conversation by id (independent of the paginated history
  // list, which may not contain it). An unknown id (deleted, or another org's)
  // falls back to a fresh chat rather than showing an empty mystery thread.
  const selected = selectedParam ? await getConversation(selectedParam) : null;
  if (selectedParam && !selected) redirect("/assistant");

  const { messages, truncated } = selected
    ? await getConversationMessages(selected.id)
    : { messages: [], truncated: false };
  const readOnly = selected ? selected.userId !== user.id : false;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="AI Assistant"
        actions={
          <ConversationHistory
            conversations={convPage.conversations}
            initialNextCursor={convPage.nextCursor}
            activeId={selected?.id ?? null}
            viewerId={user.id}
          />
        }
      />
      <AssistantChat
        key={selected?.id ?? "new"}
        selectedId={selected?.id ?? null}
        initialMessages={messages}
        olderTruncated={truncated}
        hasDocuments={hasDocuments}
        readOnly={readOnly}
        nearLimit={cap.nearLimit}
        products={products}
      />
    </div>
  );
}
