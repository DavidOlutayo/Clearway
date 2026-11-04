import { NextResponse } from "next/server";
import { config } from "@/lib/config";

// GET /api/demo-status -> { demoLive }. The landing page is a client
// component and cannot read server env directly, so it asks here whether
// to offer live runs or replay only.
export async function GET(): Promise<Response> {
  return NextResponse.json({ demoLive: config.demoLive });
}
