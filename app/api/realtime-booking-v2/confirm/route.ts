import { NextResponse } from "next/server";
import { confirmRealtimeBookingV2Booking } from "@/lib/realtime-booking-v2";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const item = confirmRealtimeBookingV2Booking(String(body.id || ""));
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to confirm booking" },
      { status: 400 }
    );
  }
}
