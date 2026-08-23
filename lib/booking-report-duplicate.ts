import type { BookingReportInput } from "@/lib/types";

export type BookingCustomerIdentity =
  | { type: "citizen_or_tax_id"; value: string }
  | { type: "customer_name"; value: string }
  | { type: "unproven"; value: "" };

export type BookingDuplicateMatch = {
  bookingReportId: string;
  bookingDate: string;
  customerName: string;
  plate: string;
  salespersonDisplayName: string;
  status: string;
};

export type BookingDuplicateCheck = {
  requiresConfirmation: boolean;
  normalizedPlate: string;
  customerIdentityType: BookingCustomerIdentity["type"];
  matches: BookingDuplicateMatch[];
  confirmationToken?: string;
};

export function normalizeBookingPlate(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export function resolveBookingCustomerIdentity(
  input: Pick<BookingReportInput, "idCard" | "customerName">
): BookingCustomerIdentity {
  const identifier = String(input.idCard || "").trim();
  if (identifier) return { type: "citizen_or_tax_id", value: identifier };
  const name = String(input.customerName || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("th-TH");
  return name ? { type: "customer_name", value: name } : { type: "unproven", value: "" };
}

export function isSameProvenBookingCustomer(
  left: Pick<BookingReportInput, "idCard" | "customerName">,
  right: Pick<BookingReportInput, "idCard" | "customerName">
) {
  const a = resolveBookingCustomerIdentity(left);
  const b = resolveBookingCustomerIdentity(right);
  return a.type !== "unproven" && a.type === b.type && a.value === b.value;
}

export function requiresBookingDuplicateConfirmation(
  draft: Pick<BookingReportInput, "idCard" | "customerName" | "plate">,
  existing: Pick<BookingReportInput, "idCard" | "customerName" | "plate">
) {
  return normalizeBookingPlate(draft.plate) === normalizeBookingPlate(existing.plate)
    && isSameProvenBookingCustomer(draft, existing);
}

export function createBookingRequestId() {
  return crypto.randomUUID();
}
