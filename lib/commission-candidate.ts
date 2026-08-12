import type { BookingDeliveryRecord, SalesUser } from "@/lib/types";
import type { CommissionGroup } from "@/lib/commission";

export type CommissionCandidateState = "working" | "eligible_for_recognition" | "needs_review" | "recognition_blocked" | "recognized";
export type CommissionCandidateQuality = "READY" | "NEEDS_REVIEW" | "EXCLUDED" | "BLOCKED";

export type CommissionCandidateIssue =
  | "missing_salesperson_identity"
  | "missing_commission_group"
  | "invalid_commission_group"
  | "missing_standard_price"
  | "missing_sale_price"
  | "invalid_discount"
  | "missing_recognition_date"
  | "cancelled_but_counted"
  | "legacy_data_conflict"
  | "qa_excluded"
  | "not_counted";

export type CommissionFieldSource = {
  kind: "booking_delivery" | "booking_list" | "booking_report" | "sales_report" | "sales_users" | "derived" | "unresolved";
  reference?: string;
};

export type CommissionBookingListSource = {
  rowRef: string;
  bookingCaseId?: string;
  bookingReportId?: string;
  salesReportId?: string;
  plate: string;
  commissionGroup?: string;
  standardPrice?: string | number;
};

export type CommissionReportSource = {
  id: string;
  salespersonUserId?: string;
  salespersonDisplayName?: string;
  salePrice?: string | number;
  finalPrice?: string | number;
  centralDiscount?: string | number;
  discount?: string | number;
};

export type CommissionCandidateSources = {
  salesUsers?: readonly SalesUser[];
  bookingList?: readonly CommissionBookingListSource[];
  bookingReports?: readonly CommissionReportSource[];
  salesReports?: readonly CommissionReportSource[];
  recognizedBookingCaseIds?: ReadonlySet<string>;
  manualCutoffBookingCaseIds?: ReadonlySet<string>;
};

