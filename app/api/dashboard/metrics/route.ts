import { NextResponse } from "next/server";
import { listCalendarEvents } from "@/lib/calendar-events";
import { listReportHistory } from "@/lib/apps-script";
import { upsertBookingDeliveryFromReportHistory } from "@/lib/booking-delivery";
import { listSalesLeads } from "@/lib/leads";
import { canReadAllCustomers, getRequestSalesUser } from "@/lib/request-user";
import { listVehiclePrepRecords } from "@/lib/vehicle-prep";
import { buildCalendarVehicleOptions } from "@/lib/vehicle-prep-cases";
import type { ReportHistoryItem } from "@/lib/types";

export const dynamic = "force-dynamic";

function bangkokDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function legacyThaiDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).formatToParts(new Date());
  const day = parts.find((part) => part.type === "day")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const year = parts.find((part) => part.type === "year")?.value || "";
  return `${day}/${month}/${year}`;
}

function normalizePlate(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function extractLineValue(text: string, labels: string[]) {
  const lines = String(text || "").split(/\r?\n/);
  for (const line of lines) {
    const compact = line.replace(/\*/g, "").trim();
    for (const label of labels) {
      if (compact.startsWith(label)) return compact.slice(label.length).replace(/^[:：\s-]+/, "").trim();
    }
  }
  return "";
}

function isFinanceBooking(report: ReportHistoryItem) {
  const payment = extractLineValue(report.reportText, ["การชำระเงิน"]);
  const source = `${payment} ${report.reportText}`.toLowerCase();
  return source.includes("ไฟแนนซ์") || source.includes("finance");
}

export async function GET() {
  try {
    const currentUser = getRequestSalesUser();
    const today = bangkokDateKey();
    const legacyToday = legacyThaiDate();
    const [allLeads, reports, prepRecords, todayEvents] = await Promise.all([
      listSalesLeads(),
      listReportHistory("", "all"),
      listVehiclePrepRecords(),
      listCalendarEvents({ from: today, to: today })
    ]);
    const bookingDeliveryRecords = await upsertBookingDeliveryFromReportHistory(reports).catch(() => []);

    const leads =
      currentUser && !canReadAllCustomers(currentUser)
        ? allLeads.filter((lead) => lead.ownerId === currentUser.id)
        : allLeads;
    const activeReports = reports.filter((report) => report.status !== "deleted");
    const bookings = activeReports.filter((report) => report.type === "booking");
    const sales = activeReports.filter((report) => report.type === "sales");
    const salesPlateKeys = new Set(sales.map((report) => normalizePlate(report.plate)).filter(Boolean));
    const financeWaiting = bookings.filter((report) =>
      isFinanceBooking(report) &&
      report.status !== "finance_approved" &&
      !salesPlateKeys.has(normalizePlate(report.plate))
    );
    const readyDelivery = buildCalendarVehicleOptions(activeReports, prepRecords);
    const delivered = sales.filter((report) => report.status === "closed" || report.status === "delivered");

    return NextResponse.json({
      metrics: {
        leads: leads.length,
        newLeadsToday: leads.filter((lead) => String(lead.date || "") === legacyToday).length,
        bookings: bookings.length,
        financeWaiting: financeWaiting.length,
        waitingDelivery: readyDelivery.length,
        delivered: delivered.length,
        bookingDeliveries: bookingDeliveryRecords.length,
        bookingDeliveriesPending: bookingDeliveryRecords.filter((record) => record.status === "ติดจองรอคอนเฟิร์ม").length,
        todayEvents: todayEvents.length
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "โหลด Dashboard ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
