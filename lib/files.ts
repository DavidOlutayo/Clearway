import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";

export const MAX_FILES_PER_CASE = 8;

// Backstop: a file can hold several logical documents, but the model
// must not turn one upload into an unbounded document list.
export const MAX_DOCS_PER_FILE = 5;

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

// PDF handling: robust text-stream decoding via pdf-parse (handles
// compressed object streams in standard PDFs, which a byte scan cannot
// read). Falls back to a naive scan when parsing itself fails.
export function extractPdfTextNaive(buffer: Buffer): string {
  const text = buffer
    .toString("utf8")
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/[ \t]+/g, " ");
  return text.slice(0, 20000);
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Copy: the parser may take ownership of (detach) the passed array.
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      const text = (result.text ?? "").trim();
      if (text.replace(/\s/g, "").length > 0) return text.slice(0, 20000);
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  } catch {
    // Fall through to the naive scan below.
  }
  return extractPdfTextNaive(buffer);
}

export function toDataUrl(mimeType: string, buffer: Buffer): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
