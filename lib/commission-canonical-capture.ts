import type { BookingDeliveryRecord, SalesUser } from "./types";

type CommissionGroup = "G1" | "G2" | "G3";

export type CanonicalSalespersonCapture = { salespersonUserId: string; salespersonDisplayName: string };
export type AuthoritativeCommissionGroupSource = { sourceRef: string; bookingCaseId?: string; bookingReportId?: string; salesReportId?: string; plate?: string; commissionGroup?: string };
export type CommissionGroupCapture = { commissionGroup: CommissionGroup; commissionGroupSource: string; commissionGroupCapturedAt: string };

function clean(value: unknown) { return String(value ?? "").trim(); }
function normalizePlate(value: unknown) { return clean(value).normalize("NFKC").toUpperCase().replace(/\s+/g, ""); }

export function canonicalSalespersonDisplayName(user: Pick<SalesUser, "firstName" | "lastName" | "nickname" | "email">) {
  const fullName = [clean(user.firstName), clean(user.lastName)].filter(Boolean).join(" ");
  if (fullName && clean(user.nickname)) return `${fullName} (${clean(user.nickname)})`;
  return fullName || clean(user.nickname) || clean(user.email);
}

/** Free text never becomes an ID; this only accepts an exact self-selection. */
export function resolveAuthenticatedSalespersonCapture(input: { submittedSalespersonUserId?: unknown; submittedSaleName?: unknown; actor: Pick<SalesUser, "id" | "firstName" | "lastName" | "nickname" | "email"> }): CanonicalSalespersonCapture | undefined {
  if (clean(input.submittedSalespersonUserId) !== clean(input.actor.id)) return undefined;
  const submittedName = clean(input.submittedSaleName);
  const allowed = new Set([clean(input.actor.firstName), [clean(input.actor.firstName), clean(input.actor.lastName)].filter(Boolean).join(" ")].filter(Boolean));
  if (!allowed.has(submittedName)) return undefined;
  return { salespersonUserId: input.actor.id, salespersonDisplayName: canonicalSalespersonDisplayName(input.actor) };
}

function stableMatches(record: Pick<BookingDeliveryRecord, "id" | "bookingReportId" | "salesReportId">, row: AuthoritativeCommissionGroupSource) {
  return Boolean((row.bookingCaseId && row.bookingCaseId === record.id) || (row.bookingReportId && row.bookingReportId === record.bookingReportId) || (row.salesReportId && row.salesReportId === record.salesReportId));
}

/** Stable relationship first; normalized plate is accepted only when exactly unique. */
export function resolveCommissionGroupCapture(record: Pick<BookingDeliveryRecord, "id" | "bookingReportId" | "salesReportId" | "plate">, sources: readonly AuthoritativeCommissionGroupSource[], capturedAt: string): CommissionGroupCapture | undefined {
  const stable = sources.filter((row) => stableMatches(record, row));
  const plate = normalizePlate(record.plate);
  const matches = stable.length ? stable : sources.filter((row) => plate && normalizePlate(row.plate) === plate);
  if (matches.length !== 1) return undefined;
  const row = matches[0];
  if (row.commissionGroup !== "G1" && row.commissionGroup !== "G2" && row.commissionGroup !== "G3") return undefined;
  return { commissionGroup: row.commissionGroup, commissionGroupSource: `booking_list:${clean(row.sourceRef)}`, commissionGroupCapturedAt: capturedAt };
}

export function applyCanonicalCommissionCapture(record: BookingDeliveryRecord, input: { salesperson?: CanonicalSalespersonCapture; group?: CommissionGroupCapture; recognized?: boolean }) {
  const next = { ...record };
  const changedFields: string[] = [];
  const activityActions: Array<"commission_salesperson_captured" | "commission_group_captured" | "commission_group_updated"> = [];
  if (!next.salespersonUserId && input.salesperson) {
    next.salespersonUserId = input.salesperson.salespersonUserId;
    next.salespersonDisplayName = input.salesperson.salespersonDisplayName;
    changedFields.push("salespersonUserId", "salespersonDisplayName");
    activityActions.push("commission_salesperson_captured");
  }
  if (!input.recognized && input.group && (next.commissionGroup !== input.group.commissionGroup || next.commissionGroupSource !== input.group.commissionGroupSource)) {
    const action = next.commissionGroup ? "commission_group_updated" : "commission_group_captured";
    next.commissionGroup = input.group.commissionGroup;
    next.commissionGroupSource = input.group.commissionGroupSource;
    next.commissionGroupCapturedAt = input.group.commissionGroupCapturedAt;
    changedFields.push("commissionGroup", "commissionGroupSource", "commissionGroupCapturedAt");
    activityActions.push(action);
  }
  return { record: next, changedFields, activityActions };
}
