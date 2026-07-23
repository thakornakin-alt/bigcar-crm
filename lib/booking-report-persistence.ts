import type { BookingDeliveryRecord, BookingReport, BookingReportInput } from "./types";

export async function saveBookingReportAndMaster(
  input: BookingReportInput,
  dependencies: {
    saveReport: (input: BookingReportInput) => Promise<BookingReport>;
    upsertMaster: (report: BookingReport) => Promise<BookingDeliveryRecord>;
  }
) {
  const report = await dependencies.saveReport(input);
  const masterStartedAt = new Date();
  console.info("[booking-delivery-master:diagnostic] entering upsertBookingDeliveryFromBookingReport()", {
    reportId: report.id,
    bookingDate: report.bookingDate,
    payload: report,
    startTimestamp: masterStartedAt.toISOString()
  });
  try {
    const bookingDelivery = await dependencies.upsertMaster(report);
    const masterEndedAt = new Date();
    console.info("[booking-delivery-master:diagnostic] Master response", {
      reportId: report.id,
      endTimestamp: masterEndedAt.toISOString(),
      elapsedMs: masterEndedAt.getTime() - masterStartedAt.getTime(),
      response: bookingDelivery,
      partialSuccess: false
    });
    return { report, bookingDelivery, partialSuccess: false as const, warning: "" };
  } catch (deliveryError) {
    const masterEndedAt = new Date();
    console.error("[booking-delivery-master:diagnostic] Master exception", {
      reportId: report.id,
      endTimestamp: masterEndedAt.toISOString(),
      elapsedMs: masterEndedAt.getTime() - masterStartedAt.getTime(),
      name: deliveryError instanceof Error ? deliveryError.name : "UnknownError",
      message: deliveryError instanceof Error ? deliveryError.message : String(deliveryError),
      stack: deliveryError instanceof Error ? deliveryError.stack : undefined,
      partialSuccess: true
    });
    const warning = deliveryError instanceof Error ? deliveryError.message : "Unable to save Booking Delivery Master";
    return {
      report,
      bookingDelivery: null,
      partialSuccess: true as const,
      warning: `Booking Report saved, but Booking Delivery Master failed: ${warning}`
    };
  }
}
