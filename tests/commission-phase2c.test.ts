import test from "node:test";
import assert from "node:assert/strict";
import { applyCanonicalCommissionCapture, resolveAuthenticatedSalespersonCapture, resolveCommissionGroupCapture } from "../lib/commission-canonical-capture.ts";
import type { BookingDeliveryRecord, SalesUser } from "../lib/types.ts";

const actor: SalesUser = { id: "USER-1", createdAt: "", updatedAt: "", email: "sales@example.com", firstName: "ฐากร", lastName: "กาญจนอังกูร", nickname: "บิ๊ก", phone: "", lineId: "", lineQrUrl: "", avatarUrl: "", position: "", branch: "", role: "sales", locked: false };
function record(overrides: Partial<BookingDeliveryRecord> = {}): BookingDeliveryRecord {
  return { id: "CASE-1", bookingId: "BK-1", bookingReportId: "BR-1", salesReportId: "SR-1", plate: "1ขด 8124", customerName: "Fixture", brand: "", model: "", year: "", color: "", engineNo: "", chassisNo: "", saleName: "ฐากร", teamName: "", teamId: "", source: "", ownership: "", project: "", campaign: "", bookingPrice: "", salePrice: "500000", finalPrice: "490000", centralDiscount: "10000", bookingDeduction: "", downPayment: "", netPayment: "", paymentType: "", deliveryDate: "", deliveryLocation: "", garageOutDate: "", garageReturnDate: "", spaFullSystemDone: false, oilChangeDone: false, decalRemovalDone: false, insuranceDone: false, workflowStatus: "", financeCaseSubmitted: false, financeCaseSubmittedAt: "", financeCaseNote: "", financeAttachmentIds: [], status: "ยอดจอง", statusSource: "auto", summary: "", alertSummary: "", cancelReason: "", createdAt: "", updatedAt: "", ...overrides };
}

test("canonical self-selection captures stable salesperson ID and display name", () => {
  const capture = resolveAuthenticatedSalespersonCapture({ submittedSalespersonUserId: "USER-1", submittedSaleName: "ฐากร", actor });
  assert.deepEqual(capture, { salespersonUserId: "USER-1", salespersonDisplayName: "ฐากร กาญจนอังกูร (บิ๊ก)" });
});

test("free text, nickname, owner and a later editor never become salesperson identity", () => {
  assert.equal(resolveAuthenticatedSalespersonCapture({ submittedSalespersonUserId: undefined, submittedSaleName: "ฐากร", actor }), undefined);
  assert.equal(resolveAuthenticatedSalespersonCapture({ submittedSalespersonUserId: "USER-1", submittedSaleName: "บิ๊ก", actor }), undefined);
  assert.equal(resolveAuthenticatedSalespersonCapture({ submittedSalespersonUserId: "OWNER-9", submittedSaleName: "ฐากร", actor }), undefined);
  const existing = record({ salespersonUserId: "USER-ORIGINAL", salespersonDisplayName: "Original" });
  const result = applyCanonicalCommissionCapture(existing, { salesperson: { salespersonUserId: "USER-EDITOR", salespersonDisplayName: "Editor" } });
  assert.equal(result.record.salespersonUserId, "USER-ORIGINAL");
  assert.deepEqual(result.changedFields, []);
});

for (const group of ["G1", "G2", "G3"] as const) {
  test(`exact stable source captures ${group} with trace and timestamp`, () => {
    const result = resolveCommissionGroupCapture(record(), [{ sourceRef: `row-${group}`, bookingReportId: "BR-1", commissionGroup: group, plate: "อื่น" }], "2026-08-12T12:00:00Z");
    assert.deepEqual(result, { commissionGroup: group, commissionGroupSource: `booking_list:row-${group}`, commissionGroupCapturedAt: "2026-08-12T12:00:00Z" });
  });
}

test("plate fallback requires one exact normalized match and never uses FinalGrade", () => {
  const duplicate = resolveCommissionGroupCapture(record(), [
    { sourceRef: "row-1", plate: "1ขด8124", commissionGroup: "G1" },
    { sourceRef: "row-2", plate: "1ขด 8124", commissionGroup: "G2" }
  ], "2026-08-12T12:00:00Z");
  assert.equal(duplicate, undefined);
  assert.equal(resolveCommissionGroupCapture(record(), [{ sourceRef: "row-final", plate: "1ขด8124", commissionGroup: "FINAL-A" }], "2026-08-12T12:00:00Z"), undefined);
  assert.equal(resolveCommissionGroupCapture(record(), [], "2026-08-12T12:00:00Z"), undefined);
});

test("controlled pre-recognition group update records only canonical metadata changes", () => {
  const group = resolveCommissionGroupCapture(record(), [{ sourceRef: "row-2", bookingCaseId: "CASE-1", commissionGroup: "G2" }], "2026-08-12T12:00:00Z");
  const result = applyCanonicalCommissionCapture(record({ commissionGroup: "G1", commissionGroupSource: "booking_list:row-1" }), { group });
  assert.equal(result.record.commissionGroup, "G2");
  assert.deepEqual(result.changedFields, ["commissionGroup", "commissionGroupSource", "commissionGroupCapturedAt"]);
  assert.deepEqual(result.activityActions, ["commission_group_updated"]);
});

test("recognized state refuses group mutation and preserves historical snapshot input", () => {
  const original = record({ commissionGroup: "G1", commissionGroupSource: "booking_list:row-1", commissionGroupCapturedAt: "2026-08-01T00:00:00Z" });
  const group = resolveCommissionGroupCapture(original, [{ sourceRef: "row-2", bookingCaseId: "CASE-1", commissionGroup: "G3" }], "2026-08-12T12:00:00Z");
  const result = applyCanonicalCommissionCapture(original, { group, recognized: true });
  assert.equal(result.record.commissionGroup, "G1");
  assert.deepEqual(result.changedFields, []);
  assert.deepEqual(result.activityActions, []);
});

test("historical record remains byte-for-byte unchanged when capture input is absent", () => {
  const historical = record();
  const result = applyCanonicalCommissionCapture(historical, {});
  assert.deepEqual(result.record, historical);
  assert.equal(result.record.salespersonUserId, undefined);
  assert.equal(result.record.commissionGroup, undefined);
});
