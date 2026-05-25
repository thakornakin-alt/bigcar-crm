import { listReportHistory } from "@/lib/apps-script";
import { listVehiclePrepRecords } from "@/lib/vehicle-prep";
import type { ReportHistoryItem } from "@/lib/types";
import type { VehiclePrepRecord } from "@/lib/vehicle-prep";

export type CalendarVehicleOption = {
  bookingId: string;
  plate: string;
  customerName: string;
  model: string;
  owner: string;
  paymentMode: "cash" | "finance" | "unknown";
  status: "รอส่งมอบ";
};

function normalizePlate(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

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

function latestByPlate(reports: ReportHistoryItem[]) {
  const map = new Map<string, ReportHistoryItem>();
  for (const report of reports) {
    const key = normalizePlate(report.plate);
    if (!key) continue;
    const current = map.get(key);
    if (!current || String(report.createdAt).localeCompare(String(current.createdAt)) > 0) {
      map.set(key, report);
    }
  }
  return map;
}

export function buildCalendarVehicleOptions(reports: ReportHistoryItem[], prepRecords: VehiclePrepRecord[]) {
  const activeReports = reports.filter((report) => report.status !== "deleted");
  const latestSalesByPlate = latestByPlate(activeReports.filter((report) => report.type === "sales"));
  const prepByBookingId = new Map(prepRecords.map((record) => [record.bookingId, record]));

  return activeReports
    .filter((report) => report.type === "booking")
    .map((booking): CalendarVehicleOption | null => {
      const plateKey = normalizePlate(booking.plate);
      if (!plateKey) return null;

      const sales = latestSalesByPlate.get(plateKey);
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
