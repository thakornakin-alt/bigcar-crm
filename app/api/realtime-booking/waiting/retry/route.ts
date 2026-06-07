import { NextResponse } from "next/server";
import { retryWaitingQueueMatch } from "@/lib/realtime-booking";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const item = retryWaitingQueueMatch(String(body.id || ""));
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to retry match" },
      { status: 400 }
    );
  }
}
