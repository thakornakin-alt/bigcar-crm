import { NextResponse } from "next/server";
import {
  getLastBookingDeliveryTiming,
  listBookingDeliveryRecords,
  listBookingDeliveryRecordsWithRevision,
  syncBookingDeliveryFromReportHistory,
  updateBookingDeliveryRecord
} from "@/lib/booking-delivery";
import { getLastJsonStoreTiming } from "@/lib/json-store";
import type { BookingDeliveryStatus } from "@/lib/types";
import { recordActivity } from "@/lib/activity-log";
import { getRddFeatureFlags } from "@/lib/feature-flags";
import { filterByOwnership, ownershipScope } from "@/lib/rdd-ownership";
import { getRequestSalesUser, RequestAuthError, requireUser, requireWritableUser } from "@/lib/request-user";

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
    const actor = getRddFeatureFlags().authEnforcement ? await requireUser() : await getRequestSalesUser();
    timingLog("start GET /api/booking-delivery", {
      ts: totalStart,
      provider
    });
    const url = new URL(request.url);
    const querySync = url.searchParams.get("sync");
    const shouldSync = url.searchParams.get("sync") === "1" || url.searchParams.get("sync") === "true";
    timingLog("parse query", { sync: querySync || "", shouldSync });

    const listStart = Date.now();
    const snapshot = shouldSync ? null : await listBookingDeliveryRecordsWithRevision();
    const allRecords = shouldSync ? await syncBookingDeliveryFromReportHistory() : snapshot!.records;
    const scope = ownershipScope(url.searchParams.get("scope"));
    const records = scope === "mine" && !actor
      ? []
      : filterByOwnership(allRecords, scope, actor?.id || "");
    timingLog(shouldSync ? "syncBookingDeliveryFromReportHistory()" : "listBookingDeliveryRecords()", {
      ms: Date.now() - listStart,
      count: Array.isArray(records) ? records.length : 0
    });

    timingLog("total response time", {
      ms: Date.now() - totalStart,
      count: Array.isArray(records) ? records.length : 0
    });
    return NextResponse.json(
      { records, revision: snapshot?.revision },
      {
        headers: timingHeaders(Array.isArray(records) ? records.length : 0, totalStart)
      }
    );
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
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
    const actor = await requireWritableUser();
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || body.bookingId || "").trim();
    if (!id) {
      return NextResponse.json({ error: "ไม่พบ Booking Delivery ที่ต้องการแก้ไข" }, { status: 400 });
    }

    const rawStatus = String(body.status || "").trim();
    const status = toStatus(rawStatus);
    const record = await updateBookingDeliveryRecord({
      id,
      status: status === "ยกเลิก" ? "ยกเลิก" : undefined,
      workflowStatus: toWorkflowStatus(body.workflowStatus ?? body.status),
      bookingDate: body.bookingDate === undefined ? undefined : String(body.bookingDate || "").trim(),
      isCounted: typeof body.isCounted === "boolean" ? body.isCounted : undefined,
      deliveryDate: body.deliveryDate === undefined ? undefined : String(body.deliveryDate || "").trim(),
      deliveryLocation: body.deliveryLocation === undefined ? undefined : String(body.deliveryLocation || "").trim(),
      garageOutDate: body.garageOutDate === undefined ? undefined : String(body.garageOutDate || "").trim(),
      garageReturnDate: body.garageReturnDate === undefined ? undefined : String(body.garageReturnDate || "").trim(),
      spaFullSystemDone: typeof body.spaFullSystemDone === "boolean" ? body.spaFullSystemDone : undefined,
      oilChangeDone: typeof body.oilChangeDone === "boolean" ? body.oilChangeDone : undefined,
      decalRemovalDone: typeof body.decalRemovalDone === "boolean" ? body.decalRemovalDone : undefined,
      insuranceDone: typeof body.insuranceDone === "boolean" ? body.insuranceDone : undefined,
      financeCaseSubmitted: typeof body.financeCaseSubmitted === "boolean" ? body.financeCaseSubmitted : undefined,
      financeCaseSubmittedAt: body.financeCaseSubmittedAt === undefined ? undefined : String(body.financeCaseSubmittedAt || "").trim(),
      financeCaseNote: body.financeCaseNote === undefined ? undefined : String(body.financeCaseNote || "").trim(),
      financeAttachmentIds: Array.isArray(body.financeAttachmentIds) ? body.financeAttachmentIds.map((item) => String(item || "").trim()).filter(Boolean) : undefined,
      alertSummary: body.alertSummary === undefined ? undefined : String(body.alertSummary || "").trim(),
      cancelReason: rawStatus === "ยกเลิก"
        ? String(body.cancelReason || "").trim() || "ผู้ใช้ยกเลิกรายการ"
        : body.cancelReason === undefined ? undefined : String(body.cancelReason || "").trim()
    });
    await recordActivity(actor, {
      action: "bookingDelivery.update",
      targetType: "bookingDelivery",
      targetId: record.id,
      source: "api",
      after: { status: record.status, workflowStatus: record.workflowStatus, recordVersion: record.recordVersion }
    });
    return NextResponse.json({ record });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "บันทึก Booking Delivery ไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
