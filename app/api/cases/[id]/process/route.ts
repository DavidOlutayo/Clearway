import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { processPendingFiles } from "@/lib/agent";
import { config } from "@/lib/config";
import {
  LIMIT_MESSAGES,
  VISITOR_COOKIE,
  checkDemoRun,
  getClientIp,
  getVisitorIdFromCookie,
} from "@/lib/ratelimit";
import { appendMessage, getCase } from "@/lib/store";

// POST /api/cases/[id]/process -> runs extraction + cross-check for
// pending files and returns the new chat messages plus case state.
//
// Guards run BEFORE any model work, so blocked calls cost nothing:
// 1. DEMO_LIVE=false pauses all live runs (replay only).
// 2. Per-visitor (10/hour, 30/day) and global (300/day) rate limits.
// Blocked calls answer 429 with a friendly message that is also appended
// to the case chat, plus { replay: true } so the UI offers the replay.
function setVisitorCookie(res: NextResponse, visitorId: string): void {
  res.cookies.set(VISITOR_COOKIE, visitorId, {
    path: "/",
    maxAge: 365 * 24 * 3600,
    sameSite: "lax",
  });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const record = getCase(params.id);

  if (!config.demoLive) {
    if (record) appendMessage(record, "assistant", LIMIT_MESSAGES.paused);
    return NextResponse.json(
      { error: LIMIT_MESSAGES.paused, replay: true, demoLive: false },
      { status: 429 },
    );
  }

  const ip = getClientIp(req);
  let visitorId = getVisitorIdFromCookie(req);
  let isNewVisitor = false;
  if (!visitorId) {
    visitorId = randomUUID();
    isNewVisitor = true;
  }

  const check = await checkDemoRun(visitorId, ip);
  if (!check.allowed) {
    if (record) appendMessage(record, "assistant", check.message);
    const blocked = NextResponse.json({ error: check.message, replay: true }, { status: 429 });
    if (isNewVisitor) setVisitorCookie(blocked, visitorId);
    return blocked;
  }

  try {
    const result = await processPendingFiles(params.id);
    const updated = getCase(params.id);
    const ok = NextResponse.json({ messages: result.messages, timedOut: result.timedOut, case: updated });
    if (isNewVisitor) setVisitorCookie(ok, visitorId);
    return ok;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed.";
    const current = getCase(params.id);
    if (current) {
      appendMessage(current, "assistant", `Something went wrong reading these files: ${message} Your files are saved; try Process again.`);
    }
    const failed = NextResponse.json({ error: message }, { status: 500 });
    if (isNewVisitor) setVisitorCookie(failed, visitorId);
    return failed;
  }
}
