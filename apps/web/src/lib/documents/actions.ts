"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/current-user";
import { getOrgContext } from "@/lib/org/queries";
import { logger } from "@/lib/observability/logger";
import { DOCUMENTS_BUCKET, storagePathFor } from "@/lib/documents/types";
import { sanitizeStorageName, validateUploadFile } from "@/lib/documents/validation";
import { normalizeTags } from "@/lib/documents/tags";

/**
 * Day 24 — document server actions. The bytes go straight from the browser to
 * Storage (browser client, gated by the Day-23 storage.objects RLS); these
 * actions own the `documents` row + the Storage path so the org-id-first path
 * convention the RLS depends on stays server-controlled.
 *
 * createDocumentRecord(): reserve a row + path BEFORE the browser uploads, so the
 * client uploads to a known org-scoped key. If the upload then fails the client
 * calls deleteDocument() to roll the row back.
 */

const KNOWLEDGE_PATH = "/knowledge";

export type CreateDocumentResult =
  | { id: string; storagePath: string }
  | { error: string };

/** Reserve a documents row + Storage path for an upload in the active org. */
export async function createDocumentRecord(input: {
  filename: string;
  mimeType?: string | null;
  sizeBytes: number;
}): Promise<CreateDocumentResult> {
  const [user, { activeOrg }] = await Promise.all([getAuthUser(), getOrgContext()]);
  if (!user || !activeOrg) {
    return { error: "No active organization. Try refreshing the page." };
  }

  // Re-validate server-side — never trust the client.
  const valid = validateUploadFile({ name: input.filename, size: input.sizeBytes, type: input.mimeType ?? undefined });
  if (!valid.ok) {
    return { error: valid.error };
  }

  // Reserve the id ourselves so we can build the org-scoped Storage path up
  // front (the path's first segment MUST be the org_id for the RLS to pass).
  const id = crypto.randomUUID();
  const storagePath = storagePathFor(activeOrg.id, id, sanitizeStorageName(input.filename));

  const supabase = await createClient();
  const { error } = await supabase.from("documents").insert({
    id,
    org_id: activeOrg.id,
    uploaded_by: user.id,
    storage_path: storagePath,
    filename: input.filename,
    mime_type: input.mimeType ?? null,
    size_bytes: input.sizeBytes,
    status: "uploaded",
  });

  if (error) {
    logger.error("documents.create_failed", { org_id: activeOrg.id, error: error.message });
    return { error: "Could not save the document. Please try again." };
  }

  revalidatePath(KNOWLEDGE_PATH);
  return { id, storagePath };
}

/** Set a document's tags (org members; RLS scopes to the caller's orgs).
 * Tags are re-normalized server-side — never trust the client's set. */
export async function setDocumentTags(
  id: string,
  tags: string[],
): Promise<{ error?: string; tags?: string[] }> {
  const { activeOrg } = await getOrgContext();
  if (!activeOrg) {
    return { error: "No active organization. Try refreshing the page." };
  }

  const normalized = normalizeTags(Array.isArray(tags) ? tags : []);

  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({ tags: normalized })
    .eq("id", id);

  if (error) {
    logger.error("documents.set_tags_failed", { document_id: id, error: error.message });
    return { error: "Could not update tags. Please try again." };
  }

  revalidatePath(KNOWLEDGE_PATH);
  return { tags: normalized };
}

/** Delete a document: its Storage object first, then the row (chunks cascade). */
export async function deleteDocument(id: string): Promise<{ error?: string }> {
  const [user, { activeOrg }] = await Promise.all([getAuthUser(), getOrgContext()]);
  if (!user || !activeOrg) {
    return { error: "No active organization. Try refreshing the page." };
  }

  const supabase = await createClient();

  // Read the storage path (RLS scopes this to the caller's orgs).
  const { data: doc, error: readErr } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (readErr) {
    logger.error("documents.delete_read_failed", { document_id: id, error: readErr.message });
    return { error: "Could not delete the document. Please try again." };
  }
  if (!doc) {
    return { error: "Document not found." };
  }

  // Remove the bytes first so a row delete never orphans an object. A missing
  // object (e.g. upload never completed) is not an error — proceed to the row.
  const { error: storageErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([doc.storage_path as string]);
  if (storageErr) {
    logger.warn("documents.delete_storage_failed", { document_id: id, error: storageErr.message });
  }

  const { error: rowErr } = await supabase.from("documents").delete().eq("id", id);
  if (rowErr) {
    logger.error("documents.delete_row_failed", { document_id: id, error: rowErr.message });
    return { error: "Could not delete the document. Please try again." };
  }

  revalidatePath(KNOWLEDGE_PATH);
  return {};
}
