import { NextResponse } from "next/server";
import { applyUserText } from "@/lib/agent";
import { getCase } from "@/lib/store";

// POST /api/cases/[id]/message { text } -> correction, question or status.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { text?: unknown };
  if (typeof body.text !== "string" || body.text.trim() === "") {
    return NextResponse.json({ error: "Message text is required." }, { status: 400 });
  }
  try {
    const messages = await applyUserText(params.id, body.text.trim().slice(0, 2000));
    const record = getCase(params.id);
    return NextResponse.json({ messages, case: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Message failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
