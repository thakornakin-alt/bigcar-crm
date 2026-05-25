import { NextResponse } from "next/server";
import { syncRealtimeBookingFromGmail } from "@/lib/realtime-gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validateSecret(request: Request) {
  const expected = process.env.REALTIME_BOOKING_WEBHOOK_SECRET;
  if (!expected) return true;
  if (request.headers.get("x-realtime-booking-secret") === expected) return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    if (!validateSecret(request)) {
      return NextResponse.json({ ok: false, error: "Invalid realtime booking sync secret" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await syncRealtimeBookingFromGmail({
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
