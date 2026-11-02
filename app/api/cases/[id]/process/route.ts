import { NextResponse } from "next/server";
import { processPendingFiles } from "@/lib/agent";
import { getCase } from "@/lib/store";

// POST /api/cases/[id]/process -> runs extraction + cross-check for
// pending files and returns the new chat messages plus case state.
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const result = await processPendingFiles(params.id);
    const record = getCase(params.id);
    return NextResponse.json({ messages: result.messages, timedOut: result.timedOut, case: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed.";
    const record = getCase(params.id);
    if (record) {
      const { appendMessage } = await import("@/lib/store");
      appendMessage(record, "assistant", `Something went wrong reading these files: ${message} Your files are saved; try Process again.`);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
