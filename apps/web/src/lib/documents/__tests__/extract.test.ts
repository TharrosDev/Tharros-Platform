import { describe, expect, it } from "vitest";

import { extractText, looksLikeScanned, MAX_EXTRACTED_CHARS } from "@/lib/documents/extract";

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
    await expect(extractText({ bytes: enc("x"), filename: "movie.mp4" })).rejects.toThrow(
      /Unsupported file type/,
    );
  });

  it("rejects extension/content mismatches before parser work", async () => {
    await expect(extractText({ bytes: enc("not a pdf"), filename: "fake.pdf" })).rejects.toThrow(
      /do not match the PDF extension/,
    );
    await expect(extractText({ bytes: enc("not a zip"), filename: "fake.docx" })).rejects.toThrow(
      /do not match the DOCX extension/,
    );
  });

  it("caps extracted text before embedding amplification", async () => {
    await expect(
      extractText({
        bytes: enc("x".repeat(MAX_EXTRACTED_CHARS + 1)),
        filename: "huge.txt",
      }),
    ).rejects.toThrow(/too large/);
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

describe("extractText — office + images", () => {
  // Minimal zips built in-test: only the parts the extractors read.
  async function zip(files: Record<string, string>): Promise<ArrayBuffer> {
    const JSZip = (await import("jszip")).default;
    const z = new JSZip();
    for (const [name, body] of Object.entries(files)) z.file(name, body);
    return z.generateAsync({ type: "arraybuffer" });
  }

  it("reads PPTX slides in numeric order with paragraphs", async () => {
    const slide = (t: string) =>
      `<p:sld><a:p><a:r><a:t>${t}</a:t></a:r></a:p><a:p><a:r><a:t>more</a:t></a:r></a:p></p:sld>`;
    const bytes = await zip({
      "ppt/slides/slide10.xml": slide("Ten"),
      "ppt/slides/slide2.xml": slide("Two &amp; half"),
    });
    const res = await extractText({ bytes, filename: "deck.pptx" });
    expect(res.text).toBe("## Slide 1\nTwo & half\nmore\n\n## Slide 2\nTen\nmore");
  });

  it("reads XLSX shared + inline strings and numbers per sheet", async () => {
    const bytes = await zip({
      "xl/workbook.xml": `<workbook><sheets><sheet name="Prices" sheetId="1"/></sheets></workbook>`,
      "xl/sharedStrings.xml": `<sst><si><t>Plan</t></si><si><t>Pro</t></si></sst>`,
      "xl/worksheets/sheet1.xml": `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Price</t></is></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>499</v></c></row></sheetData></worksheet>`,
    });
    const res = await extractText({ bytes, filename: "prices.xlsx" });
    expect(res.text).toBe("## Prices\nPlan | Price\nPro | 499");
  });

  it("reads CSV as text", async () => {
    const res = await extractText({ bytes: enc("a,b\n1,2"), filename: "t.csv" });
    expect(res.text).toBe("a,b\n1,2");
  });

  it("routes images to OCR and checks the signature", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]).buffer;
    const res = await extractText({ bytes: png, filename: "scan.png" });
    expect(res.needsOcr).toBe(true);
    await expect(extractText({ bytes: enc("not a png"), filename: "x.png" })).rejects.toThrow(
      /PNG/,
    );
  });

  it("rejects a non-zip PPTX", async () => {
    await expect(extractText({ bytes: enc("nope"), filename: "d.pptx" })).rejects.toThrow(/PPTX/);
  });
});
