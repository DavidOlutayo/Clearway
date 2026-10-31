import { createHash } from "node:crypto";

export const MAX_FILES_PER_CASE = 8;

const SUPPORTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

export function isSupportedMime(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.has(mimeType.toLowerCase());
}

export function isImageMime(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("image/");
}

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

// Slice 1 PDF handling: naive text scan, no custom OCR. Scanned PDFs
// with no embedded text come back nearly empty and are flagged
// unreadable so the user sends photos instead (PRD edge case 1).
export function extractPdfTextNaive(buffer: Buffer): string {
  const text = buffer
    .toString("utf8")
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/[ \t]+/g, " ");
  return text.slice(0, 20000);
}

export function looksUnreadablePdf(buffer: Buffer): boolean {
  const text = extractPdfTextNaive(buffer).trim();
  return text.replace(/\s/g, "").length < 50;
}

export function toDataUrl(mimeType: string, buffer: Buffer): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