export type CanonicalCommissionCandidate = {
  bookingCaseId: string;
  bookingReportId?: string;
  salesReportId?: string;
  vehiclePlate: string;
  vehicleModel: string;
  salespersonUserId?: string;
  salespersonDisplayName?: string;
  commissionGroup?: CommissionGroup;
  standardPrice?: number;
  salePrice?: number;
  discountAmount?: number;
  purchaseType?: "cash" | "finance";
  caseStatus: string;
  deliveryDate?: string;
  deliveredAt?: string;
  proposedRecognizedMonth?: string;
  isCounted: boolean;
  qaTestRecord: boolean;
  excludeFromMetrics: boolean;
  recognitionState: CommissionCandidateState;
  quality: CommissionCandidateQuality;
  needsReviewReasons: CommissionCandidateIssue[];
  sourceTrace: {
    salespersonUserIdSource: CommissionFieldSource;
    commissionGroupSource: CommissionFieldSource;
    standardPriceSource: CommissionFieldSource;
    salePriceSource: CommissionFieldSource;
    discountSource: CommissionFieldSource;
  };
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function money(value: unknown): number | undefined {
  if (value === null || value === undefined || text(value) === "") return undefined;
  const normalized = typeof value === "number" ? value : Number(text(value).replace(/,/g, ""));
  return Number.isFinite(normalized) && Number.isInteger(normalized) && normalized >= 0 ? normalized : undefined;
}

export function normalizeCommissionPlate(value: string) {
  return text(value).normalize("NFKC").toUpperCase().replace(/\s+/g, "");
}

function exactReport(recordId: string, rows: readonly CommissionReportSource[] | undefined) {
  if (!recordId) return undefined;
  const matches = (rows || []).filter((item) => item.id === recordId);
  return matches.length === 1 ? matches[0] : undefined;
}

function matchingBookingList(record: BookingDeliveryRecord, rows: readonly CommissionBookingListSource[]) {
  const stable = rows.filter((row) =>
    (row.bookingCaseId && row.bookingCaseId === record.id) ||
    (row.bookingReportId && row.bookingReportId === record.bookingReportId) ||
    (row.salesReportId && row.salesReportId === record.salesReportId)
  );
  if (stable.length) return { matches: stable, method: "stable_id" as const };
  const plate = normalizeCommissionPlate(record.plate);
  if (!plate) return { matches: [], method: "none" as const };
  return { matches: rows.filter((row) => normalizeCommissionPlate(row.plate) === plate), method: "normalized_plate" as const };
}

function exactSalesperson(record: BookingDeliveryRecord, sources: CommissionCandidateSources, salesReport?: CommissionReportSource, bookingReport?: CommissionReportSource) {
  const recordExplicit = text(record.salespersonUserId);
  const salesReportExplicit = text(salesReport?.salespersonUserId);
  const bookingReportExplicit = text(bookingReport?.salespersonUserId);
  const explicit = recordExplicit || salesReportExplicit || bookingReportExplicit;
  const users = sources.salesUsers || [];
  if (explicit) {
    const user = users.find((item) => item.id === explicit);
    const source: CommissionFieldSource = recordExplicit
      ? { kind: "booking_delivery", reference: "salespersonUserId" }
      : salesReportExplicit
        ? { kind: "sales_report", reference: salesReport?.id }
        : { kind: "booking_report", reference: bookingReport?.id };
    return { id: explicit, name: text(record.salespersonDisplayName) || text(salesReport?.salespersonDisplayName) || text(bookingReport?.salespersonDisplayName) || (user ? `${user.firstName} ${user.lastName}`.trim() : text(record.saleName)), source };
  }
  const saleName = text(record.saleName);
  const matches = users.filter((item) => `${text(item.firstName)} ${text(item.lastName)}`.trim() === saleName);
  if (saleName && matches.length === 1) return { id: matches[0].id, name: saleName, source: { kind: "sales_users", reference: `exact-full-name:${matches[0].id}` } satisfies CommissionFieldSource };
  return { id: undefined, name: saleName || undefined, source: { kind: "unresolved", reference: matches.length > 1 ? "duplicate-exact-full-name" : "no-exact-full-name" } satisfies CommissionFieldSource, conflict: matches.length > 1 };
}

function deliveryMonth(value: string | undefined) {
  const raw = text(value);
  if (!raw) return undefined;
  const match = raw.match(/^(\d{4})-(\d{2})/);
  if (!match) return undefined;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? `${match[1]}-${match[2]}` : undefined;
}

export function adaptBookingDeliveryToCommissionCandidate(record: BookingDeliveryRecord, sources: CommissionCandidateSources = {}): CanonicalCommissionCandidate {
  const issues: CommissionCandidateIssue[] = [];
  const bookingReport = exactReport(record.bookingReportId, sources.bookingReports);
  const salesReport = exactReport(record.salesReportId, sources.salesReports);
  const salesperson = exactSalesperson(record, sources, salesReport, bookingReport);
  if (!salesperson.id) issues.push("missing_salesperson_identity");
  if (salesperson.conflict) issues.push("legacy_data_conflict");

  const bookingListJoin = matchingBookingList(record, sources.bookingList || []);
  const bookingListRow = bookingListJoin.matches.length === 1 ? bookingListJoin.matches[0] : undefined;
  if (bookingListJoin.matches.length > 1) issues.push("legacy_data_conflict");

  const explicitGroup = text((record as BookingDeliveryRecord & { commissionGroup?: string }).commissionGroup);
  let commissionGroup: CommissionGroup | undefined;
  let commissionGroupSource: CommissionFieldSource = { kind: "unresolved" };
  if (explicitGroup) {
    if (["G1", "G2", "G3"].includes(explicitGroup)) {
      commissionGroup = explicitGroup as CommissionGroup;
      commissionGroupSource = { kind: "booking_delivery", reference: "commissionGroup" };
    } else issues.push("invalid_commission_group");
  } else if (bookingListRow) {
    const group = text(bookingListRow.commissionGroup);
    if (["G1", "G2", "G3"].includes(group)) {
      commissionGroup = group as CommissionGroup;
      commissionGroupSource = { kind: "booking_list", reference: `${bookingListRow.rowRef}:${bookingListJoin.method}` };
    } else if (group) issues.push("invalid_commission_group");
  }
  if (!commissionGroup) issues.push("missing_commission_group");

  const recordStandard = money(record.salePrice);
  const salesStandard = money(salesReport?.salePrice);
  const bookingStandard = money(bookingReport?.salePrice);
  const listStandard = money(bookingListRow?.standardPrice);
  const standardPrice = recordStandard ?? salesStandard ?? bookingStandard ?? listStandard;
  const standardPriceSource: CommissionFieldSource = recordStandard !== undefined ? { kind: "booking_delivery", reference: "salePrice" } : salesStandard !== undefined ? { kind: "sales_report", reference: salesReport?.id } : bookingStandard !== undefined ? { kind: "booking_report", reference: bookingReport?.id } : listStandard !== undefined ? { kind: "booking_list", reference: bookingListRow?.rowRef } : { kind: "unresolved" };

  const recordSale = money(record.finalPrice);
  const salesFinal = money(salesReport?.finalPrice);
  const bookingFinal = money(bookingReport?.finalPrice);
  const salePrice = recordSale ?? salesFinal ?? bookingFinal;
  const salePriceSource: CommissionFieldSource = recordSale !== undefined ? { kind: "booking_delivery", reference: "finalPrice" } : salesFinal !== undefined ? { kind: "sales_report", reference: salesReport?.id } : bookingFinal !== undefined ? { kind: "booking_report", reference: bookingReport?.id } : { kind: "unresolved" };
  if (standardPrice === undefined) issues.push("missing_standard_price");
  if (salePrice === undefined) issues.push("missing_sale_price");

  const explicitDiscount = money(record.centralDiscount) ?? money(salesReport?.centralDiscount) ?? money(bookingReport?.discount);
  const derivedDiscount = standardPrice !== undefined && salePrice !== undefined ? standardPrice - salePrice : undefined;
  let discountAmount: number | undefined;
  let discountSource: CommissionFieldSource = { kind: "unresolved" };
  if (explicitDiscount !== undefined) {
    discountAmount = explicitDiscount;
    discountSource = money(record.centralDiscount) !== undefined ? { kind: "booking_delivery", reference: "centralDiscount" } : money(salesReport?.centralDiscount) !== undefined ? { kind: "sales_report", reference: salesReport?.id } : { kind: "booking_report", reference: bookingReport?.id };
    if (derivedDiscount !== undefined && derivedDiscount >= 0 && explicitDiscount !== derivedDiscount) issues.push("legacy_data_conflict");
  } else if (derivedDiscount !== undefined && derivedDiscount >= 0) {
    discountAmount = derivedDiscount;
    discountSource = { kind: "derived", reference: "standardPrice-salePrice" };
  }
  if (derivedDiscount !== undefined && derivedDiscount < 0) issues.push("invalid_discount");
  if (discountAmount === undefined && standardPrice !== undefined && salePrice !== undefined) issues.push("invalid_discount");

  const isCounted = record.isCounted !== false;
  const qaTestRecord = record.qaTestRecord === true;
  const excludeFromMetrics = record.excludeFromMetrics === true;
  const caseStatus = text(record.caseStatus) || text(record.status);
  const cancelled = record.caseStatus === "cancelled" || record.status === "ยกเลิก";
  const delivered = record.caseStatus === "delivered" || record.status === "ยอดส่งมอบ";
  const proposedRecognizedMonth = deliveryMonth(record.deliveredAt);
  if (cancelled && isCounted) issues.push("cancelled_but_counted");
  if (delivered && !proposedRecognizedMonth) issues.push("missing_recognition_date");

  let quality: CommissionCandidateQuality;
  let recognitionState: CommissionCandidateState;
  if (qaTestRecord || excludeFromMetrics || !isCounted) {
    quality = "EXCLUDED";
    recognitionState = "recognition_blocked";
    if (qaTestRecord || excludeFromMetrics) issues.push("qa_excluded");
    if (!isCounted) issues.push("not_counted");
  } else if (cancelled) {
    quality = "BLOCKED";
    recognitionState = "recognition_blocked";
  } else if (sources.recognizedBookingCaseIds?.has(record.id)) {
    quality = "READY";
    recognitionState = "recognized";
  } else {
    const critical = issues.some((item) => ["missing_salesperson_identity", "missing_commission_group", "invalid_commission_group", "missing_standard_price", "missing_sale_price", "invalid_discount", "missing_recognition_date", "legacy_data_conflict"].includes(item));
    if (critical) {
      quality = "NEEDS_REVIEW";
      recognitionState = "needs_review";
    } else if (delivered || sources.manualCutoffBookingCaseIds?.has(record.id)) {
      quality = "READY";
      recognitionState = "eligible_for_recognition";
    } else {
      quality = "READY";
      recognitionState = "working";
    }
  }

  return {
    bookingCaseId: record.id,
    bookingReportId: text(record.bookingReportId) || undefined,
    salesReportId: text(record.salesReportId) || undefined,
    vehiclePlate: text(record.plate),
    vehicleModel: [text(record.brand), text(record.model), text(record.year)].filter(Boolean).join(" "),
    salespersonUserId: salesperson.id,
    salespersonDisplayName: salesperson.name,
    commissionGroup,
    standardPrice,
    salePrice,
    discountAmount,
    purchaseType: record.purchaseType,
    caseStatus,
    deliveryDate: text(record.deliveryDate) || undefined,
    deliveredAt: text(record.deliveredAt) || undefined,
    proposedRecognizedMonth,
    isCounted,
    qaTestRecord,
    excludeFromMetrics,
    recognitionState,
    quality,
    needsReviewReasons: Array.from(new Set(issues)),
    sourceTrace: {
      salespersonUserIdSource: salesperson.source,
      commissionGroupSource,
      standardPriceSource,
      salePriceSource,
      discountSource
    }
  };
}

export function commissionCandidateReadiness(records: readonly BookingDeliveryRecord[], sources: CommissionCandidateSources = {}) {
  const candidates = records.map((record) => adaptBookingDeliveryToCommissionCandidate(record, sources));
  return {
    candidates,
    counts: {
      ready: candidates.filter((item) => item.quality === "READY").length,
      needsReview: candidates.filter((item) => item.quality === "NEEDS_REVIEW").length,
      excluded: candidates.filter((item) => item.quality === "EXCLUDED").length,
      blocked: candidates.filter((item) => item.quality === "BLOCKED").length
    }
  };
}

export const COMMISSION_ISSUE_LABELS: Record<CommissionCandidateIssue, string> = {
  missing_salesperson_identity: "ไม่มี Salesperson ID",
  missing_commission_group: "ไม่มี Commission Group",
  invalid_commission_group: "Commission Group ไม่ถูกต้อง",
  missing_standard_price: "ไม่มีราคามาตรฐาน",
  missing_sale_price: "ไม่มีราคาขาย",
  invalid_discount: "ส่วนลดไม่ถูกต้อง",
  missing_recognition_date: "ไม่มีวันส่งมอบจริง",
  cancelled_but_counted: "ยกเลิกแต่ยังนับ",
  legacy_data_conflict: "ข้อมูลต้นทางขัดแย้ง/ซ้ำ",
  qa_excluded: "ข้อมูล QA/Test",
  not_counted: "ไม่นับค่าคอม"
};
