"use server";

import { getOrgContext } from "@/lib/org/queries";
import { listConversationsPage } from "@/lib/assistant/conversations";
import { searchDocuments } from "@/lib/documents/actions";
import { getRoster } from "@/lib/employees/queries";
import { getFeatureAccess } from "@/lib/billing/entitlements";
import { fuzzyFilter } from "@/lib/search/fuzzy";
import { EMPTY_RESULTS, type WorkspaceSearchResults } from "@/lib/search/types";

const GROUP_LIMIT = 5;

/**
 * Command-palette workspace search. Fans out to existing RLS-scoped reads
 * (recent conversations, the document library's `search_documents` RPC, the
 * employee roster) and ranks them with the shared fuzzy matcher. The
 * employees group only exists when the org's plan includes scheduling, so the
 * palette never points at a gated page.
 */
export async function searchWorkspace(rawQuery: string): Promise<WorkspaceSearchResults> {
  const query = rawQuery.trim();
  if (query.length < 2) return EMPTY_RESULTS;

  const { activeOrg } = await getOrgContext();
  if (!activeOrg) return EMPTY_RESULTS;

  const [conversationPage, documentPage, schedulingAccess] = await Promise.all([
    listConversationsPage(activeOrg.id, { limit: 40 }),
    searchDocuments(query, null),
    getFeatureAccess("scheduling"),
  ]);

  const conversations = fuzzyFilter(
    query,
    conversationPage.conversations,
    (c) => c.title,
    GROUP_LIMIT,
  ).map((c) => ({
    id: c.id,
    label: c.title,
    hint: c.askerName,
    href: `/assistant?c=${c.id}`,
  }));

  // search_documents already substring-filters server-side; just cap and map.
  const documents = documentPage.documents.slice(0, GROUP_LIMIT).map((d) => ({
    id: d.id,
    label: d.filename,
    hint: d.tags.length ? d.tags.join(", ") : null,
    href: "/knowledge",
  }));

  let employees: WorkspaceSearchResults["employees"] = [];
  if (schedulingAccess.entitled) {
    const roster = await getRoster();
    employees = fuzzyFilter(
      query,
      roster.employees.filter((e) => e.active),
      (e) => `${e.name} ${e.email}`,
      GROUP_LIMIT,
    ).map((e) => ({
      id: e.id,
      label: e.name,
      hint: e.email,
      href: `/scheduling/employees/${e.id}`,
    }));
  }

  return { conversations, documents, employees };
}
