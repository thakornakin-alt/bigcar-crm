import { NextResponse } from "next/server";
import { saveSalesReport } from "@/lib/apps-script";
import { captureBookingDeliverySalespersonFromSalesReport, syncBookingDeliveryFromReportHistory } from "@/lib/booking-delivery";
import { buildSalesPaymentDetail, renderSalesReport } from "@/lib/sales-report";
import type { SalesReportInput } from "@/lib/types";
import { recordActivity } from "@/lib/activity-log";
import { RequestAuthError, requireWritableUser } from "@/lib/request-user";
import { resolveAuthenticatedSalespersonCapture } from "@/lib/commission-canonical-capture";

export const dynamic = "force-dynamic";

function clean(body: Partial<SalesReportInput>): SalesReportInput {
  const report: SalesReportInput = {
    bookingReportId: String(body.bookingReportId || "").trim(),
    customerName: String(body.customerName || "").trim(),
    phone: String(body.phone || "").trim(),
    idCard: String(body.idCard || "").trim(),
    address: String(body.address || "").trim(),
    bookingPrice: String(body.bookingPrice || "").trim(),
    plate: String(body.plate || "").trim(),
    brand: String(body.brand || "").trim(),
    model: String(body.model || "").trim(),
    year: String(body.year || "").trim(),
    color: String(body.color || "").trim(),
    engineNo: String(body.engineNo || "").trim(),
    chassisNo: String(body.chassisNo || "").trim(),
    salePrice: String(body.salePrice || "").trim(),
    centralDiscount: String(body.centralDiscount || "").trim(),
    finalPrice: String(body.finalPrice || "").trim(),
    paymentType: String(body.paymentType || "").trim(),
    source: String(body.source || "").trim(),
    ownership: String(body.ownership || "").trim(),
    project: String(body.project || "").trim(),
    carPrice: String(body.carPrice || "").trim(),
    bookingDeduction: String(body.bookingDeduction || "").trim(),
    transferFee: String(body.transferFee || "").trim(),
    netPayment: String(body.netPayment || "").trim(),
    downPayment: String(body.downPayment || "").trim(),
    insuranceFee: String(body.insuranceFee || "").trim(),
    paymentDetail: String(body.paymentDetail || "").trim(),
    saleConditions: String(body.saleConditions || "").trim(),
    saleName: String(body.saleName || "").trim(),
    teamName: String(body.teamName || "").trim(),
    branch: String(body.branch || "").trim(),
    deliveryDate: String(body.deliveryDate || "").trim(),
    emailSubject: String(body.emailSubject || "").trim(),
    emailTo: String(body.emailTo || "").trim(),
    emailCc: String(body.emailCc || "").trim(),
    emailBcc: String(body.emailBcc || "").trim(),
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    driveFolderUrl: String(body.driveFolderUrl || "").trim(),
    reportText: "",
    status: "draft"
  };

  return {
    ...report,
    paymentDetail: buildSalesPaymentDetail(report),
    reportText: renderSalesReport(report)
  };
}

export async function POST(request: Request) {
  try {
    const actor = requireWritableUser();
    const body = await request.json() as Partial<SalesReportInput>;
    const report = clean(body);
    const salespersonCapture = resolveAuthenticatedSalespersonCapture({ submittedSalespersonUserId: body.salespersonUserId, submittedSaleName: report.saleName, actor });
    if (!report.customerName || !report.plate || !report.saleName) {
      return NextResponse.json({ error: "Customer name, plate and sale are required" }, { status: 400 });
    }

    const saved = await saveSalesReport(report);
    await recordActivity(actor, {
      action: "salesReport.create",
      targetType: "salesReport",
      targetId: saved.id,
      source: "api",
      after: { status: saved.status, bookingReportId: saved.bookingReportId }
    });
    await syncBookingDeliveryFromReportHistory().catch(() => null);
    const identityResult = salespersonCapture && report.bookingReportId
      ? await captureBookingDeliverySalespersonFromSalesReport({ bookingReportId: report.bookingReportId, salesperson: salespersonCapture })
      : null;
    if (identityResult?.changedFields.length) {
      await recordActivity(actor, {
        action: "commission_salesperson_captured",
        targetType: "bookingDelivery",
        targetId: identityResult.record.id,
        source: "api",
        after: { changedFields: identityResult.changedFields },
        metadata: { source: "sales_report_authenticated_self_selection" }
      });
    }
    return NextResponse.json({ report: saved }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save sales report" },
      { status: 500 }
    );
  }
}
