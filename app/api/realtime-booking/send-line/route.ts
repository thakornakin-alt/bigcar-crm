import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  void request;
  return NextResponse.json({ ok: false, error: "realtime_booking_legacy_line_disabled" }, { status: 410 });
}
