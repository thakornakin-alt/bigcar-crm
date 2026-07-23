import { NextResponse } from "next/server";
import { renderBookingReport } from "@/lib/booking-report";
import { saveBookingReport } from "@/lib/apps-script";
import { upsertBookingDeliveryFromBookingReport } from "@/lib/booking-delivery";
import { saveBookingReportAndMaster } from "@/lib/booking-report-persistence";
import type { BookingReportInput, BuyerType } from "@/lib/types";

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
    const input = cleanReport(await request.json());

    if (!input.bookingDate || !input.customerName || !input.plate || !input.saleName) {
      return NextResponse.json({ error: "Booking date, customer name, plate and sale are required" }, { status: 400 });
    }

    const result = await saveBookingReportAndMaster(input, {
      saveReport: saveBookingReport,
      upsertMaster: upsertBookingDeliveryFromBookingReport
    });
    if (result.partialSuccess) {
      console.error("[booking-reports] report saved but Booking Delivery Master failed", {
        reportId: result.report.id,
        warning: result.warning
      });
      console.info("[booking-reports:diagnostic] final HTTP response", {
        reportId: result.report.id,
        partialSuccess: true,
        status: 207
      });
      return NextResponse.json(result, { status: 207 });
    }
    console.info("[booking-reports:diagnostic] final HTTP response", {
      reportId: result.report.id,
      partialSuccess: false,
      status: 201
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[booking-reports:diagnostic] final HTTP response", {
      partialSuccess: false,
      status: 500,
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save booking report" },
      { status: 500 }
    );
  }
}
