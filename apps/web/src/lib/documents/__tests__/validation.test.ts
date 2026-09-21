import { describe, expect, it } from "vitest";

import {
  extensionOf,
  formatBytes,
  MAX_FILE_BYTES,
  sanitizeStorageName,
  validateUploadFile,
} from "@/lib/documents/validation";

describe("validateUploadFile", () => {
  it("accepts each supported extension regardless of MIME", () => {
    for (const name of ["sop.pdf", "policy.docx", "notes.txt", "readme.md"]) {
      expect(validateUploadFile({ name, size: 1024 })).toEqual({ ok: true });
    }
  });

  it("is case-insensitive on the extension", () => {
    expect(validateUploadFile({ name: "REPORT.PDF", size: 1024 })).toEqual({ ok: true });
  });

  it("rejects unsupported types", () => {
    const res = validateUploadFile({ name: "movie.mp4", size: 1024 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Unsupported/);
  });

  it("rejects files with no extension", () => {
    expect(validateUploadFile({ name: "Makefile", size: 1024 }).ok).toBe(false);
  });

  it("rejects empty files", () => {
    const res = validateUploadFile({ name: "empty.txt", size: 0 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/empty/i);
  });

  it("rejects files over the size cap but accepts the boundary", () => {
    expect(validateUploadFile({ name: "big.pdf", size: MAX_FILE_BYTES + 1 }).ok).toBe(false);
    expect(validateUploadFile({ name: "edge.pdf", size: MAX_FILE_BYTES }).ok).toBe(true);
  });
});

describe("extensionOf", () => {
  it("returns the lower-cased extension with the dot", () => {
    expect(extensionOf("a.PDF")).toBe(".pdf");
    expect(extensionOf("archive.tar.gz")).toBe(".gz");
    expect(extensionOf("noext")).toBe("");
  });
});

describe("sanitizeStorageName", () => {
  it("collapses unsafe characters and trims separators", () => {
    expect(sanitizeStorageName("My File (final).pdf")).toBe("My_File_final_.pdf");
    // Path separators become "_", so the result is a single safe segment that
    // cannot traverse (dots are kept — they're needed for the extension).
    expect(sanitizeStorageName("../../etc/passwd")).toBe(".._.._etc_passwd");
  });

  it("never returns an empty string", () => {
    expect(sanitizeStorageName("***")).toBe("file");
  });
});

describe("formatBytes", () => {
  it("formats across units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(25 * 1024 * 1024)).toBe("25 MB");
  });
});
