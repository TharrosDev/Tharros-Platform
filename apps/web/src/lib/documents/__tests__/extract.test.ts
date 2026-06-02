import { describe, expect, it } from "vitest";

import { extractText, looksLikeScanned } from "@/lib/documents/extract";

const enc = (s: string) => new TextEncoder().encode(s).buffer;

/**
 * Hermetic coverage for the text/markdown path + the scanned-PDF heuristic.
 * The real PDF (unpdf) and DOCX (mammoth) parse paths are verified by the Day-25
 * manual end-to-end smoke (uploading real files), since committing valid binary
 * fixtures here is brittle.
 */
describe("extractText — plain text", () => {
  it("decodes a .txt file", async () => {
    const res = await extractText({ bytes: enc("Hello Tharros\n"), filename: "notes.txt" });
    expect(res.text).toBe("Hello Tharros");
    expect(res.charCount).toBe("Hello Tharros".length);
    expect(res.pageCount).toBeNull();
    expect(res.needsOcr).toBe(false);
  });

  it("decodes a .md file and normalizes CRLF", async () => {
    const res = await extractText({ bytes: enc("# Title\r\n\r\nBody."), filename: "readme.md" });
    expect(res.text).toBe("# Title\n\nBody.");
    expect(res.needsOcr).toBe(false); // non-PDF never flags OCR
  });

  it("is case-insensitive on the extension", async () => {
    const res = await extractText({ bytes: enc("data"), filename: "NOTES.TXT" });
    expect(res.text).toBe("data");
  });

  it("throws on an unsupported extension", async () => {
    await expect(extractText({ bytes: enc("x"), filename: "image.png" })).rejects.toThrow(
      /Unsupported file type/,
    );
  });

  it("an empty text file does not flag OCR (only PDFs can)", async () => {
    const res = await extractText({ bytes: enc("   \n  "), filename: "blank.txt" });
    expect(res.needsOcr).toBe(false);
    expect(res.charCount).toBe(0);
  });
});

describe("looksLikeScanned", () => {
  it("flags a multi-page PDF with near-empty text", () => {
    expect(looksLikeScanned("", 5)).toBe(true);
    expect(looksLikeScanned("  \n  ", 3)).toBe(true);
    expect(looksLikeScanned("a few stray chars", 50)).toBe(true); // < 10 chars/page over 50 pages
  });

  it("does not flag a PDF with a real text layer", () => {
    const realText = "The quick brown fox. ".repeat(50);
    expect(looksLikeScanned(realText, 2)).toBe(false);
  });

  it("treats an unknown page count as scanned only when text is empty", () => {
    expect(looksLikeScanned("", null)).toBe(true);
    expect(looksLikeScanned("some text", null)).toBe(false);
    expect(looksLikeScanned("", 0)).toBe(true);
  });
});
