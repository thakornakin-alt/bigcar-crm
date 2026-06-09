import { NextResponse } from "next/server";
import { autoSyncRealtimeBookingV2FromGmail } from "@/lib/realtime-booking-v2";
import { SYSTEM_VERSION_HEADER } from "@/lib/system-version";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validateSecret(request: Request) {
  const expected = process.env.AUTO_SYNC_SECRET || "AUTO_SYNC_SECRET";
  if (!expected) return false;
  const headerSecret =
    request.headers.get("x-auto-sync-secret") ||
    request.headers.get("x-realtime-booking-secret") ||
    "";
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") || "";
  const origin = request.headers.get("origin") || "";
  const sameOrigin = origin.includes("bigcar-crm.vercel.app") || origin.includes("localhost") || origin.includes("127.0.0.1");
  return headerSecret === expected || querySecret === expected || sameOrigin;
}

export async function POST(request: Request) {
  try {
    if (!validateSecret(request)) {
      const response = NextResponse.json({ ok: false, error: "Invalid realtime booking V2 sync secret" }, { status: 401 });
      response.headers.set("x-system-version", SYSTEM_VERSION_HEADER);
      return response;
    }

    const body = await request.json().catch(() => ({}));
    const result = await autoSyncRealtimeBookingV2FromGmail({
      query: body.query ? String(body.query) : undefined,
      maxResults: body.maxResults ? Number(body.maxResults) : undefined
    });

    const response = NextResponse.json(result);
    response.headers.set("x-system-version", SYSTEM_VERSION_HEADER);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to auto sync Gmail pricing mail" },
      { status: 500 }
    );
    response.headers.set("x-system-version", SYSTEM_VERSION_HEADER);
    return response;
  }
}
