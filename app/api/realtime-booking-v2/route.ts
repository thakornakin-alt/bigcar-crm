import { NextResponse } from "next/server";
import { createRealtimeBookingV2Queue, getRealtimeBookingV2Dashboard } from "@/lib/realtime-booking-v2";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getRealtimeBookingV2Dashboard());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const item = createRealtimeBookingV2Queue({
      plate: String(body.plate || ""),
      customerName: String(body.customerName || ""),
      paymentType: body.paymentType === "cash" ? "cash" : "finance",
      saleName: String(body.saleName || "บิ๊ก"),
      remark: String(body.remark || ""),
      discount: Number(body.discount || 0)
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to create queue" },
      { status: 400 }
    );
  }
}
