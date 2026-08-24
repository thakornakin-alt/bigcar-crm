import { NextResponse } from "next/server";
import { renderBookingReport } from "@/lib/booking-report";
import { checkBookingReportDuplicate, lookupBookingListCommissionGroup, saveBookingReport } from "@/lib/apps-script";
import { upsertBookingDeliveryFromBookingReport } from "@/lib/booking-delivery";
import { saveBookingReportAndMaster } from "@/lib/booking-report-persistence";
import type { BookingReportInput, BuyerType } from "@/lib/types";
import { recordActivity } from "@/lib/activity-log";
import { RequestAuthError, requireWritableUser } from "@/lib/request-user";
import { commissionGroupCaptureFromLookup, resolveAuthenticatedSalespersonCapture, type CommissionGroupLookupResult } from "@/lib/commission-canonical-capture";
import { QaSyntheticCreateError, resolveQaSyntheticCreateMetadata } from "@/lib/qa-synthetic-create";
import { createBookingRequestId } from "@/lib/booking-report-duplicate";
import { ownershipFromUser, saveCaseOwnership } from "@/lib/case-ownership";

export const dynamic = "force-dynamic";

function cleanReport(body: Partial<BookingReportInput>): BookingReportInput {
  const report = {
    bookingDate: String(body.bookingDate || "").trim(),
    customerName: String(body.customerName || "").trim(),
    idCard: String(body.idCard || "").trim(),
    phone: String(body.phone || "").trim(),
    address: String(body.address || "").trim(),
    buyerType: (body.buyerType === "company" ? "company" : "individual") as BuyerType,
    bookingPrice: String(body.bookingPrice || "").trim(),
    plate: String(body.plate || "").trim(),
    brand: String(body.brand || "").trim(),
    model: String(body.model || "").trim(),
    year: String(body.year || "").trim(),
    color: String(body.color || "").trim(),
    salePrice: String(body.salePrice || "").trim(),
    finalPrice: String(body.finalPrice || "").trim(),
    finalPriceNote: String(body.finalPriceNote || "").trim(),
    discount: String(body.discount || "").trim(),
    paymentType: String(body.paymentType || "").trim(),
    source: String(body.source || "").trim(),
    ownership: String(body.ownership || "").trim(),
    project: String(body.project || "").trim(),
    campaign: String(body.campaign || "").trim(),
    saleName: String(body.saleName || "").trim(),
    teamName: String(body.teamName || "").trim(),
    conditions: String(body.conditions || "").trim(),
    emailSubject: String(body.emailSubject || "").trim(),
    emailTo: String(body.emailTo || "").trim(),
    emailCc: String(body.emailCc || "").trim(),
    emailBcc: String(body.emailBcc || "").trim(),
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    reportText: "",
    status: "draft" as const
  };

  return {
    ...report,
    reportText: renderBookingReport(report)
  };
}

