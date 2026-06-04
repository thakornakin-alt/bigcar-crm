import { NextResponse } from "next/server";
import {
  cancelBookingDelivery,
  listBookingDeliveryRecords,
  syncBookingDeliveryFromReportHistory,
  updateBookingDeliveryRecord
} from "@/lib/booking-delivery";
import type { BookingDeliveryStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function toStatus(value: unknown): BookingDeliveryStatus | undefined {
  const text = String(value || "").trim();
  if (text === "ติดจองรอคอนเฟิร์ม") return text;
  if (text === "พร้อมส่งมอบ") return text;
  if (text === "ส่งมอบแล้ว") return text;
  if (text === "ยกเลิก") return text;
  return undefined;
}

export async function GET() {
  try {
    const records = await syncBookingDeliveryFromReportHistory();
    return NextResponse.json({ records });
  } catch (error) {
    const records = await listBookingDeliveryRecords().catch(() => []);
    return NextResponse.json(
      {
        records,
        warning: error instanceof Error ? error.message : "โหลด Booking Delivery ไม่สำเร็จ"
      },
      { status: 200 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || body.bookingId || "").trim();
    if (!id) {
      return NextResponse.json({ error: "ไม่พบ Booking Delivery ที่ต้องการแก้ไข" }, { status: 400 });
    }

    const status = toStatus(body.status);
    if (status === "ยกเลิก") {
      const record = await cancelBookingDelivery(id, String(body.cancelReason || "").trim() || "ผู้ใช้ยกเลิกรายการ");
      return NextResponse.json({ record });
    }

    const record = await updateBookingDeliveryRecord({
      id,
      status,
      deliveryDate: String(body.deliveryDate || "").trim(),
      deliveryLocation: String(body.deliveryLocation || "").trim(),
      alertSummary: String(body.alertSummary || "").trim(),
      cancelReason: String(body.cancelReason || "").trim()
    });
    return NextResponse.json({ record });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "บันทึก Booking Delivery ไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
