import type { CaseOwnership } from "@/lib/case-ownership";
import type { SalesLead } from "@/lib/leads";
import type { BookingDeliveryRecord, ReportHistoryItem, SalesUser } from "@/lib/types";
import type { VehiclePrepRecord } from "@/lib/vehicle-prep";
import { buildCalendarVehicleOptions } from "@/lib/vehicle-prep-cases";
import { currentBangkokMonth } from "@/lib/dashboard-scope";
import { baselineReportingMonth, type DashboardReportingBaselineRecord } from "@/lib/dashboard-reporting-baseline";

export type DashboardMetrics = {
  leads: number; newLeadsToday: number; bookings: number; financeWaiting: number;
  waitingDelivery: number; delivered: number; bookingDeliveries: number;
  bookingDeliveriesPending: number; todayEvents: number;
};

const BANGKOK = "Asia/Bangkok";

export function bangkokDateKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BANGKOK, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function normalizeDashboardMonth(value: string | null, now = new Date()) {
  const month = String(value || "").trim();
  const current = currentBangkokMonth(now);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return current;
  if (month > current) return current;
  return month;
}

export function businessDateKey(value: unknown) {
  const raw = String(value || "").trim();
  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (isoDate && raw.length === 10) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  const thaiDate = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (thaiDate) return `${thaiDate[3]}-${thaiDate[2]}-${thaiDate[1]}`;
  if (!raw) return "";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.valueOf()) ? "" : bangkokDateKey(parsed);
}

function reportDate(report: ReportHistoryItem) {
  return businessDateKey(report.bookingDate) || businessDateKey(report.createdAt);
}

function deliveryDate(record: BookingDeliveryRecord, sales?: ReportHistoryItem) {
  return businessDateKey(record.deliveredAt) || businessDateKey(record.deliveryDate) || businessDateKey(sales?.deliveryDate) || businessDateKey(record.createdAt);
}

function extractLineValue(text: string, labels: string[]) {
  for (const line of String(text || "").split(/\r?\n/)) {
    const compact = line.replace(/\*/g, "").trim();
    for (const label of labels) if (compact.startsWith(label)) return compact.slice(label.length).replace(/^[:：\s-]+/, "").trim();
  }
  return "";
}

function isFinanceBooking(report: ReportHistoryItem) {
  const source = `${extractLineValue(report.reportText, ["การชำระเงิน"])} ${report.reportText}`.toLowerCase();
  return source.includes("ไฟแนนซ์") || source.includes("finance");
}

function exactLegacyUserId(name: string, users: SalesUser[]) {
  const normalized = String(name || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("th-TH");
  if (!normalized) return "";
  const matches = users.filter((user) => [user.firstName, user.lastName].filter(Boolean).join(" ").trim().replace(/\s+/g, " ").toLocaleLowerCase("th-TH") === normalized);
  return matches.length === 1 ? matches[0].id : "";
}

export function derivePersonalDashboardMetrics(input: {
  targetUserId: string; month: string; now?: Date; leads: SalesLead[]; reports: ReportHistoryItem[];
  prepRecords: VehiclePrepRecord[]; bookingDeliveries: BookingDeliveryRecord[];
  ownership: CaseOwnership[]; users: SalesUser[];
  reportingOverrides?: Record<string, DashboardReportingBaselineRecord>;
}): DashboardMetrics {
  const { targetUserId, month, leads, reports, prepRecords, bookingDeliveries, ownership, users, reportingOverrides } = input;
  const today = bangkokDateKey(input.now || new Date());
  const ownershipByCase = new Map(ownership.map((item) => [`${item.caseType}:${item.caseId}`, item.ownerUserId]));
  const active = reports.filter((report) => report.status !== "deleted" && report.qaTestRecord !== true && report.excludeFromMetrics !== true && report.isCounted !== false);
  const bookings = active.filter((report) => report.type === "booking");
  const sales = active.filter((report) => report.type === "sales");
  const bookingById = new Map(bookings.map((item) => [item.id, item]));
  const salesById = new Map(sales.map((item) => [item.id, item]));
  const bookingOwner = (report: ReportHistoryItem) => ownershipByCase.get(`booking:${report.id}`) || String((report as ReportHistoryItem & { salespersonUserId?: string }).salespersonUserId || "").trim() || exactLegacyUserId(report.saleName, users);
  const salesOwner = (report: ReportHistoryItem) => ownershipByCase.get(`sales:${report.id}`) || (report.bookingReportId ? bookingById.get(report.bookingReportId) && bookingOwner(bookingById.get(report.bookingReportId)!) : "") || String((report as ReportHistoryItem & { salespersonUserId?: string }).salespersonUserId || "").trim() || exactLegacyUserId(report.saleName, users);
  const ownedBookings = bookings.filter((report) => bookingOwner(report) === targetUserId && baselineReportingMonth(reportingOverrides, "booking", report.id, reportDate(report)) === month);
  const ownedBookingIds = new Set(ownedBookings.map((report) => report.id));
  const ownedSales = sales.filter((report) => salesOwner(report) === targetUserId);
  const salesBookingIds = new Set(ownedSales.map((report) => String(report.bookingReportId || "").trim()).filter(Boolean));
  const scopedLeads = leads.filter((lead) => lead.ownerId === targetUserId && baselineReportingMonth(reportingOverrides, "lead", lead.id, businessDateKey(lead.date) || businessDateKey(lead.createdAt)) === month);
  const readyBookingIds = new Set(buildCalendarVehicleOptions(active, prepRecords).map((item) => item.bookingId));
  const operationalDeliveries = bookingDeliveries.filter((record) => record.qaTestRecord !== true && record.excludeFromMetrics !== true && record.isCounted !== false);
  const deliveryOwner = (record: BookingDeliveryRecord) => String(record.ownerUserId || "").trim() || (record.bookingReportId && bookingById.get(record.bookingReportId) ? bookingOwner(bookingById.get(record.bookingReportId)!) : "") || String(record.salespersonUserId || "").trim();
  const scopedDeliveries = operationalDeliveries.filter((record) => deliveryOwner(record) === targetUserId && baselineReportingMonth(reportingOverrides, "booking_delivery_cohort", record.id, businessDateKey(record.bookingDate) || businessDateKey(record.createdAt)) === month);
  const delivered = operationalDeliveries.filter((record) => {
    const isDelivered = record.status === "ยอดส่งมอบ" || record.workflowStatus === "ยอดส่งมอบ" || record.caseStatus === "delivered";
    return isDelivered && deliveryOwner(record) === targetUserId && baselineReportingMonth(reportingOverrides, "delivery_completion", record.id, deliveryDate(record, salesById.get(record.salesReportId))) === month;
  });
  return {
    leads: scopedLeads.length,
    newLeadsToday: scopedLeads.filter((lead) => (businessDateKey(lead.date) || businessDateKey(lead.createdAt)) === today).length,
    bookings: ownedBookings.length,
    financeWaiting: ownedBookings.filter((report) => isFinanceBooking(report) && report.status !== "finance_approved" && !salesBookingIds.has(report.id)).length,
    waitingDelivery: Array.from(ownedBookingIds).filter((id) => readyBookingIds.has(id)).length,
    delivered: delivered.length,
    bookingDeliveries: scopedDeliveries.filter((record) => record.status !== "ยกเลิก").length,
    bookingDeliveriesPending: scopedDeliveries.filter((record) => record.status !== "ยกเลิก" && record.workflowStatus !== "ยอดส่งมอบ").length,
    todayEvents: 0
  };
}
