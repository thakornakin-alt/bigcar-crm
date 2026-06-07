import { NextResponse } from "next/server";
import { syncRealtimeBookingV2FromGmail } from "@/lib/realtime-booking-v2";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validateSecret(request: Request) {
  const expected = process.env.REALTIME_BOOKING_WEBHOOK_SECRET;
  if (!expected) return true;
  return request.headers.get("x-realtime-booking-secret") === expected;
}

export async function POST(request: Request) {
  try {
    if (!validateSecret(request)) {
      return NextResponse.json({ ok: false, error: "Invalid realtime booking V2 sync secret" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await syncRealtimeBookingV2FromGmail({
      query: body.query ? String(body.query) : undefined,
      maxResults: body.maxResults ? Number(body.maxResults) : undefined
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to sync Gmail pricing mail" },
      { status: 500 }
    );
  }
}
