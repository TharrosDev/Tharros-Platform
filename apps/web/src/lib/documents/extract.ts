// NOTE: deliberately NOT `import "server-only"` — this is pure parsing logic with
// no secrets, and the Day-25 extract test imports it (server-only throws under
// Vitest; see gotcha #35). The Node-only libs below keep it server-side in
// practice; the API route is its only runtime caller.
import JSZip from "jszip";
import mammoth from "mammoth";
import { extractText as unpdfExtractText, getDocumentProxy } from "unpdf";

import { extensionOf, IMAGE_EXTENSIONS } from "@/lib/documents/validation";

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

const ZIP_EXTENSIONS = [".docx", ".xlsx", ".pptx"];

function assertExpectedSignature(ext: string, bytes: ArrayBuffer | Buffer): void {
  const buffer = toBuffer(bytes);
  if (ext === ".pdf" && buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("File contents do not match the PDF extension.");
  }
  if (ext === ".png" && buffer.subarray(1, 4).toString("ascii") !== "PNG") {
    throw new Error("File contents do not match the PNG extension.");
  }
  if ((ext === ".jpg" || ext === ".jpeg") && !(buffer[0] === 0xff && buffer[1] === 0xd8)) {
    throw new Error("File contents do not match the JPEG extension.");
  }
  if (ext === ".webp" && buffer.subarray(8, 12).toString("ascii") !== "WEBP") {
    throw new Error("File contents do not match the WEBP extension.");
  }
  if (ZIP_EXTENSIONS.includes(ext)) {
    const zipSignature =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
        (buffer[2] === 0x05 && buffer[3] === 0x06) ||
        (buffer[2] === 0x07 && buffer[3] === 0x08));
    if (!zipSignature) {
      throw new Error(`File contents do not match the ${ext.slice(1).toUpperCase()} extension.`);
    }
  }
}

async function extractPdf(
  bytes: ArrayBuffer | Buffer,
): Promise<{ text: string; pageCount: number }> {
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

/** Cap on total decompressed XML read from an Office zip — guards against zip bombs. */
const MAX_ZIP_XML_BYTES = 50 * 1024 * 1024;

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

/** Numbered zip entries (slide1.xml, sheet2.xml…) in numeric order, size-guarded. */
async function readNumberedXml(zip: JSZip, pattern: RegExp): Promise<string[]> {
  const entries = Object.values(zip.files)
    .filter((f) => pattern.test(f.name))
    .sort((a, b) => Number(a.name.match(pattern)![1]) - Number(b.name.match(pattern)![1]));
  let total = 0;
  const out: string[] = [];
  for (const f of entries) {
    // ponytail: jszip exposes uncompressed size only on the private _data; enough for a bomb guard.
    total +=
      (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    if (total > MAX_ZIP_XML_BYTES) throw new Error("Document is too large to read.");
    out.push(await f.async("string"));
  }
  return out;
}

async function extractPptx(bytes: ArrayBuffer | Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(toBuffer(bytes));
  const slides = await readNumberedXml(zip, /^ppt\/slides\/slide(\d+)\.xml$/);
  return slides
    .map((xml, i) => {
      const paragraphs = xml
        .split("</a:p>")
        .map((p) => decodeXml([...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join("")))
        .filter((p) => p.trim());
      return `## Slide ${i + 1}\n${paragraphs.join("\n")}`;
    })
    .join("\n\n");
}

async function extractXlsx(bytes: ArrayBuffer | Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(toBuffer(bytes));
  const sharedXml = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    decodeXml([...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join("")),
  );
  const workbook = (await zip.file("xl/workbook.xml")?.async("string")) ?? "";
  const names = [...workbook.matchAll(/<sheet [^>]*name="([^"]*)"/g)].map((m) => decodeXml(m[1]));
  const sheets = await readNumberedXml(zip, /^xl\/worksheets\/sheet(\d+)\.xml$/);
  return sheets
    .map((xml, i) => {
      const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((row) =>
        [...row[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)]
          .map(([, attrs, body = ""]) => {
            const v = body.match(/<v>([^<]*)<\/v>/)?.[1];
            if (/t="s"/.test(attrs) && v !== undefined) return shared[Number(v)] ?? "";
            const inline = body.match(/<t[^>]*>([^<]*)<\/t>/)?.[1];
            return decodeXml(inline ?? v ?? "");
          })
          .join(" | "),
      );
      const body = rows.filter((r) => r.replace(/[ |]/g, "")).join("\n");
      return `## ${names[i] ?? `Sheet ${i + 1}`}\n${body}`;
    })
    .join("\n\n");
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
  } else if (ext === ".pptx") {
    text = await extractPptx(input.bytes);
  } else if (ext === ".xlsx") {
    text = await extractXlsx(input.bytes);
  } else if (ext === ".txt" || ext === ".md" || ext === ".csv") {
    text = extractPlain(input.bytes);
  } else if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
    // No text layer — the caller routes images straight to OCR.
    return { text: "", charCount: 0, pageCount: 1, needsOcr: true };
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
