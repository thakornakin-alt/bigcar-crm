import { commissionReadinessReport } from "@/lib/commission";
import { deriveRddHomeKpis, deriveRddReminders, operationalRddRecords } from "@/lib/rdd-phase2";
import type { BookingDeliveryRecord, ReportHistoryItem } from "@/lib/types";

export function buildSalesReportQaMetricsBaseline(input: {
  reports: ReportHistoryItem[];
  bookingDeliveries: BookingDeliveryRecord[];
  year: number;
  month: number;
}) {
  const operationalDeliveries = operationalRddRecords(input.bookingDeliveries)
    .filter((record) => record.isCounted !== false);
  const commission = commissionReadinessReport(input.bookingDeliveries);
  return {
    capturedAt: new Date().toISOString(),
    salesReports: input.reports.filter((report) => report.type === "sales").length,
    bookingReports: input.reports.filter((report) => report.type === "booking").length,
    bookingDeliveries: operationalDeliveries.length,
    rddHome: deriveRddHomeKpis(input.bookingDeliveries, input.year, input.month),
    rddReminders: deriveRddReminders(input.bookingDeliveries),
    commission: {
      eligible: commission.eligible,
      needsReview: commission.needsReview,
      excluded: commission.excluded
    }
  };
}
