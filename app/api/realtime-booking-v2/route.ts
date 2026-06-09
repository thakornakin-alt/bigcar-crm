import { NextResponse } from "next/server";
import { createRealtimeBookingV2Queue, ensureRealtimeBookingV2Store, getRealtimeBookingV2Dashboard } from "@/lib/realtime-booking-v2";
import { SYSTEM_VERSION_HEADER } from "@/lib/system-version";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureRealtimeBookingV2Store();
  const response = NextResponse.json(await getRealtimeBookingV2Dashboard());
  response.headers.set("x-system-version", SYSTEM_VERSION_HEADER);
  return response;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const item = await createRealtimeBookingV2Queue({
      plate: String(body.plate || ""),
      customerName: String(body.customerName || ""),
      paymentType: body.paymentType === "cash" ? "cash" : "finance",
      saleName: String(body.saleName || "บิ๊ก"),
      remark: String(body.remark || ""),
      discount: Number(body.discount || 0)
    });
    const response = NextResponse.json({ ok: true, item });
    response.headers.set("x-system-version", SYSTEM_VERSION_HEADER);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to create queue" },
      { status: 400 }
    );
    response.headers.set("x-system-version", SYSTEM_VERSION_HEADER);
    return response;
  }
}
