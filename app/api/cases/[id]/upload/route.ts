import { NextResponse } from "next/server";
import { appendMessage, getCase } from "@/lib/store";
import { savePending, type PendingFile } from "@/lib/pending";

// Fast acknowledgement only: store bytes, reply immediately (PRD F1.3).
// No model work here; the client calls /process next for the report.
const MAX_FILE_BYTES = 12 * 1024 * 1024;

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const record = getCase(params.id);
  if (!record) return NextResponse.json({ error: "Case not found." }, { status: 404 });

  const form = await req.formData();
  const uploads = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (uploads.length === 0) {
    return NextResponse.json({ error: "Upload at least one photo or PDF." }, { status: 400 });
  }

  const accepted: PendingFile[] = [];
  const skipped: string[] = [];
  for (const file of uploads.slice(0, 8)) {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_FILE_BYTES) {
      skipped.push(file.name);
      continue;
    }
    accepted.push({
      fileName: file.name || "upload",
      mimeType: file.type || "application/octet-stream",
      buffer,
    });
  }
  if (uploads.length > 8) {
    for (const file of uploads.slice(8)) skipped.push(file.name);
  }
  if (accepted.length === 0) {
    return NextResponse.json(
      { error: "Files were empty or over 12 MB. Please send smaller copies." },
      { status: 400 },
    );
  }

  savePending(record.id, accepted);
  const ack =
    `Received ${accepted.length} file${accepted.length === 1 ? "" : "s"}. Reading them now — full report within a minute.` +
    (skipped.length > 0 ? ` Skipped ${skipped.length}: ${skipped.join(", ")}.` : "");
  const message = appendMessage(record, "assistant", ack);
  return NextResponse.json({ ack: message, pending: accepted.length, skipped });
}
