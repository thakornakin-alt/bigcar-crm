import { NextResponse } from "next/server";
import { listReportHistory } from "@/lib/apps-script";
import { listBookingDeliveryRecords } from "@/lib/booking-delivery";
import { RequestAuthError, requireAdmin } from "@/lib/request-user";
import { buildSalesReportQaMetricsBaseline } from "@/lib/sales-report-qa-baseline";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    requireAdmin();
    const now = new Date();
    const [reports, bookingDeliveries] = await Promise.all([
      listReportHistory("", "all"),
      listBookingDeliveryRecords()
    ]);
    return NextResponse.json({
      baseline: buildSalesReportQaMetricsBaseline({
        reports,
        bookingDeliveries,
        year: Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", year: "numeric" }).format(now)),
        month: Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", month: "numeric" }).format(now))
      })
    });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to capture QA baseline" }, { status: 500 });
  }
}
