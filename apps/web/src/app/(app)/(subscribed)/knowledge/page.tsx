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
        description="Upload the documents your AI Assistant should learn from: SOPs, policies, price lists, FAQs."
      />
      {documents.length < 3 ? <FirstDocumentsProgress count={documents.length} /> : null}
      <DocumentUploader />
      <section className="space-y-3">
        <h2 className="type-h2">Documents</h2>
        <DocumentList documents={documents} citations={citations} />
      </section>
    </div>
  );
}

/**
 * Day 35 — first-run nudge. Shown only until the org has 3 documents, so a new
 * owner sees what to do and the assistant has enough to answer from. Derived
 * purely from the live document count: no stored state, nothing to dismiss.
 */
const FIRST_DOCS_TARGET = 3;

function FirstDocumentsProgress({ count }: { count: number }) {
  const done = Math.min(count, FIRST_DOCS_TARGET);
  const pct = (done / FIRST_DOCS_TARGET) * 100;
  return (
    <div className="border-border bg-card shadow-card rounded-xl border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-foreground text-sm font-medium">
          {count === 0
            ? "Add your first documents"
            : `${done} of ${FIRST_DOCS_TARGET} documents added`}
        </p>
        <span className="text-muted-foreground type-meta">
          {done}/{FIRST_DOCS_TARGET}
        </span>
      </div>
      <div className="bg-muted mt-2.5 h-1.5 w-full overflow-hidden rounded-full" aria-hidden>
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-muted-foreground mt-2.5 text-sm">
        Upload a few SOPs, policies, or FAQs so the assistant has enough to answer from.
      </p>
    </div>
  );
}
