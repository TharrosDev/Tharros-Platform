// NOTE: deliberately NOT `import "server-only"` — this is pure parsing logic with
// no secrets, and the Day-25 extract test imports it (server-only throws under
// Vitest; see gotcha #35). The Node-only libs below keep it server-side in
// practice; the API route is its only runtime caller.
import mammoth from "mammoth";
import { extractText as unpdfExtractText, getDocumentProxy } from "unpdf";

import { extensionOf } from "@/lib/documents/validation";

/**
 * Day 25 — text extraction. Turns uploaded bytes (PDF/DOCX/TXT/MD) into plain
 * text for the Day-26 chunk/embed step. Pure-JS, serverless-friendly libs:
 * `unpdf` (bundled pdfjs) for PDF, `mammoth` for DOCX, native decode for text.
 *
 * Scanned / image-only PDFs yield ~no extractable text — `needsOcr` flags those
 * so the caller can park them at status `needs_ocr` for a future OCR pass
 * (Tesseract, deferred) rather than treating them as a hard failure.
 */

export type ExtractResult = {
  text: string;
  charCount: number;
  pageCount: number | null;
  needsOcr: boolean;
};

/** Minimum non-whitespace chars per page below which a PDF is treated as
 * scanned/garbage (no real text layer). Tuned low to avoid false positives on
 * sparse-but-real pages (e.g. a title page). */
const MIN_CHARS_PER_PAGE = 10;

/** Bound parser/embedding amplification from compressed or pathologically large files. */
export const MAX_EXTRACTED_CHARS = 500_000;
export const MAX_PDF_PAGES = 300;

/** Pure heuristic: does this PDF extraction look like a scanned/image-only doc? */
export function looksLikeScanned(text: string, pageCount: number | null): boolean {
  if (!pageCount || pageCount <= 0) {
    return text.trim().length === 0;
  }
  const nonWhitespace = text.replace(/\s+/g, "").length;
  return nonWhitespace < MIN_CHARS_PER_PAGE * pageCount;
}

function toBuffer(bytes: ArrayBuffer | Buffer): Buffer {
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
}

function assertExpectedSignature(ext: string, bytes: ArrayBuffer | Buffer): void {
  const buffer = toBuffer(bytes);
  if (ext === ".pdf" && buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("File contents do not match the PDF extension.");
  }
  if (ext === ".docx") {
    const zipSignature =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
        (buffer[2] === 0x05 && buffer[3] === 0x06) ||
        (buffer[2] === 0x07 && buffer[3] === 0x08));
    if (!zipSignature) {
      throw new Error("File contents do not match the DOCX extension.");
    }
  }
}

async function extractPdf(bytes: ArrayBuffer | Buffer): Promise<{ text: string; pageCount: number }> {
  // unpdf wants a Uint8Array; getDocumentProxy + extractText gives merged text + total pages.
  const data = new Uint8Array(toBuffer(bytes));
  const pdf = await getDocumentProxy(data);
  if (pdf.numPages > MAX_PDF_PAGES) {
    throw new Error(`PDF has too many pages (max ${MAX_PDF_PAGES}).`);
  }
  // mergePages: true → `text` is a single merged string.
  const { totalPages, text } = await unpdfExtractText(pdf, { mergePages: true });
  return { text, pageCount: totalPages };
}

async function extractDocx(bytes: ArrayBuffer | Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: toBuffer(bytes) });
  return value;
}

function extractPlain(bytes: ArrayBuffer | Buffer): string {
  return new TextDecoder("utf-8").decode(toBuffer(bytes));
}

/**
 * Extract text from an uploaded document. Throws on a genuine parse error (the
 * caller maps that to status `failed`); returns `needsOcr: true` for a PDF with
 * no usable text layer.
 */
export async function extractText(input: {
  bytes: ArrayBuffer | Buffer;
  filename: string;
  mimeType?: string | null;
}): Promise<ExtractResult> {
  const ext = extensionOf(input.filename);
  assertExpectedSignature(ext, input.bytes);

  let text = "";
  let pageCount: number | null = null;

  if (ext === ".pdf") {
    const res = await extractPdf(input.bytes);
    text = res.text;
    pageCount = res.pageCount;
  } else if (ext === ".docx") {
    text = await extractDocx(input.bytes);
  } else if (ext === ".txt" || ext === ".md") {
    text = extractPlain(input.bytes);
  } else {
    throw new Error(`Unsupported file type for extraction: ${ext || "(none)"}`);
  }

  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length > MAX_EXTRACTED_CHARS) {
    throw new Error(
      `Extracted document is too large (max ${MAX_EXTRACTED_CHARS.toLocaleString()} characters).`,
    );
  }
  const needsOcr = ext === ".pdf" && looksLikeScanned(normalized, pageCount);

  return {
    text: normalized,
    charCount: normalized.length,
    pageCount,
    needsOcr,
  };
}
