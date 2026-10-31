import { NextResponse } from "next/server";
import { getCase, listEvents } from "@/lib/store";

// GET /api/cases/[id] -> full case state for the chat adapter.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const record = getCase(params.id);
  if (!record) return NextResponse.json({ error: "Case not found." }, { status: 404 });
  return NextResponse.json({ case: record, events: listEvents(params.id) });
}
