/**
 * Day 24 — upload validation. Pure + isomorphic so the drag-drop UI and the
 * server action share one source of truth (never trust the client; the action
 * re-validates). Day 25 (text extraction) supports PDF/DOCX/TXT/MD, so the
 * uploader only accepts those.
 */

/** Max bytes per file. Generous for business docs (SOPs, policies, manuals). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

/** Accepted extensions (lower-case, with dot). The authoritative gate — MIME
 * types are unreliable for .md (often empty/text/plain) and .docx across OSes. */
export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"] as const;

/** MIME types we tag uploads with + advertise via the file input `accept`. */
export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
] as const;

/** `accept` attribute value for the <input type="file"> element. */
export const FILE_INPUT_ACCEPT = [...ACCEPTED_EXTENSIONS, ...ACCEPTED_MIME_TYPES].join(",");

/** Human-readable list for empty-state / error copy. */
export const ACCEPTED_LABEL = "PDF, DOCX, TXT, or MD";

export type UploadCandidate = {
  name: string;
  size: number;
  type?: string;
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

/** Lower-cased extension including the dot, or "" if none. */
export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

/** Validate a single candidate file by extension + size. */
export function validateUploadFile(file: UploadCandidate): ValidationResult {
  const ext = extensionOf(file.name);
  if (!ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])) {
    return { ok: false, error: `Unsupported file type. Accepted: ${ACCEPTED_LABEL}.` };
  }
  if (file.size <= 0) {
    return { ok: false, error: "File is empty." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: `File is too large (max ${formatBytes(MAX_FILE_BYTES)}).` };
  }
  return { ok: true };
}

/**
 * Sanitize a filename for use as the last segment of a Storage object key.
 * Keeps the original on the `documents.filename` column for display; this only
 * affects the storage path. Collapses anything outside [A-Za-z0-9._-] to "_".
 */
export function sanitizeStorageName(filename: string): string {
  const cleaned = filename
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.length > 0 ? cleaned : "file";
}

/** Compact human-readable byte size (e.g. "2.5 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 || Number.isInteger(value) ? 0 : 1)} ${units[i]}`;
}
