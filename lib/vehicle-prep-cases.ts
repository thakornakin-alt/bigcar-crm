import { listReportHistory } from "@/lib/apps-script";
import { listVehiclePrepRecords } from "@/lib/vehicle-prep";
import type { ReportHistoryItem } from "@/lib/types";
import type { VehiclePrepRecord } from "@/lib/vehicle-prep";
import { resolveSaleForBookingReadOnly } from "@/lib/report-transaction-identity";

export type CalendarVehicleOption = {
  bookingId: string;
  plate: string;
  customerName: string;
  model: string;
  owner: string;
  paymentMode: "cash" | "finance" | "unknown";
  status: "รอส่งมอบ";
};

function extractLineValue(text: string, labels: string[]) {
  const lines = String(text || "").split(/\r?\n/);
  for (const line of lines) {
    const compact = line.replace(/\*/g, "").trim();
    for (const label of labels) {
      if (compact.startsWith(label)) {
        return compact.slice(label.length).replace(/^[:：\s-]+/, "").trim();
      }
    }
  }
  return "";
}

function detectPaymentMode(report: ReportHistoryItem): CalendarVehicleOption["paymentMode"] {
  const payment = extractLineValue(report.reportText, ["การชำระเงิน"]);
  const source = `${payment} ${report.reportText}`.toLowerCase();
  if (source.includes("ไฟแนนซ์") || source.includes("finance")) return "finance";
  if (source.includes("สด") || source.includes("cash")) return "cash";
  return "unknown";
}

export function buildCalendarVehicleOptions(reports: ReportHistoryItem[], prepRecords: VehiclePrepRecord[]) {
  const activeReports = reports.filter((report) => report.status !== "deleted");
  const bookings = activeReports.filter((report) => report.type === "booking");
  const salesReports = activeReports.filter((report) => report.type === "sales");
  const prepByBookingId = new Map(prepRecords.map((record) => [record.bookingId, record]));

  return bookings
    .map((booking): CalendarVehicleOption | null => {
      if (!booking.plate) return null;
      const salesResolution = resolveSaleForBookingReadOnly(booking, bookings, salesReports);
      const sales = salesResolution.status === "resolved" ? salesResolution.sale : undefined;
      if (sales?.status === "closed" || sales?.status === "delivered") return null;

      const paymentMode = detectPaymentMode(booking);
      const prep = prepByBookingId.get(booking.id);
      const financeApproved = booking.status === "finance_approved" || Boolean(prep?.financeApprovedAt);
      const isFinanceWaiting = paymentMode === "finance" && !sales && !financeApproved;
      if (isFinanceWaiting) return null;

      return {
        bookingId: booking.id,
        plate: booking.plate,
        customerName: booking.customerName || prep?.customerName || "",
        model: [booking.brand, booking.model, booking.year].filter(Boolean).join(" ") || "-",
        owner: [booking.saleName, booking.teamName ? `ทีม${booking.teamName}` : ""].filter(Boolean).join(" "),
        paymentMode,
        status: "รอส่งมอบ"
      };
    })
    .filter((item): item is CalendarVehicleOption => Boolean(item))
    .sort((a, b) => a.plate.localeCompare(b.plate, "th"));
}

export async function listCalendarVehicleOptions() {
  const [reports, prepRecords] = await Promise.all([
    listReportHistory("", "all"),
    listVehiclePrepRecords()
  ]);
  return buildCalendarVehicleOptions(reports, prepRecords);
}
