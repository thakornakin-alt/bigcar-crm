import assert from "node:assert/strict";
import test from "node:test";
import { adaptBookingDeliveryToCommissionCandidate, commissionCandidateReadiness, normalizeCommissionPlate, type CommissionCandidateSources } from "../lib/commission-candidate.ts";
import type { BookingDeliveryRecord, SalesUser } from "../lib/types.ts";

function record(overrides: Partial<BookingDeliveryRecord> = {}): BookingDeliveryRecord {
  return {
    id: "CASE-1", bookingId: "BK-1", bookingReportId: "BR-1", salesReportId: "SR-1", plate: "1ขด 8124", customerName: "Fixture", brand: "TOYOTA", model: "REVO", year: "2021", color: "", engineNo: "", chassisNo: "",
    saleName: "ฐากร กาญจนอังกูร", teamName: "", teamId: "", source: "", ownership: "", project: "", campaign: "", bookingPrice: "", salePrice: "500000", finalPrice: "490000", centralDiscount: "10000", bookingDeduction: "", downPayment: "", netPayment: "", paymentType: "",
    deliveryDate: "2026-08-10", deliveryLocation: "", garageOutDate: "", garageReturnDate: "", spaFullSystemDone: false, oilChangeDone: false, decalRemovalDone: false, insuranceDone: false,
    workflowStatus: "รอส่งมอบ", financeCaseSubmitted: false, financeCaseSubmittedAt: "", financeCaseNote: "", financeAttachmentIds: [], status: "รอส่งมอบ", statusSource: "auto", summary: "", alertSummary: "", cancelReason: "", createdAt: "", updatedAt: "", isCounted: true, caseStatus: "waiting_delivery", ...overrides
  };
}

function user(id: string, firstName = "ฐากร", lastName = "กาญจนอังกูร", nickname = "บิ๊ก"): SalesUser {
  return { id, createdAt: "", updatedAt: "", email: `${id}@example.test`, firstName, lastName, nickname, phone: "", lineId: "", lineQrUrl: "", avatarUrl: "", position: "Sales", branch: "บางนา", role: "sales", locked: false };
}

const safeSources: CommissionCandidateSources = { salesUsers: [user("USER-1")] };

test("salesperson resolution uses explicit stable ID before exact unique full name", () => {
  const explicit = adaptBookingDeliveryToCommissionCandidate(record({ salespersonUserId: "USER-EXPLICIT", saleName: "ไม่ตรงชื่อ" }), { salesUsers: [user("USER-EXPLICIT")] });
  assert.equal(explicit.salespersonUserId, "USER-EXPLICIT");
  const exact = adaptBookingDeliveryToCommissionCandidate(record(), safeSources);
  assert.equal(exact.salespersonUserId, "USER-1");
  assert.equal(exact.sourceTrace.salespersonUserIdSource.kind, "sales_users");
});

test("duplicate full names and nickname-only values never resolve", () => {
  const duplicate = adaptBookingDeliveryToCommissionCandidate(record(), { salesUsers: [user("USER-1"), user("USER-2")] });
  assert.equal(duplicate.salespersonUserId, undefined);
  assert.ok(duplicate.needsReviewReasons.includes("missing_salesperson_identity"));
  assert.ok(duplicate.needsReviewReasons.includes("legacy_data_conflict"));
  const nickname = adaptBookingDeliveryToCommissionCandidate(record({ saleName: "บิ๊ก" }), safeSources);
  assert.equal(nickname.salespersonUserId, undefined);
});

test("owner and current actor are never substituted as commission recipient", () => {
  const candidate = adaptBookingDeliveryToCommissionCandidate(record({ ownerUserId: "OWNER-1", saleName: "" }), { salesUsers: [user("OWNER-1")] });
  assert.equal(candidate.salespersonUserId, undefined);
  assert.ok(candidate.needsReviewReasons.includes("missing_salesperson_identity"));
});

test("explicit Commission Group wins and exact stable Booking List resolves otherwise", () => {
  const explicit = adaptBookingDeliveryToCommissionCandidate(record({ commissionGroup: "G2" }), { ...safeSources, bookingList: [{ rowRef: "row 1", bookingCaseId: "CASE-1", plate: "1ขด8124", commissionGroup: "G3" }] });
  assert.equal(explicit.commissionGroup, "G2");
  assert.equal(explicit.sourceTrace.commissionGroupSource.kind, "booking_delivery");
  const joined = adaptBookingDeliveryToCommissionCandidate(record(), { ...safeSources, bookingList: [{ rowRef: "row 1", bookingCaseId: "CASE-1", plate: "different", commissionGroup: "G3" }] });
  assert.equal(joined.commissionGroup, "G3");
  assert.match(joined.sourceTrace.commissionGroupSource.reference || "", /stable_id/);
});

test("FinalGrade is ignored; missing, duplicate and invalid CAR GROUP need review", () => {
  const finalGradeOnly = adaptBookingDeliveryToCommissionCandidate(record({ finalGrade: "G1" } as Partial<BookingDeliveryRecord>), safeSources);
  assert.equal(finalGradeOnly.commissionGroup, undefined);
  const duplicate = adaptBookingDeliveryToCommissionCandidate(record(), { ...safeSources, bookingList: [
    { rowRef: "row 1", plate: "1ขด8124", commissionGroup: "G1" },
    { rowRef: "row 2", plate: "1ขด 8124", commissionGroup: "G2" }
  ] });
  assert.equal(duplicate.commissionGroup, undefined);
  assert.ok(duplicate.needsReviewReasons.includes("legacy_data_conflict"));
  const invalid = adaptBookingDeliveryToCommissionCandidate(record(), { ...safeSources, bookingList: [{ rowRef: "row 1", bookingCaseId: "CASE-1", plate: "x", commissionGroup: "FINAL-A" }] });
  assert.ok(invalid.needsReviewReasons.includes("invalid_commission_group"));
});

