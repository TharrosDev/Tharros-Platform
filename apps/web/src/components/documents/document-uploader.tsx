"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { AlertCircle, CheckCircle2, Loader2, UploadCloud, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { createDocumentRecord, deleteDocument } from "@/lib/documents/actions";
import { DOCUMENTS_BUCKET } from "@/lib/documents/types";
import {
  ACCEPTED_LABEL,
  FILE_INPUT_ACCEPT,
  formatBytes,
  MAX_FILE_BYTES,
  validateUploadFile,
} from "@/lib/documents/validation";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

type UploadStatus = "uploading" | "done" | "failed";

type UploadItem = {
  key: string;
  name: string;
  size: number;
  status: UploadStatus;
  error?: string;
};

let counter = 0;
const nextKey = () => `u${++counter}-${Date.now().toString(36)}`;

/** Drag-drop multi-file uploader. Bytes go browser → Storage (RLS-gated); the
 * documents row is reserved server-side first so the path stays org-scoped. */
export function DocumentUploader() {
  const router = useRouter();
  const toast = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [items, setItems] = React.useState<UploadItem[]>([]);

  const update = React.useCallback((key: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }, []);

  const uploadOne = React.useCallback(
    async (file: File, key: string) => {
      const reserved = await createDocumentRecord({
        filename: file.name,
        mimeType: file.type || null,
        sizeBytes: file.size,
      });
      if ("error" in reserved) {
        update(key, { status: "failed", error: reserved.error });
        return false;
      }

      const supabase = createClient();
      const { error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(reserved.storagePath, file, {
          contentType: file.type || undefined,
          upsert: false,
        });

      if (error) {
        // Roll back the reserved row so we don't leave a phantom document.
        await deleteDocument(reserved.id);
        update(key, { status: "failed", error: "Upload failed. Please try again." });
        return false;
      }

      // Kick off the ingestion pipeline (best-effort): extract text (Day 25),
      // then chunk + embed (Day 26). Any failure surfaces as a status badge in
      // the document list, not as an upload failure.
      try {
        const res = await fetch(`/api/documents/${reserved.id}/extract`, { method: "POST" });
        const extracted = (await res.json().catch(() => null)) as { status?: string } | null;
        if (extracted?.status === "extracted") {
          await fetch(`/api/documents/${reserved.id}/embed`, { method: "POST" });
        }
      } catch {
        // Network hiccup — the doc stays at its last status; re-index will retry.
      }

      update(key, { status: "done" });
      return true;
    },
    [update],
  );

  const handleFiles = React.useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      // Seed rows for every file up front so the user sees the full queue.
      const queued = files.map((file) => {
        const key = nextKey();
        const valid = validateUploadFile({ name: file.name, size: file.size, type: file.type });
        return {
          file,
          item: valid.ok
            ? ({ key, name: file.name, size: file.size, status: "uploading" } as UploadItem)
            : ({
                key,
                name: file.name,
                size: file.size,
                status: "failed",
                error: valid.error,
              } as UploadItem),
          valid: valid.ok,
        };
      });
      setItems((prev) => [...queued.map((q) => q.item), ...prev]);

      const results = await Promise.all(
        queued.map((q) => (q.valid ? uploadOne(q.file, q.item.key) : Promise.resolve(false))),
      );

      const ok = results.filter(Boolean).length;
      const failed = results.length - ok;
      if (ok > 0) {
        router.refresh();
        toast.add({
          title: "Upload complete",
          description: `${ok} document${ok === 1 ? "" : "s"} added${failed > 0 ? `, ${failed} failed` : ""}.`,
        });
      } else if (failed > 0) {
        toast.add({ title: "Upload failed", description: "No documents were added." });
      }
    },
    [router, toast, uploadOne],
  );

  const dismiss = (key: string) => setItems((prev) => prev.filter((it) => it.key !== key));

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload documents (${ACCEPTED_LABEL}, up to ${formatBytes(MAX_FILE_BYTES)} each)`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "group bg-card/60 relative flex cursor-pointer items-center gap-4 border border-dashed px-4 py-4 text-left transition-colors duration-150 sm:px-5",
          "hover:border-primary-edge/40 hover:bg-primary-soft/25 ",
          dragging ? "border-primary-edge bg-primary-soft/50" : "border-input",
        )}
      >
        <span
          className={cn(
            "bg-card text-primary-soft-foreground flex size-10 shrink-0 items-center justify-center border shadow-xs [&>svg]:size-5",
            dragging && "border-primary-edge/40",
          )}
        >
          <UploadCloud />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="text-foreground text-sm font-semibold">
            Drop files to upload, or{" "}
            <span className="text-primary-soft-foreground underline underline-offset-2">
              browse
            </span>
          </p>
          <p className="text-muted-foreground text-sm">
            {ACCEPTED_LABEL} · up to {formatBytes(MAX_FILE_BYTES)} each
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={FILE_INPUT_ACCEPT}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Upload progress">
          <AnimatePresence initial={false}>
            {items.map((it) => (
              <m.li
                key={it.key}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="bg-card flex items-center gap-3 border px-3.5 py-2.5 text-sm shadow-xs"
              >
                <StatusIcon status={it.status} />
                <span className="text-foreground min-w-0 flex-1 truncate" title={it.name}>
                  {it.name}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {it.status === "failed" ? it.error : formatBytes(it.size)}
                </span>
                {it.status !== "uploading" ? (
                  <button
                    type="button"
                    onClick={() => dismiss(it.key)}
                    aria-label={`Dismiss ${it.name}`}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : null}
    </div>
  );
}

function StatusIcon({ status }: { status: UploadStatus }) {
  if (status === "uploading") {
    return (
      <Loader2
        className="text-muted-foreground size-4 shrink-0 animate-spin"
        aria-label="Uploading"
      />
    );
  }
  if (status === "done") {
    return <CheckCircle2 className="text-success size-4 shrink-0" aria-label="Uploaded" />;
  }
  return <AlertCircle className="text-destructive size-4 shrink-0" aria-label="Failed" />;
}
