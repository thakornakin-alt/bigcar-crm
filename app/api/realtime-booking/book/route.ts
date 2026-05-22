import { NextResponse } from "next/server";
import { markBooked } from "@/lib/realtime-booking";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const item = markBooked(String(body.id || ""));
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to mark booked" },
      { status: 400 }
    );
  }
}
