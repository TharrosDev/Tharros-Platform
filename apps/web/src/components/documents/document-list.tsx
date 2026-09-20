"use client";

import * as React from "react";
import { AnimatePresence, m } from "motion/react";
import { FileText, MoreHorizontal, RefreshCw, Search, Tag, Trash2, X } from "lucide-react";

import {
  addTagsToDocuments,
  deleteDocument,
  deleteDocuments,
  searchDocuments,
  setDocumentTags,
} from "@/lib/documents/actions";
import type { Document, DocumentStatus } from "@/lib/documents/types";
import { formatBytes } from "@/lib/documents/validation";
import { normalizeTags, MAX_TAGS } from "@/lib/documents/tags";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

type StatusMeta = {
  label: string;
  variant: "secondary" | "info" | "success" | "destructive";
};

const STATUS_META: Record<DocumentStatus, StatusMeta> = {
  uploaded: { label: "Uploaded", variant: "secondary" },
  extracting: { label: "Reading text", variant: "info" },
  extracted: { label: "Text read", variant: "info" },
  chunking: { label: "Indexing", variant: "info" },
  embedding: { label: "Indexing", variant: "info" },
  ready: { label: "Ready", variant: "success" },
  needs_ocr: { label: "Scanned PDF", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Library table. Search + pagination are server-side (the `search_documents`
 * keyset RPC), so the client only ever holds the pages it has loaded — never the
 * whole org library. Mutations (delete / tag / re-index) update local state in
 * place rather than refreshing the whole page (which would refetch from the top).
 * A new upload bumps the server-passed key, remounting this with a fresh page.
 */
export function DocumentList({
  initialDocuments,
  initialCursor,
}: {
  initialDocuments: Document[];
  initialCursor: string | null;
}) {
  const toast = useToast();
  const [docs, setDocs] = React.useState<Document[]>(initialDocuments);
  const [cursor, setCursor] = React.useState<string | null>(initialCursor);
  const [query, setQuery] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [confirm, setConfirm] = React.useState<Document | null>(null);
  const [tagDoc, setTagDoc] = React.useState<Document | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  // Bulk selection (Set of document ids). Cleared on search, kept across
  // "Load more" so a long multi-select survives pagination.
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = React.useState(false);
  const [bulkTagOpen, setBulkTagOpen] = React.useState(false);
  const [bulkBusy, setBulkBusy] = React.useState(false);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visibleIds = docs.map((d) => d.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function toggleAllVisible() {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      }
      return new Set([...prev, ...visibleIds]);
    });
  }

  // Debounced server-side search. The effect body only schedules a timer (no
  // synchronous setState); the fetch + setState run in the async callback.
  const mounted = React.useRef(false);
  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        setSearching(true);
        const res = await searchDocuments(query, null);
        setDocs(res.documents);
        setCursor(res.nextCursor);
        setSelected(new Set());
        setSearching(false);
      })();
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    const res = await searchDocuments(query, cursor);
    setDocs((prev) => [...prev, ...res.documents]);
    setCursor(res.nextCursor);
    setLoadingMore(false);
  }

  // After a re-index the status changed server-side; reload the current query's
  // first page to reflect it (and pick up any new ingestion state).
  async function reloadCurrent() {
    const res = await searchDocuments(query, null);
    setDocs(res.documents);
    setCursor(res.nextCursor);
  }

  function runDelete() {
    if (!confirm) return;
    const doc = confirm;
    setConfirm(null);
    startTransition(async () => {
      const res = await deleteDocument(doc.id);
      if (res?.error) {
        toast.add({ title: "Something went wrong", description: res.error });
      } else {
        setDocs((prev) => prev.filter((d) => d.id !== doc.id));
        setSelected((prev) => {
          if (!prev.has(doc.id)) return prev;
          const next = new Set(prev);
          next.delete(doc.id);
          return next;
        });
        toast.add({ title: "Document deleted", description: `${doc.filename} was removed.` });
      }
    });
  }

  async function runBulkDelete() {
    const ids = [...selected];
    setBulkConfirm(false);
    setBulkBusy(true);
    const res = await deleteDocuments(ids);
    setBulkBusy(false);
    const gone = new Set(res.deletedIds);
    setDocs((prev) => prev.filter((d) => !gone.has(d.id)));
    setSelected(new Set());
    if (res.error) {
      toast.add({ title: "Some documents remain", description: res.error });
    } else {
      toast.add({
        title: "Documents deleted",
        description: `${res.deletedIds.length} document${res.deletedIds.length === 1 ? "" : "s"} removed.`,
      });
    }
  }

  async function runBulkTag(tags: string[]) {
    const ids = [...selected];
    setBulkTagOpen(false);
    setBulkBusy(true);
    const res = await addTagsToDocuments(ids, tags);
    setBulkBusy(false);
    const byId = new Map(res.updated.map((u) => [u.id, u.tags]));
    setDocs((prev) => prev.map((d) => (byId.has(d.id) ? { ...d, tags: byId.get(d.id)! } : d)));
    setSelected(new Set());
    if (res.error) {
      toast.add({ title: "Partly tagged", description: res.error });
    } else {
      toast.add({
        title: "Tags added",
        description: `${res.updated.length} document${res.updated.length === 1 ? "" : "s"} updated.`,
      });
    }
  }

  // Re-index = re-run the ingestion chain (extract → embed), reusing the Day-25/26
  // routes the uploader uses. Handles a failed doc (retry) or a ready doc (rebuild
  // chunks). Synchronous routes, so reload once both resolve to land on status.
  async function runReindex(doc: Document) {
    setBusyId(doc.id);
    try {
      const res = await fetch(`/api/documents/${doc.id}/extract`, { method: "POST" });
      const extracted = (await res.json().catch(() => null)) as { status?: string } | null;
      if (extracted?.status === "needs_ocr") {
        toast.add({
          title: "Can't index this file",
          description: "It looks like a scanned PDF. OCR support is coming.",
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
      await reloadCurrent();
    }
  }

  const showInitialEmpty = docs.length === 0 && query.trim() === "" && !searching;
  if (showInitialEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 border border-dashed bg-card/60 px-6 py-12 text-center">
        <span className="bg-card text-primary-soft-foreground mb-2 flex size-10 items-center justify-center border [&>svg]:size-5">
          <FileText />
        </span>
        <p className="text-foreground font-semibold">No documents yet</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          Upload your SOPs, policies, and manuals above. Your AI Assistant will answer from them
          once processing lands.
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

      {docs.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {searching ? "Searching…" : `No documents match “${query}”.`}
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={toggleAllVisible}
                    aria-label={allVisibleSelected ? "Clear selection" : "Select all documents"}
                  />
                </TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden text-right md:table-cell">Cited</TableHead>
                <TableHead className="hidden md:table-cell">Size</TableHead>
                <TableHead className="hidden md:table-cell">Added</TableHead>
                <TableHead className="w-10 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence initial={false}>
                {docs.map((doc) => {
                  const meta = STATUS_META[doc.status];
                  const busy = busyId === doc.id;
                  return (
                    <m.tr
                      key={doc.id}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      data-selected={selected.has(doc.id) || undefined}
                      className="border-b border-border/55 transition-colors hover:bg-primary-soft/25 data-[selected]:bg-primary-soft/40"
                    >
                      <TableCell>
                        <Checkbox
                          checked={selected.has(doc.id)}
                          onCheckedChange={() => toggleSelected(doc.id)}
                          aria-label={`Select ${doc.filename}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-2.5">
                          <FileText className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                          <div className="min-w-0">
                            <span
                              className="text-foreground block truncate font-medium"
                              title={doc.filename}
                            >
                              {doc.filename}
                            </span>
                            {doc.tags.length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {doc.tags.map((t) => (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => setQuery(t)}
                                    className="bg-surface-2 text-muted-foreground hover:bg-primary-soft hover:text-primary-soft-foreground border border-border/50 px-1.5 py-0.5 text-xs transition-colors"
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
                        title={
                          doc.lastCitedAt ? `Last cited ${formatDate(doc.lastCitedAt)}` : undefined
                        }
                      >
                        {doc.citedCount ? doc.citedCount : "—"}
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
                    </m.tr>
                  );
                })}
              </AnimatePresence>
            </TableBody>
          </Table>

          {cursor ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}

      {/* Floating bulk-action bar; present only while a selection exists. */}
      <AnimatePresence>
        {selected.size > 0 ? (
          <m.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="bg-popover shadow-popover z-subnav fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1.5 border px-3 py-2"
          >
            <span className="text-foreground px-1 text-sm font-medium whitespace-nowrap">
              {selected.size} selected
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkBusy}
              onClick={() => setBulkTagOpen(true)}
            >
              <Tag className="size-3.5" />
              Add tags
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkBusy}
              className="text-destructive hover:text-destructive"
              onClick={() => setBulkConfirm(true)}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={bulkBusy}
              onClick={() => setSelected(new Set())}
              aria-label="Clear selection"
            >
              <X className="size-3.5" />
            </Button>
          </m.div>
        ) : null}
      </AnimatePresence>

      <Dialog open={bulkConfirm} onOpenChange={(open) => !open && setBulkConfirm(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {selected.size} documents</DialogTitle>
            <DialogDescription>
              This removes the files and anything the Assistant learned from them. This can&apos;t
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkConfirm(false)} disabled={bulkBusy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void runBulkDelete()} disabled={bulkBusy}>
              Delete documents
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkTagDialog
        open={bulkTagOpen}
        count={selected.size}
        busy={bulkBusy}
        onClose={() => setBulkTagOpen(false)}
        onSave={(tags) => void runBulkTag(tags)}
      />

      <TagEditorDialog
        doc={tagDoc}
        onClose={() => setTagDoc(null)}
        onSaved={(id, tags) => {
          setTagDoc(null);
          setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, tags } : d)));
        }}
      />

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete document</DialogTitle>
            <DialogDescription>
              Delete {confirm?.filename}? This removes the file and anything the Assistant learned
              from it. This can&apos;t be undone.
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

/** Tag entry for the bulk bar: collects tags, applies them to every selected
 * document. Keyed remount on open gives fresh state without reset-in-effect. */
function BulkTagDialog({
  open,
  count,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  count: number;
  busy: boolean;
  onClose: () => void;
  onSave: (tags: string[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {open ? <BulkTagBody count={count} busy={busy} onClose={onClose} onSave={onSave} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function BulkTagBody({
  count,
  busy,
  onClose,
  onSave,
}: {
  count: number;
  busy: boolean;
  onClose: () => void;
  onSave: (tags: string[]) => void;
}) {
  const [tags, setTags] = React.useState<string[]>([]);
  const [draft, setDraft] = React.useState("");

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

  const final = normalizeTags(draft ? [...tags, draft] : tags);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add tags to {count} documents</DialogTitle>
        <DialogDescription>
          These tags are added to each selected document&apos;s existing tags. Press Enter or comma
          to add one.
        </DialogDescription>
      </DialogHeader>

      <div className="border-input bg-card/80 flex flex-wrap items-center gap-1.5 border p-2.5">
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
          placeholder={tags.length ? "" : "e.g. policy, hr, refunds"}
          aria-label="Add a tag"
          className="text-foreground min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm "
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={() => onSave(final)} disabled={busy || final.length === 0}>
          Add tags
        </Button>
      </DialogFooter>
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
  onSaved: (id: string, tags: string[]) => void;
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
  onSaved: (id: string, tags: string[]) => void;
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
    onSaved(doc.id, merged);
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

      <div className="border-input bg-card/80 flex flex-wrap items-center gap-1.5 border p-2.5">
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
          placeholder={
            atLimit ? `Max ${MAX_TAGS} tags` : tags.length ? "" : "e.g. policy, hr, refunds"
          }
          aria-label="Add a tag"
          className="text-foreground min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm disabled:opacity-50"
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
