import { NextResponse } from "next/server";
import {
  cancelBookingDelivery,
  getLastBookingDeliveryTiming,
  listBookingDeliveryRecords,
  syncBookingDeliveryFromReportHistory,
  updateBookingDeliveryRecord
} from "@/lib/booking-delivery";
import { getLastJsonStoreTiming } from "@/lib/json-store";
import type { BookingDeliveryStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function timingLog(step: string, data: Record<string, unknown>) {
  console.info(`[booking-delivery-timing] ${step}`, data);
}

function timingHeaders(count: number, totalStart: number) {
  const bookingTiming = getLastBookingDeliveryTiming();
  const jsonTiming = getLastJsonStoreTiming();
  const provider = bookingTiming.provider || jsonTiming.provider || String(process.env.BIG_CAR_STORE_PROVIDER || "json").trim().toLowerCase();
  const readMs = bookingTiming.readMs || jsonTiming.readMs || 0;
  return {
    "x-booking-delivery-provider": provider,
    "x-booking-delivery-read-ms": String(readMs),
    "x-booking-delivery-count": String(count),
    "x-booking-delivery-total-ms": String(Date.now() - totalStart)
  };
}

function toStatus(value: unknown): BookingDeliveryStatus | undefined {
  const text = String(value || "").trim();
  if (text === "ยอดจอง") return text;
  if (text === "รอผลไฟแนนซ์") return text;
  if (text === "รอส่งมอบ") return text;
  if (text === "ยอดส่งมอบ") return text;
  if (text === "ยกเลิก") return text;
  return undefined;
}

function toWorkflowStatus(value: unknown): BookingDeliveryStatus | "" | undefined {
  const text = String(value || "").trim();
  if (text === "ยอดจอง") return text;
  if (text === "รอผลไฟแนนซ์") return text;
  if (text === "รอส่งมอบ") return text;
  if (text === "ยอดส่งมอบ") return text;
  if (text === "ยกเลิก") return text;
  if (!text) return "";
  return undefined;
}

export async function GET(request: Request) {
  const totalStart = Date.now();
  const provider = String(process.env.BIG_CAR_STORE_PROVIDER || "json").trim().toLowerCase();
  try {
    timingLog("start GET /api/booking-delivery", {
      ts: totalStart,
      provider
    });
    const url = new URL(request.url);
    const querySync = url.searchParams.get("sync");
    const shouldSync = url.searchParams.get("sync") === "1" || url.searchParams.get("sync") === "true";
    timingLog("parse query", { sync: querySync || "", shouldSync });

    const listStart = Date.now();
    const records = shouldSync ? await syncBookingDeliveryFromReportHistory() : await listBookingDeliveryRecords();
    timingLog(shouldSync ? "syncBookingDeliveryFromReportHistory()" : "listBookingDeliveryRecords()", {
      ms: Date.now() - listStart,
      count: Array.isArray(records) ? records.length : 0
    });

    timingLog("total response time", {
      ms: Date.now() - totalStart,
      count: Array.isArray(records) ? records.length : 0
    });
    return NextResponse.json(
      { records },
      {
        headers: timingHeaders(Array.isArray(records) ? records.length : 0, totalStart)
      }
    );
  } catch (error) {
    timingLog("GET error", {
      ms: Date.now() - totalStart,
      error: error instanceof Error ? error.message : "unknown"
    });
    const isSupabase = provider === "supabase";
    const records = isSupabase ? [] : await listBookingDeliveryRecords().catch(() => []);
    const message =
      error instanceof Error
        ? error.message
        : "โหลด Booking Delivery ไม่สำเร็จ";
    return NextResponse.json(
      {
        records,
        error: message,
        warning: message
      },
      {
        status: isSupabase ? 503 : 200,
        headers: timingHeaders(records.length, totalStart)
      }
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

    const rawStatus = String(body.status || "").trim();
    const status = toStatus(rawStatus);
    if (rawStatus === "ยกเลิก") {
      const record = await cancelBookingDelivery(id, String(body.cancelReason || "").trim() || "ผู้ใช้ยกเลิกรายการ");
      return NextResponse.json({ record });
    }

    const record = await updateBookingDeliveryRecord({
      id,
      status: status === "ยกเลิก" ? "ยกเลิก" : undefined,
      workflowStatus: toWorkflowStatus(body.workflowStatus ?? body.status),
      deliveryDate: String(body.deliveryDate || "").trim(),
      deliveryLocation: String(body.deliveryLocation || "").trim(),
      garageOutDate: String(body.garageOutDate || "").trim(),
      garageReturnDate: String(body.garageReturnDate || "").trim(),
      spaFullSystemDone: typeof body.spaFullSystemDone === "boolean" ? body.spaFullSystemDone : undefined,
      oilChangeDone: typeof body.oilChangeDone === "boolean" ? body.oilChangeDone : undefined,
      decalRemovalDone: typeof body.decalRemovalDone === "boolean" ? body.decalRemovalDone : undefined,
      insuranceDone: typeof body.insuranceDone === "boolean" ? body.insuranceDone : undefined,
      financeCaseSubmitted: typeof body.financeCaseSubmitted === "boolean" ? body.financeCaseSubmitted : undefined,
      financeCaseSubmittedAt: String(body.financeCaseSubmittedAt || "").trim(),
      financeCaseNote: String(body.financeCaseNote || "").trim(),
      financeAttachmentIds: Array.isArray(body.financeAttachmentIds) ? body.financeAttachmentIds.map((item) => String(item || "").trim()).filter(Boolean) : undefined,
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
