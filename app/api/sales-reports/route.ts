import { NextResponse } from "next/server";
import { checkSalesReportDuplicate, saveSalesReport } from "@/lib/apps-script";
import { captureBookingDeliverySalespersonFromSalesReport, syncBookingDeliveryFromReportHistory } from "@/lib/booking-delivery";
import { buildSalesPaymentDetail, renderSalesReport } from "@/lib/sales-report";
import type { SalesReportInput } from "@/lib/types";
import { recordActivity } from "@/lib/activity-log";
import { RequestAuthError, requireWritableUser } from "@/lib/request-user";
import { resolveAuthenticatedSalespersonCapture } from "@/lib/commission-canonical-capture";
import { createSalesRequestId } from "@/lib/sales-report-duplicate";

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
    const payload = await request.json() as {
      report?: Partial<SalesReportInput>;
      requestId?: string;
      confirmationToken?: string;
      createdFromSalesReportId?: string;
      checkOnly?: boolean;
    } & Partial<SalesReportInput>;
    const body = (payload.report && typeof payload.report === "object" ? payload.report : payload) as Partial<SalesReportInput>;
    const report = clean(body);
    const salespersonCapture = resolveAuthenticatedSalespersonCapture({ submittedSalespersonUserId: body.salespersonUserId, submittedSaleName: report.saleName, actor });
    if (!report.customerName || !report.plate || !report.saleName) {
      return NextResponse.json({ error: "Customer name, plate and sale are required" }, { status: 400 });
    }

    const requestId = String(payload.requestId || "").trim() || createSalesRequestId();
    if (payload.checkOnly === true) {
      const duplicate = await checkSalesReportDuplicate(report, actor.id);
      if (duplicate.requiresConfirmation) {
        return NextResponse.json({
          status: "duplicate_plate_customer_confirmation_required",
          normalizedPlate: duplicate.normalizedPlate,
          customerIdentityType: duplicate.customerIdentityType,
          matches: duplicate.matches,
          confirmationToken: duplicate.confirmationToken,
          requestId
        }, { status: 409 });
      }
      return NextResponse.json({ status: "ok_to_create", requestId });
    }
    let saved;
    try {
      saved = await saveSalesReport(report, {
        requestId,
        confirmationToken: String(payload.confirmationToken || ""),
        actorId: actor.id
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const marker = "SALES_REPORT_DUPLICATE_CONFIRMATION_REQUIRED:";
      const markerIndex = message.indexOf(marker);
      if (markerIndex >= 0) {
        const duplicate = JSON.parse(message.slice(markerIndex + marker.length));
        return NextResponse.json({
          status: "duplicate_plate_customer_confirmation_required",
          normalizedPlate: duplicate.normalizedPlate,
          customerIdentityType: duplicate.customerIdentityType,
          matches: duplicate.matches,
          confirmationToken: duplicate.confirmationToken,
          requestId
        }, { status: 409 });
      }
      if (message.includes("SALES_REPORT_IDEMPOTENCY_CONFLICT")) {
        return NextResponse.json({ status: "idempotency_conflict", error: "คำขอบันทึกนี้มีข้อมูลไม่ตรงกับครั้งก่อน" }, { status: 409 });
      }
      if (message.includes("SALES_REPORT_DUPLICATE_TOKEN_INVALID")) {
        return NextResponse.json({ status: "duplicate_confirmation_invalid", error: "การยืนยันหมดอายุหรือข้อมูลมีการเปลี่ยนแปลง กรุณายืนยันใหม่" }, { status: 409 });
      }
      throw error;
    }
    await recordActivity(actor, {
      action: "salesReport.create",
      targetType: "salesReport",
      targetId: saved.id,
      source: "api",
      after: { status: saved.status, bookingReportId: saved.bookingReportId },
      metadata: payload.createdFromSalesReportId
        ? { createdFromSalesReportId: String(payload.createdFromSalesReportId) }
        : undefined
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
