import { NextResponse } from "next/server";
import { sendRealtimeBookingV2Line } from "@/lib/realtime-booking-v2";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const item = await sendRealtimeBookingV2Line(String(body.id || ""), String(body.targetId || ""), {
      paymentType: body.paymentType === "cash" ? "cash" : "finance",
      saleName: String(body.saleName || "บิ๊ก"),
      remark: String(body.remark || ""),
      discount: Number(body.discount || 0),
      autoSend: Boolean(body.autoSend)
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to send LINE" },
      { status: 400 }
    );
  }
}
