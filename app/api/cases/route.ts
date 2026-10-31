import { NextResponse } from "next/server";
import { appendMessage, createCase, getCase } from "@/lib/store";

// POST /api/cases { note? } -> { caseId }
export async function POST(req: Request): Promise<Response> {
  let note: string | null = null;
  try {
    const body = (await req.json()) as { note?: unknown };
    if (typeof body.note === "string" && body.note.trim() !== "") {
      note = body.note.trim().slice(0, 500);
    }
  } catch {
    note = null;
  }
  const record = createCase(note);
  appendMessage(
    record,
    "assistant",
    "Case opened. Upload 1–8 photos or PDFs and I will read them — no retyping needed.",
  );
  return NextResponse.json({ caseId: record.id });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const caseId = url.searchParams.get("caseId") ?? "";
  const record = getCase(caseId);
  if (!record) return NextResponse.json({ error: "Case not found." }, { status: 404 });
  return NextResponse.json({ case: record });
}
