import { getOrgContext } from "@/lib/org/queries";
import { getDocumentCitationCounts, listDocuments } from "@/lib/documents/queries";
import { PageHeader } from "@/components/page-header";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { DocumentList, type DocumentCitationMap } from "@/components/documents/document-list";

/**
 * Day 24 — Knowledge base. Upload + manage the documents the AI Assistant
 * answers from. Day 32 added tagging, library search, citation usage stats, and
 * live re-index controls (the ingestion pipeline landed Days 25–28).
 */
export default async function KnowledgePage() {
  const { activeOrg } = await getOrgContext();
  const [documents, citationStats] = activeOrg
    ? await Promise.all([
        listDocuments(activeOrg.id),
        getDocumentCitationCounts(activeOrg.id),
      ])
    : [[], new Map()];

  // Map → plain object so it can cross the server→client boundary.
  const citations: DocumentCitationMap = Object.fromEntries(citationStats);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Knowledge"
        description="Upload the documents your AI Assistant should learn from — SOPs, policies, price lists, FAQs."
      />
      <DocumentUploader />
      <section className="space-y-3">
        <h2 className="type-h2">Documents</h2>
        <DocumentList documents={documents} citations={citations} />
      </section>
    </div>
  );
}
