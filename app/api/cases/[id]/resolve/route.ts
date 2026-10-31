import { NextResponse } from "next/server";
import { resolveDiscrepancy } from "@/lib/agent";
import { getCase } from "@/lib/store";

// POST /api/cases/[id]/resolve { discrepancyId, correctValue, reason? }
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    discrepancyId?: unknown;
    correctValue?: unknown;
    reason?: unknown;
  };
  if (typeof body.discrepancyId !== "string" || typeof body.correctValue !== "string") {
    return NextResponse.json({ error: "discrepancyId and correctValue are required." }, { status: 400 });
  }
  try {
    const messages = resolveDiscrepancy(
      params.id,
      body.discrepancyId,
      body.correctValue.slice(0, 500),
      typeof body.reason === "string" ? body.reason.slice(0, 500) : undefined,
    );
    const record = getCase(params.id);
    return NextResponse.json({ messages, case: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resolve failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