test("plate normalization is exact and does not erase punctuation", () => {
  assert.equal(normalizeCommissionPlate(" 1ขด 8124 "), "1ขด8124");
  assert.notEqual(normalizeCommissionPlate("1ขด-8124"), normalizeCommissionPlate("1ขด 8124"));
});

test("authoritative prices derive discount and preserve explicit reliable discount", () => {
  const derived = adaptBookingDeliveryToCommissionCandidate(record({ commissionGroup: "G1", centralDiscount: "" }), safeSources);
  assert.equal(derived.discountAmount, 10000);
  assert.equal(derived.sourceTrace.discountSource.kind, "derived");
  const explicit = adaptBookingDeliveryToCommissionCandidate(record({ commissionGroup: "G1", centralDiscount: "8000", finalPrice: "492000" }), safeSources);
  assert.equal(explicit.discountAmount, 8000);
  assert.equal(explicit.sourceTrace.discountSource.reference, "centralDiscount");
});

test("negative derived discount and missing prices are review issues", () => {
  const negative = adaptBookingDeliveryToCommissionCandidate(record({ commissionGroup: "G1", salePrice: "490000", finalPrice: "500000", centralDiscount: "" }), safeSources);
  assert.ok(negative.needsReviewReasons.includes("invalid_discount"));
  const missing = adaptBookingDeliveryToCommissionCandidate(record({ commissionGroup: "G1", salePrice: "", finalPrice: "", centralDiscount: "" }), safeSources);
  assert.ok(missing.needsReviewReasons.includes("missing_standard_price"));
  assert.ok(missing.needsReviewReasons.includes("missing_sale_price"));
});

test("repair and preparation costs never enter discount", () => {
  const withRepairContext = record({ commissionGroup: "G1", centralDiscount: "" }) as BookingDeliveryRecord & { repairCost: number; garageCost: number };
  withRepairContext.repairCost = 50000;
  withRepairContext.garageCost = 10000;
  assert.equal(adaptBookingDeliveryToCommissionCandidate(withRepairContext, safeSources).discountAmount, 10000);
});

test("recognition readiness distinguishes delivered, working, manual cutoff and recognized", () => {
  const complete = { ...safeSources, bookingList: [{ rowRef: "row 1", bookingCaseId: "CASE-1", plate: "1ขด8124", commissionGroup: "G1" }] };
  const delivered = adaptBookingDeliveryToCommissionCandidate(record({ caseStatus: "delivered", status: "ยอดส่งมอบ", deliveredAt: "2026-08-10T12:00:00+07:00" }), complete);
  assert.equal(delivered.recognitionState, "eligible_for_recognition");
  assert.equal(delivered.proposedRecognizedMonth, "2026-08");
  assert.equal(adaptBookingDeliveryToCommissionCandidate(record(), complete).recognitionState, "working");
  assert.equal(adaptBookingDeliveryToCommissionCandidate(record(), { ...complete, manualCutoffBookingCaseIds: new Set(["CASE-1"]) }).recognitionState, "eligible_for_recognition");
  assert.equal(adaptBookingDeliveryToCommissionCandidate(record(), { ...complete, recognizedBookingCaseIds: new Set(["CASE-1"]) }).recognitionState, "recognized");
});

test("delivered without actual deliveredAt is review, never inferred from deliveryDate", () => {
  const candidate = adaptBookingDeliveryToCommissionCandidate(record({ commissionGroup: "G1", caseStatus: "delivered", status: "ยอดส่งมอบ", deliveredAt: undefined, deliveryDate: "2026-08-10" }), safeSources);
  assert.equal(candidate.proposedRecognizedMonth, undefined);
  assert.ok(candidate.needsReviewReasons.includes("missing_recognition_date"));
  assert.equal(candidate.recognitionState, "needs_review");
});

test("cancelled counted is blocked, QA and not-counted are excluded", () => {
  const cancelled = adaptBookingDeliveryToCommissionCandidate(record({ commissionGroup: "G1", caseStatus: "cancelled", status: "ยกเลิก" }), safeSources);
  assert.equal(cancelled.quality, "BLOCKED");
  assert.ok(cancelled.needsReviewReasons.includes("cancelled_but_counted"));
  assert.equal(adaptBookingDeliveryToCommissionCandidate(record({ commissionGroup: "G1", qaTestRecord: true }), safeSources).quality, "EXCLUDED");
  assert.equal(adaptBookingDeliveryToCommissionCandidate(record({ commissionGroup: "G1", isCounted: false }), safeSources).quality, "EXCLUDED");
});

test("readiness aggregation preserves every problematic candidate", () => {
  const report = commissionCandidateReadiness([
    record({ id: "READY", commissionGroup: "G1" }),
    record({ id: "REVIEW", saleName: "unknown" }),
    record({ id: "EXCLUDED", commissionGroup: "G1", qaTestRecord: true }),
    record({ id: "BLOCKED", commissionGroup: "G1", caseStatus: "cancelled", status: "ยกเลิก" })
  ], safeSources);
  assert.deepEqual(report.counts, { ready: 1, needsReview: 1, excluded: 1, blocked: 1 });
  assert.equal(report.candidates.length, 4);
});
