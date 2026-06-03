/**
 * Day 31 — pure helpers for exporting a generated draft. The clipboard write and
 * the Blob/anchor download trigger are browser-only and live inline in the
 * client component (`components/assistant/message-actions.tsx`); only the
 * deterministic, testable string logic lives here.
 */

/**
 * Slug a human label into a safe download filename, e.g.
 * `draftFilename("Draft email", "md")` → `"draft-email.md"`. Falls back to
 * `"draft"` when the label has no usable characters.
 */
export function draftFilename(label: string, ext: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const cleanExt = ext.replace(/^\.+/, "");
  return `${slug || "draft"}.${cleanExt}`;
}
