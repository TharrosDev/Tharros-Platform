import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/current-user";
import { getOrgContext } from "@/lib/org/queries";
import { listDocuments } from "@/lib/documents/queries";
import { checkQueryCap } from "@/lib/billing/usage";
import {
  getConversationMessages,
  listConversations,
} from "@/lib/assistant/conversations";
import { PageHeader } from "@/components/page-header";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { ConversationHistory } from "@/components/assistant/conversation-history";

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

  const [conversations, documents, cap] = await Promise.all([
    listConversations(activeOrg.id),
    listDocuments(activeOrg.id),
    checkQueryCap(activeOrg.id),
  ]);

  // Resolve the selected conversation. An unknown id (deleted, or another org's)
  // falls back to a fresh chat rather than showing an empty mystery thread.
  const selected = selectedParam
    ? conversations.find((c) => c.id === selectedParam) ?? null
    : null;
  if (selectedParam && !selected) redirect("/assistant");

  const messages = selected ? await getConversationMessages(selected.id) : [];
  const readOnly = selected ? selected.userId !== user.id : false;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="AI Assistant"
        description="Ask anything about your business. Answers come straight from your documents, with sources."
        actions={
          <ConversationHistory
            conversations={conversations}
            activeId={selected?.id ?? null}
            viewerId={user.id}
          />
        }
      />
      <AssistantChat
        key={selected?.id ?? "new"}
        selectedId={selected?.id ?? null}
        initialMessages={messages}
        hasDocuments={documents.length > 0}
        readOnly={readOnly}
        nearLimit={cap.nearLimit}
      />
    </div>
  );
}
