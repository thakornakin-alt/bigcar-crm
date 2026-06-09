import { NextResponse } from "next/server";
import { ensureRealtimeBookingV2Store, confirmRealtimeBookingV2Booking } from "@/lib/realtime-booking-v2";
import { upsertBookingDeliveryFromRealtimeBookingV2 } from "@/lib/realtime-booking-to-delivery";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await ensureRealtimeBookingV2Store();
    const item = await confirmRealtimeBookingV2Booking(String(body.id || ""));
    let warning = "";
    try {
      const result = await upsertBookingDeliveryFromRealtimeBookingV2(item);
      if (!result.stockFound) {
        warning = "บันทึก Booking Delivery แล้ว แต่ยังไม่พบ stock snapshot";
      }
    } catch (deliveryError) {
      warning = deliveryError instanceof Error ? deliveryError.message : "บันทึก Booking Delivery ไม่สำเร็จ";
      console.error("[realtime-booking-v2/confirm] booking delivery upsert failed", deliveryError);
    }
    return NextResponse.json({ ok: true, item, warning });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to confirm booking" },
      { status: 400 }
    );
  }
}
