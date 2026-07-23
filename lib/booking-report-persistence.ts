import type { BookingDeliveryRecord, BookingReport, BookingReportInput } from "./types";

export async function saveBookingReportAndMaster(
  input: BookingReportInput,
  dependencies: {
    saveReport: (input: BookingReportInput) => Promise<BookingReport>;
    upsertMaster: (report: BookingReport) => Promise<BookingDeliveryRecord>;
  }
) {
  const report = await dependencies.saveReport(input);
  try {
    const bookingDelivery = await dependencies.upsertMaster(report);
    return { report, bookingDelivery, partialSuccess: false as const, warning: "" };
  } catch (deliveryError) {
    const warning = deliveryError instanceof Error ? deliveryError.message : "Unable to save Booking Delivery Master";
    return {
      report,
      bookingDelivery: null,
      partialSuccess: true as const,
      warning: `Booking Report saved, but Booking Delivery Master failed: ${warning}`
    };
  }
}