export async function POST(request: Request) {
  try {
    const actor = await requireWritableUser();
    const payload = await request.json() as Partial<BookingReportInput> & {
      report?: Partial<BookingReportInput>;
      requestId?: unknown;
      confirmationToken?: unknown;
      checkOnly?: unknown;
      qaCreateMode?: unknown;
      qaTestMarker?: unknown;
      qaTestRecord?: unknown;
      excludeFromMetrics?: unknown;
      isCounted?: unknown;
    };
    const body = (payload.report && typeof payload.report === "object" ? payload.report : payload) as Partial<BookingReportInput>;
    const qaSynthetic = resolveQaSyntheticCreateMetadata(actor, { ...payload, ...body });
    const input = cleanReport(body);
    const salespersonCapture = resolveAuthenticatedSalespersonCapture({
      submittedSalespersonUserId: actor.id,
      submittedSaleName: actor.firstName,
      actor
    });

    if (!input.bookingDate || !input.customerName || !input.plate || !input.saleName) {
      return NextResponse.json({ error: "Booking date, customer name, plate and sale are required" }, { status: 400 });
    }

    const requestId = String(payload.requestId || "").trim() || createBookingRequestId();
    if (payload.checkOnly === true) {
      const duplicate = await checkBookingReportDuplicate(input, actor.id);
      if (duplicate.requiresConfirmation) {
        return NextResponse.json({
          status: "duplicate_booking_confirmation_required",
          normalizedPlate: duplicate.normalizedPlate,
          customerIdentityType: duplicate.customerIdentityType,
          matches: duplicate.matches,
          confirmationToken: duplicate.confirmationToken,
          requestId
        }, { status: 409 });
      }
      return NextResponse.json({ status: "ok_to_create", requestId });
    }

    const commissionLookupState: { result: CommissionGroupLookupResult | null } = { result: null };
    const result = await saveBookingReportAndMaster(input, {
      saveReport: async (report) => {
        try {
          const savedReport = await saveBookingReport(report, {
            requestId,
            confirmationToken: String(payload.confirmationToken || ""),
            actorId: actor.id
          });
          await saveCaseOwnership(ownershipFromUser(actor, {
            caseType: "booking",
            caseId: savedReport.id,
            teamName: input.teamName
          }));
          return savedReport;
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          const marker = "BOOKING_REPORT_DUPLICATE_CONFIRMATION_REQUIRED:";
          const markerIndex = message.indexOf(marker);
          if (markerIndex >= 0) {
            const duplicate = JSON.parse(message.slice(markerIndex + marker.length));
            throw new BookingDuplicateRequiredError({ ...duplicate, requestId });
          }
          if (message.includes("BOOKING_REPORT_IDEMPOTENCY_CONFLICT")) throw new BookingIdempotencyConflictError();
          if (message.includes("BOOKING_REPORT_DUPLICATE_TOKEN_INVALID")) throw new BookingConfirmationInvalidError();
          throw error;
        }
      },
      upsertMaster: async (report) => {
        try {
          commissionLookupState.result = await lookupBookingListCommissionGroup({
            bookingReportId: report.id,
            plate: report.plate
          });
        } catch (lookupError) {
          console.warn("[booking-reports] Booking List Commission Group lookup failed", {
            reportId: report.id,
            error: lookupError instanceof Error ? lookupError.message : "lookup failed"
          });
        }
        const group = commissionLookupState.result
          ? commissionGroupCaptureFromLookup(commissionLookupState.result, new Date().toISOString())
          : undefined;
        return upsertBookingDeliveryFromBookingReport(
          report,
          actor,
          { salesperson: salespersonCapture, group, qaSynthetic }
        );
      }
    });
    await recordActivity(actor, {
      action: "bookingReport.create",
      targetType: "bookingReport",
      targetId: result.report.id,
      source: "api",
      after: { status: result.report.status, bookingDate: result.report.bookingDate },
      metadata: { partialSuccess: result.partialSuccess }
    });
    if (salespersonCapture && result.bookingDelivery) {
      await recordActivity(actor, {
        action: "commission_salesperson_captured",
        targetType: "bookingDelivery",
        targetId: result.bookingDelivery.id,
        source: "api",
        after: { changedFields: ["salespersonUserId", "salespersonDisplayName"] },
        metadata: { source: "authenticated_self_selection" }
      });
    }
    const commissionGroupLookup = commissionLookupState.result;
    if (result.bookingDelivery && commissionGroupLookup?.status === "resolved" && result.bookingDelivery.commissionGroupSource === commissionGroupLookup.sourceReference) {
      await recordActivity(actor, {
        action: "commission_group_captured",
        targetType: "bookingDelivery",
        targetId: result.bookingDelivery.id,
        source: "api",
        after: { changedFields: ["commissionGroup", "commissionGroupSource", "commissionGroupCapturedAt"] },
        metadata: { sourceReference: commissionGroupLookup.sourceReference, source: "booking_list_read_only" }
      });
    }
    if (result.partialSuccess) {
      console.error("[booking-reports] report saved but Booking Delivery Master failed", {
        reportId: result.report.id,
        warning: result.warning
      });
      return NextResponse.json(result, { status: 207 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof BookingDuplicateRequiredError) {
      return NextResponse.json({ status: "duplicate_booking_confirmation_required", ...error.detail }, { status: 409 });
    }
    if (error instanceof BookingIdempotencyConflictError) {
      return NextResponse.json({ status: "idempotency_conflict", error: "คำขอบันทึกนี้มีข้อมูลไม่ตรงกับครั้งก่อน" }, { status: 409 });
    }
    if (error instanceof BookingConfirmationInvalidError) {
      return NextResponse.json({ status: "duplicate_confirmation_invalid", error: "การยืนยันหมดอายุหรือข้อมูลมีการเปลี่ยนแปลง กรุณายืนยันใหม่" }, { status: 409 });
    }
    if (error instanceof RequestAuthError || error instanceof QaSyntheticCreateError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save booking report" },
      { status: 500 }
    );
  }
}

class BookingDuplicateRequiredError extends Error {
  constructor(readonly detail: Record<string, unknown>) {
    super("Booking duplicate confirmation required");
  }
}

class BookingIdempotencyConflictError extends Error {}
class BookingConfirmationInvalidError extends Error {}
