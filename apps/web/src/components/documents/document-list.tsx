"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, MoreHorizontal, RefreshCw, Search, Tag, Trash2, X } from "lucide-react";

import { deleteDocument, setDocumentTags } from "@/lib/documents/actions";
import type { Document, DocumentStatus } from "@/lib/documents/types";
import { formatBytes } from "@/lib/documents/validation";
import { matchesQuery, normalizeTags, MAX_TAGS } from "@/lib/documents/tags";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

export type DocumentCitationMap = Record<
  string,
  { citedCount: number; lastCitedAt: string | null }
>;

type StatusMeta = {
  label: string;
  variant: "secondary" | "info" | "success" | "destructive";
};

const STATUS_META: Record<DocumentStatus, StatusMeta> = {
  uploaded: { label: "Uploaded", variant: "secondary" },
  extracting: { label: "Processing", variant: "info" },
  extracted: { label: "Extracted", variant: "info" },
  chunking: { label: "Processing", variant: "info" },
  embedding: { label: "Processing", variant: "info" },
  ready: { label: "Ready", variant: "success" },
  needs_ocr: { label: "Needs OCR", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DocumentList({
  documents,
  citations,
}: {
  documents: Document[];
  citations: DocumentCitationMap;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();
  const [confirm, setConfirm] = React.useState<Document | null>(null);
  const [tagDoc, setTagDoc] = React.useState<Document | null>(null);
  const [query, setQuery] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const filtered = React.useMemo(
    () => documents.filter((d) => matchesQuery(d, query)),
    [documents, query],
  );

  function runDelete() {
    if (!confirm) return;
    const doc = confirm;
    setConfirm(null);
    startTransition(async () => {
      const res = await deleteDocument(doc.id);
      if (res?.error) {
        toast.add({ title: "Something went wrong", description: res.error });
      } else {
        toast.add({ title: "Document deleted", description: `${doc.filename} was removed.` });
        router.refresh();
      }
    });
  }

  // Re-index = re-run the ingestion chain (extract → embed), reusing the Day-25/26
  // routes the uploader uses. Handles a failed doc (retry) or a ready doc (rebuild
  // chunks after a content/model change). Synchronous routes, so refresh once both
  // resolve to land on the final status.
  async function runReindex(doc: Document) {
    setBusyId(doc.id);
    try {
      const res = await fetch(`/api/documents/${doc.id}/extract`, { method: "POST" });
      const extracted = (await res.json().catch(() => null)) as { status?: string } | null;
      if (extracted?.status === "needs_ocr") {
        toast.add({
          title: "Can't index this file",
          description: "It looks like a scanned PDF — OCR support is coming.",
        });
      } else if (extracted?.status === "extracted") {
        await fetch(`/api/documents/${doc.id}/embed`, { method: "POST" });
        toast.add({ title: "Re-indexed", description: `${doc.filename} is up to date.` });
      } else {
        toast.add({ title: "Couldn't re-index", description: "Please try again." });
      }
    } catch {
      toast.add({ title: "Couldn't re-index", description: "Please try again." });
    } finally {
      setBusyId(null);
      router.refresh();
    }
  }

  if (documents.length === 0) {
    return (
      <div className="border-border flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-xl [&>svg]:size-6">
          <FileText />
        </span>
        <p className="text-foreground font-medium">No documents yet</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          Upload your SOPs, policies, and manuals above. Your AI Assistant will answer
          from them once processing lands.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative max-w-sm">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or tag…"
          aria-label="Search documents"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          No documents match “{query}”.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden text-right md:table-cell">Cited</TableHead>
              <TableHead className="hidden md:table-cell">Size</TableHead>
              <TableHead className="hidden md:table-cell">Added</TableHead>
              <TableHead className="w-10 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((doc) => {
              const meta = STATUS_META[doc.status];
              const stat = citations[doc.id];
              const busy = busyId === doc.id;
              return (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-start gap-2.5">
                      <FileText className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-foreground block truncate font-medium" title={doc.filename}>
                          {doc.filename}
                        </span>
                        {doc.tags.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {doc.tags.map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setQuery(t)}
                                className="bg-muted text-muted-foreground hover:bg-accent hover:text-foreground rounded px-1.5 py-0.5 text-xs transition-colors"
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={busy ? "info" : meta.variant}>
                        {busy ? "Re-indexing…" : meta.label}
                      </Badge>
                      {doc.status === "failed" && !busy ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive h-7 gap-1 px-2"
                          onClick={() => void runReindex(doc)}
                        >
                          <RefreshCw className="size-3.5" />
                          Retry
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground hidden text-right tabular-nums md:table-cell"
                    title={stat?.lastCitedAt ? `Last cited ${formatDate(stat.lastCitedAt)}` : undefined}
                  >
                    {stat?.citedCount ? stat.citedCount : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    {doc.sizeBytes != null ? formatBytes(doc.sizeBytes) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    {formatDate(doc.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                        aria-label={`Actions for ${doc.filename}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setTagDoc(doc)}>
                          <Tag />
                          Edit tags
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={busy} onClick={() => void runReindex(doc)}>
                          <RefreshCw />
                          Re-index
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setConfirm(doc)}
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <TagEditorDialog
        doc={tagDoc}
        onClose={() => setTagDoc(null)}
        onSaved={() => {
          setTagDoc(null);
          router.refresh();
        }}
      />

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete document</DialogTitle>
            <DialogDescription>
              Delete {confirm?.filename}? This removes the file and anything the Assistant
              learned from it. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={runDelete} disabled={pending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Dialog shell: opens when a doc is selected. The editable body is keyed by the
 * document id so it remounts with fresh initial state (no reset-in-effect). */
function TagEditorDialog({
  doc,
  onClose,
  onSaved,
}: {
  doc: Document | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={doc !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        {doc ? <TagEditorBody key={doc.id} doc={doc} onClose={onClose} onSaved={onSaved} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/** Add/remove tag chips for a document; commits via the setDocumentTags action. */
function TagEditorBody({
  doc,
  onClose,
  onSaved,
}: {
  doc: Document;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [tags, setTags] = React.useState<string[]>(doc.tags);
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  function commitDraft() {
    const next = normalizeTags([...tags, draft]);
    setTags(next);
    setDraft("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  }

  async function save() {
    setSaving(true);
    const merged = normalizeTags(draft ? [...tags, draft] : tags);
    const res = await setDocumentTags(doc.id, merged);
    setSaving(false);
    if (res?.error) {
      toast.add({ title: "Couldn't save tags", description: res.error });
      return;
    }
    toast.add({ title: "Tags updated", description: `${doc.filename} tags saved.` });
    onSaved();
  }

  const atLimit = tags.length >= MAX_TAGS;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit tags</DialogTitle>
        <DialogDescription>
          Tag {doc.filename} to organize your library. Press Enter or comma to add.
        </DialogDescription>
      </DialogHeader>

      <div className="border-input bg-card flex flex-wrap items-center gap-1.5 rounded-lg border p-2">
        {tags.map((t) => (
          <span
            key={t}
            className="bg-muted text-foreground inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
          >
            {t}
            <button
              type="button"
              onClick={() => setTags(tags.filter((x) => x !== t))}
              aria-label={`Remove ${t}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft && commitDraft()}
          disabled={atLimit}
          placeholder={atLimit ? `Max ${MAX_TAGS} tags` : tags.length ? "" : "e.g. policy, hr, refunds"}
          aria-label="Add a tag"
          className="text-foreground min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none disabled:opacity-50"
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          Save tags
        </Button>
      </DialogFooter>
    </>
  );
}
