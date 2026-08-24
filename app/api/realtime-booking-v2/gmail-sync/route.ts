import { NextResponse } from "next/server";
import { syncRealtimeBookingV2FromGmail } from "@/lib/realtime-booking-v2";
import { SYSTEM_VERSION_HEADER } from "@/lib/system-version";
import { enqueueAndProcessMatchedRealtimeBookingLines } from "@/lib/realtime-booking-outbox";

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
      const response = NextResponse.json({ ok: false, error: "Invalid realtime booking V2 sync secret" }, { status: 401 });
      response.headers.set("x-system-version", SYSTEM_VERSION_HEADER);
      return response;
    }

    const body = await request.json().catch(() => ({}));
    const result = await syncRealtimeBookingV2FromGmail({
      query: body.query ? String(body.query) : undefined,
      maxResults: body.maxResults ? Number(body.maxResults) : undefined
    });
    let notificationResults: unknown[] = [];
    try { notificationResults = await enqueueAndProcessMatchedRealtimeBookingLines(); }
    catch { console.error(JSON.stringify({ event: "realtime_booking_outbox_process_failed", errorCode: "configuration_error" })); }

    const response = NextResponse.json({ ...result, notificationOutboxProcessed: notificationResults.length });
    response.headers.set("x-system-version", SYSTEM_VERSION_HEADER);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to sync Gmail pricing mail" },
      { status: 500 }
    );
    response.headers.set("x-system-version", SYSTEM_VERSION_HEADER);
    return response;
  }
}
