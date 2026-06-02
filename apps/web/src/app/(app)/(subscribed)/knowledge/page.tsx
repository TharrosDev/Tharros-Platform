import { getOrgContext } from "@/lib/org/queries";
import { listDocuments } from "@/lib/documents/queries";
import { PageHeader } from "@/components/page-header";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { DocumentList } from "@/components/documents/document-list";

/**
 * Day 24 — Knowledge base. Upload + manage the documents the AI Assistant will
 * answer from. Ingestion (extraction → chunking → embedding) lands Days 25–28;
 * for now documents sit at status "uploaded" and re-index is stubbed.
 */
export default async function KnowledgePage() {
  const { activeOrg } = await getOrgContext();
  const documents = activeOrg ? await listDocuments(activeOrg.id) : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Knowledge"
        description="Upload the documents your AI Assistant should learn from — SOPs, policies, price lists, FAQs."
      />
      <DocumentUploader />
      <section className="space-y-3">
        <h2 className="type-h2">Documents</h2>
        <DocumentList documents={documents} />
      </section>
    </div>
  );
}
