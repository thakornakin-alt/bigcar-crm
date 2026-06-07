import { NextResponse } from "next/server";
import { simulateRealtimeBookingV2Price } from "@/lib/realtime-booking-v2";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await simulateRealtimeBookingV2Price({
      plate: String(body.plate || ""),
      rtPrice: Number(body.rtPrice || 0),
      ignoreTtl: Boolean(body.ignoreTtl) && process.env.NODE_ENV !== "production"
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to simulate price" },
      { status: 400 }
    );
  }
}
