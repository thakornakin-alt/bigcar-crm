import { NextResponse } from "next/server";
import { ensureRealtimeBookingV2Store, markRealtimeBookingV2Done } from "@/lib/realtime-booking-v2";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await ensureRealtimeBookingV2Store();
    const item = await markRealtimeBookingV2Done(String(body.id || ""));
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to mark DONE" },
      { status: 400 }
    );
  }
}
