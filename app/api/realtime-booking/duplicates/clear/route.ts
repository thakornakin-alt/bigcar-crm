import { NextResponse } from "next/server";
import { clearDuplicateQueuesByPlate } from "@/lib/realtime-booking";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = clearDuplicateQueuesByPlate(String(body.id || ""));
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to clear duplicate queues" },
      { status: 400 }
    );
  }
}
