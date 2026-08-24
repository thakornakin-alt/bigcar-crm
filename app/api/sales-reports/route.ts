import { NextResponse } from "next/server";
import { checkSalesReportDuplicate, listReportHistory, saveSalesReport } from "@/lib/apps-script";
import { captureBookingDeliverySalespersonFromSalesReport, syncBookingDeliveryFromReportHistory } from "@/lib/booking-delivery";
import { buildSalesPaymentDetail, renderSalesReport } from "@/lib/sales-report";
import type { SalesReportInput } from "@/lib/types";
import { recordActivity } from "@/lib/activity-log";
import { RequestAuthError, requireWritableUser } from "@/lib/request-user";
import { resolveAuthenticatedSalespersonCapture } from "@/lib/commission-canonical-capture";
import { createSalesRequestId } from "@/lib/sales-report-duplicate";
import {
  finalizeSalesReportQaMetadata,
  removeSalesReportQaReservation,
  reserveSalesReportQaMetadata,
  resolveSalesReportQaRequest,
  SalesReportQaError
} from "@/lib/sales-report-qa-metadata";
import { requiresSalesDuplicateConfirmation } from "@/lib/sales-report-duplicate";
import { salesReportsForExactBooking } from "@/lib/report-transaction-identity";
import { getCaseOwnership, ownershipFromUser, salesOwnershipFromBooking, saveCaseOwnership } from "@/lib/case-ownership";

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
    const actor = await requireWritableUser();
    const payload = await request.json() as {
      report?: Partial<SalesReportInput>;
      requestId?: string;
      confirmationToken?: string;
      createdFromSalesReportId?: string;
      checkOnly?: boolean;
      qaCreateMode?: unknown;
      qaTestMarker?: unknown;
      qaTestRecord?: unknown;
      excludeFromMetrics?: unknown;
      isCounted?: unknown;
    } & Partial<SalesReportInput>;
    const body = (payload.report && typeof payload.report === "object" ? payload.report : payload) as Partial<SalesReportInput>;
    const report = clean(body);
    const bookingOwnership = report.bookingReportId ? await getCaseOwnership("booking", report.bookingReportId) : null;
    const salespersonCapture = bookingOwnership
      ? { salespersonUserId: bookingOwnership.ownerUserId, salespersonDisplayName: bookingOwnership.ownerDisplayName }
      : resolveAuthenticatedSalespersonCapture({ submittedSalespersonUserId: actor.id, submittedSaleName: actor.firstName, actor });
    if (!report.customerName || !report.plate || !report.saleName) {
      return NextResponse.json({ error: "Customer name, plate and sale are required" }, { status: 400 });
    }

    const requestId = String(payload.requestId || "").trim() || createSalesRequestId();
    const qaMetadata = resolveSalesReportQaRequest(actor, {
      qaCreateMode: payload.qaCreateMode,
      qaTestMarker: payload.qaTestMarker,
      bookingReportId: report.bookingReportId,
      requestId
    });
    if (payload.checkOnly === true) {
      if (report.bookingReportId) {
        const relatedHistory = await listReportHistory(report.bookingReportId, "all");
        const booking = relatedHistory.find((item) => item.type === "booking" && item.id === report.bookingReportId);
        const existingSales = salesReportsForExactBooking(relatedHistory, report.bookingReportId);
        if (existingSales.length) {
          return NextResponse.json({
            status: "existing_sales_report_for_booking",
            bookingReportId: report.bookingReportId,
            matches: existingSales.map((item) => ({
              salesReportId: item.id,
              bookingReportId: item.bookingReportId,
              saleDate: item.createdAt,
              createdAt: item.createdAt,
              customerName: item.customerName,
              plate: item.plate,
              salespersonDisplayName: item.saleName,
              status: item.status
            })),
            requestId
          }, { status: 409 });
        }
        if (booking && requiresSalesDuplicateConfirmation(report, booking)) {
          const duplicate = await checkSalesReportDuplicate(report, actor.id);
          return NextResponse.json({
            status: "ok_to_create",
            requestId,
            confirmationToken: duplicate.requiresConfirmation ? duplicate.confirmationToken : undefined,
            relationship: "verified_booking_report"
          });
        }
      }
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
    if (qaMetadata) await reserveSalesReportQaMetadata(qaMetadata);
    let saved;
    try {
      saved = await saveSalesReport(report, {
        requestId,
        confirmationToken: String(payload.confirmationToken || ""),
        actorId: actor.id
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const relationshipMarker = "SALES_REPORT_BOOKING_RELATIONSHIP_CONFLICT:";
      const relationshipMarkerIndex = message.indexOf(relationshipMarker);
      if (relationshipMarkerIndex >= 0) {
        if (qaMetadata) await removeSalesReportQaReservation(requestId);
        const relationship = JSON.parse(message.slice(relationshipMarkerIndex + relationshipMarker.length)) as {
          salesReportId?: unknown;
          bookingReportId?: unknown;
        };
        return NextResponse.json({
          error: "existing_sales_report_for_booking",
          existingSalesReportId: String(relationship.salesReportId || ""),
          bookingReportId: String(relationship.bookingReportId || report.bookingReportId || "")
        }, { status: 409 });
      }
      const marker = "SALES_REPORT_DUPLICATE_CONFIRMATION_REQUIRED:";
      const markerIndex = message.indexOf(marker);
      if (markerIndex >= 0) {
        if (qaMetadata) await removeSalesReportQaReservation(requestId);
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
        if (qaMetadata) await removeSalesReportQaReservation(requestId);
        return NextResponse.json({ status: "idempotency_conflict", error: "คำขอบันทึกนี้มีข้อมูลไม่ตรงกับครั้งก่อน" }, { status: 409 });
      }
      if (message.includes("SALES_REPORT_DUPLICATE_TOKEN_INVALID")) {
        if (qaMetadata) await removeSalesReportQaReservation(requestId);
        return NextResponse.json({ status: "duplicate_confirmation_invalid", error: "การยืนยันหมดอายุหรือข้อมูลมีการเปลี่ยนแปลง กรุณายืนยันใหม่" }, { status: 409 });
      }
      throw error;
    }
    if (qaMetadata) {
      try {
        await finalizeSalesReportQaMetadata(requestId, saved.id);
      } catch (error) {
        console.error("[sales-reports] QA sidecar finalization failed; downstream sync stopped", {
          requestId,
          salesReportId: saved.id,
          bookingReportId: saved.bookingReportId,
          error: error instanceof Error ? error.message : "unknown"
        });
        throw new SalesReportQaError(503, "Sales QA metadata persistence failed; downstream processing stopped");
      }
    }
    const salesOwnership = bookingOwnership
      ? salesOwnershipFromBooking(bookingOwnership, saved.id)
      : ownershipFromUser(actor, { caseType: "sales", caseId: saved.id, teamName: report.teamName });
    await saveCaseOwnership(salesOwnership);
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
    if (error instanceof SalesReportQaError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save sales report" },
      { status: 500 }
    );
  }
}
