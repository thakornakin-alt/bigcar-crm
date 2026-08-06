import { NextResponse } from "next/server";
import { renderBookingReport } from "@/lib/booking-report";
import { saveBookingReport } from "@/lib/apps-script";
import { upsertBookingDeliveryFromBookingReport } from "@/lib/booking-delivery";
import { saveBookingReportAndMaster } from "@/lib/booking-report-persistence";
import type { BookingReportInput, BuyerType } from "@/lib/types";
import { recordActivity } from "@/lib/activity-log";
import { RequestAuthError, requireWritableUser } from "@/lib/request-user";
import { getRddFeatureFlags } from "@/lib/feature-flags";

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
    const actor = requireWritableUser();
    const input = cleanReport(await request.json());

    if (!input.bookingDate || !input.customerName || !input.plate || !input.saleName) {
      return NextResponse.json({ error: "Booking date, customer name, plate and sale are required" }, { status: 400 });
    }

    const result = await saveBookingReportAndMaster(input, {
      saveReport: saveBookingReport,
      upsertMaster: (report) => upsertBookingDeliveryFromBookingReport(
        report,
        getRddFeatureFlags().ownerMetadata ? actor : null
      )
    });
    await recordActivity(actor, {
      action: "bookingReport.create",
      targetType: "bookingReport",
      targetId: result.report.id,
      source: "api",
      after: { status: result.report.status, bookingDate: result.report.bookingDate },
      metadata: { partialSuccess: result.partialSuccess }
    });
    if (result.partialSuccess) {
      console.error("[booking-reports] report saved but Booking Delivery Master failed", {
        reportId: result.report.id,
        warning: result.warning
      });
      return NextResponse.json(result, { status: 207 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save booking report" },
      { status: 500 }
    );
  }
}
