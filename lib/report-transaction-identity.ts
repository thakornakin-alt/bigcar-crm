import type { ReportHistoryItem } from "@/lib/types";

export function normalizeTransactionPlate(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

export type ReadOnlyPlateLookup<T> =
  | { status: "not_found"; matches: [] }
  | { status: "unique_read_only_match"; match: T; matches: [T] }
  | { status: "conflict"; matches: T[] };

/** Plate is deliberately a read-only compatibility key, never a mutation target. */
export function lookupByPlateReadOnly<T>(records: T[], plate: unknown, getPlate: (record: T) => unknown): ReadOnlyPlateLookup<T> {
  const normalizedPlate = normalizeTransactionPlate(plate);
  if (!normalizedPlate) return { status: "not_found", matches: [] };
  const matches = records.filter((record) => normalizeTransactionPlate(getPlate(record)) === normalizedPlate);
  if (matches.length === 0) return { status: "not_found", matches: [] };
  if (matches.length === 1) return { status: "unique_read_only_match", match: matches[0], matches: [matches[0]] };
  return { status: "conflict", matches };
}

export type SalesRelationshipResolution =
  | { status: "resolved"; sale: ReportHistoryItem; source: "bookingReportId" | "unique_legacy_plate" }
  | { status: "not_found" | "conflict"; sale?: undefined; source?: undefined };

export function salesReportsForExactBooking(
  reports: ReportHistoryItem[],
  bookingReportId: unknown
) {
  const stableId = String(bookingReportId || "").trim();
  if (!stableId) return [];
  return reports
    .filter((report) => report.type === "sales" && String(report.bookingReportId || "") === stableId)
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
}

/**
 * Resolve a sale for read-side presentation. Exact bookingReportId is authoritative.
 * Legacy plate fallback is allowed only when both booking and sale history are unique.
 */
export function resolveSaleForBookingReadOnly(
  booking: ReportHistoryItem,
  bookings: ReportHistoryItem[],
  sales: ReportHistoryItem[]
): SalesRelationshipResolution {
  const exact = sales.filter((sale) => String(sale.bookingReportId || "") === booking.id);
  if (exact.length === 1) return { status: "resolved", sale: exact[0], source: "bookingReportId" };
  if (exact.length > 1) return { status: "conflict" };

  const bookingPlate = lookupByPlateReadOnly(bookings, booking.plate, (record) => record.plate);
  const salesPlate = lookupByPlateReadOnly(sales, booking.plate, (record) => record.plate);
  if (bookingPlate.status === "conflict" || salesPlate.status === "conflict") return { status: "conflict" };
  if (bookingPlate.status === "unique_read_only_match" && salesPlate.status === "unique_read_only_match") {
    return { status: "resolved", sale: salesPlate.match, source: "unique_legacy_plate" };
  }
  return { status: "not_found" };
}
