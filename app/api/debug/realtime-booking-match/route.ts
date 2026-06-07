import { NextResponse } from "next/server";
import { inspectRealtimeBookingMatch } from "@/lib/realtime-booking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Debug endpoint disabled in production" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const plate = String(searchParams.get("plate") || "").trim();
  if (!plate) {
    return NextResponse.json({ ok: false, error: "Missing plate" }, { status: 400 });
  }

  const result = await inspectRealtimeBookingMatch(plate);
  return NextResponse.json(result);
}
