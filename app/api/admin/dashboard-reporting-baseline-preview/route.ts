import { NextResponse } from "next/server";
import { listReportHistory, listSalesUsers } from "@/lib/apps-script";
import { listBookingDeliveryRecords } from "@/lib/booking-delivery";
import { listCaseOwnership } from "@/lib/case-ownership";
import { buildDashboardReportingBaselinePreview } from "@/lib/dashboard-reporting-baseline-preview";
import { readDashboardReportingBaseline } from "@/lib/dashboard-reporting-baseline";
import { listSalesLeads } from "@/lib/leads";
import { RequestAuthError, requireAdmin } from "@/lib/request-user";
import { listVehiclePrepRecords } from "@/lib/vehicle-prep";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const [leads, reports, prepRecords, bookingDeliveries, ownership, users, existing] = await Promise.all([
      listSalesLeads(),
      listReportHistory("", "all"),
      listVehiclePrepRecords(),
      listBookingDeliveryRecords(),
      listCaseOwnership(),
      listSalesUsers(),
      readDashboardReportingBaseline()
    ]);
    return NextResponse.json({
      preview: buildDashboardReportingBaselinePreview({ leads, reports, prepRecords, bookingDeliveries, ownership, users, existing })
    });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "สร้าง Dashboard baseline preview ไม่สำเร็จ" }, { status: 500 });
  }
}
