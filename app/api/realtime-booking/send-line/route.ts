import { NextResponse } from "next/server";
import { sendQueueLine } from "@/lib/realtime-booking";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const item = await sendQueueLine(String(body.id || ""), String(body.targetId || ""));
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to send LINE" },
      { status: 400 }
    );
  }
}
