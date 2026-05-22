import { NextResponse } from "next/server";
import { cancelQueue } from "@/lib/realtime-booking";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const item = cancelQueue(String(body.id || ""), String(body.reason || ""));
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to cancel queue" },
      { status: 400 }
    );
  }
}
