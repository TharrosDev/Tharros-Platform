"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";

import { deleteDocument } from "@/lib/documents/actions";
import type { Document, DocumentStatus } from "@/lib/documents/types";
import { formatBytes } from "@/lib/documents/validation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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

export function DocumentList({ documents }: { documents: Document[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();
  const [confirm, setConfirm] = React.useState<Document | null>(null);

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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Added</TableHead>
            <TableHead className="w-10 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => {
            const meta = STATUS_META[doc.status];
            return (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <FileText className="text-muted-foreground size-4 shrink-0" />
                    <span className="text-foreground truncate font-medium" title={doc.filename}>
                      {doc.filename}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {doc.sizeBytes != null ? formatBytes(doc.sizeBytes) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(doc.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                      aria-label={`Actions for ${doc.filename}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {/* Re-index becomes live on Day 26 (ingestion pipeline). */}
                      <DropdownMenuItem disabled>
                        <RefreshCw />
                        Re-index (soon)
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
