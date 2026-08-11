import test from "node:test";
import assert from "node:assert/strict";
import { derivePrepReminder, prepStatusForRecord } from "../lib/rdd-phase3c.ts";
import { validateRddWorkspaceChanges } from "../lib/rdd-workspace-write.ts";
import type { BookingDeliveryRecord } from "../lib/types.ts";

function record(overrides: Partial<BookingDeliveryRecord> = {}): BookingDeliveryRecord {
  return { id: "CASE", bookingId: "BK", bookingReportId: "", salesReportId: "", plate: "กข 1", customerName: "ลูกค้า", brand: "", model: "", year: "", color: "", engineNo: "", chassisNo: "", saleName: "", teamName: "", teamId: "", source: "", ownership: "", project: "", campaign: "", bookingPrice: "", salePrice: "", finalPrice: "", centralDiscount: "", bookingDeduction: "", downPayment: "", netPayment: "", paymentType: "", deliveryDate: "2026-08-20", deliveryLocation: "", garageOutDate: "", garageReturnDate: "", spaFullSystemDone: false, oilChangeDone: false, decalRemovalDone: false, insuranceDone: false, workflowStatus: "รอส่งมอบ", financeCaseSubmitted: false, financeCaseSubmittedAt: "", financeCaseNote: "", financeAttachmentIds: [], status: "ยอดจอง", statusSource: "auto", summary: "", alertSummary: "", cancelReason: "", createdAt: "2026-08-01", updatedAt: "2026-08-01", purchaseType: "cash", caseStatus: "waiting_delivery", ...overrides };
}

test("Phase 3C canonical pending and terminal states", () => {
  const base = record({ washStatus: "not_ordered", stickerStatus: "not_checked", oilStatus: "change_waiting", batteryStatus: "not_checked", taxStatus: "not_checked", insuranceStatus: "not_discussed" });
  assert.equal(derivePrepReminder(base, "2026-08-11").pendingPrepCount, 6);
  const done = record({ washStatus: "completed", stickerStatus: "no_sticker", oilStatus: "no_change", batteryStatus: "good", taxStatus: "renewal_ordered", insuranceStatus: "customer_self" });
  assert.equal(derivePrepReminder(done, "2026-08-11").pendingPrepCount, 0);
});

test("garage reminder priority and returned behavior", () => {
  const garage = record({ garageRequired: true, garageExpectedReturnDate: "2026-08-10", washStatus: "completed", stickerStatus: "no_sticker", oilStatus: "no_change", batteryStatus: "good", taxStatus: "valid", insuranceStatus: "with_us" });
  assert.equal(derivePrepReminder(garage, "2026-08-11").priority, "urgent");
  assert.equal(derivePrepReminder({ ...garage, garageReturned: true }, "2026-08-11").pendingPrepCount, 0);
  assert.equal(derivePrepReminder({ ...garage, garageRequired: false }, "2026-08-11").pendingPrepCount, 0);
});

test("delivery urgency changes without resetting task state", () => {
  const source = record({ deliveryDate: "2026-08-11", batteryStatus: "ordered_waiting" });
  assert.equal(derivePrepReminder(source, "2026-08-11").priority, "urgent");
  assert.equal(derivePrepReminder({ ...source, deliveryDate: "2026-08-20" }, "2026-08-11").priority, "normal");
  assert.equal(source.batteryStatus, "ordered_waiting");
});

test("case status and QA suppress reminders but preserve fields", () => {
  const source = record({ batteryStatus: "ordered_waiting" });
  for (const caseStatus of ["customer_paused", "delivered", "cancelled"] as const) assert.equal(derivePrepReminder({ ...source, caseStatus }, "2026-08-11").eligible, false);
  assert.equal(derivePrepReminder({ ...source, purchaseType: "finance", caseStatus: "waiting_finance_result" }, "2026-08-11").eligible, false);
  assert.equal(derivePrepReminder({ ...source, purchaseType: "finance", caseStatus: "approved_waiting_delivery" }, "2026-08-11").eligible, true);
  assert.equal(derivePrepReminder({ ...source, qaTestRecord: true }, "2026-08-11").eligible, false);
});

test("legacy completed booleans are display-compatible without mutation", () => {
  const legacy = record({ spaFullSystemDone: true, decalRemovalDone: true, insuranceDone: true });
  assert.deepEqual(prepStatusForRecord(legacy), { washStatus: "completed", stickerStatus: "completed", oilStatus: undefined, batteryStatus: undefined, taxStatus: undefined, insuranceStatus: "with_us" });
  assert.equal(legacy.washStatus, undefined);
});

test("missing Phase 3C data remains unknown and creates no inferred reminder decision", () => {
  const historical = record();
  assert.deepEqual(prepStatusForRecord(historical), { washStatus: undefined, stickerStatus: undefined, oilStatus: undefined, batteryStatus: undefined, taxStatus: undefined, insuranceStatus: undefined });
  assert.equal(derivePrepReminder(historical, "2026-08-11").pendingPrepCount, 0);
  assert.equal(historical.oilStatus, undefined);
});

test("server validates Phase 3C enums, booleans and dates", () => {
  assert.deepEqual(validateRddWorkspaceChanges({ washStatus: "ordered_waiting", garageRequired: true, garageExpectedReturnDate: "2026-08-15" }), { washStatus: "ordered_waiting", garageRequired: true, garageExpectedReturnDate: "2026-08-15" });
  assert.throws(() => validateRddWorkspaceChanges({ taxStatus: "finished" }), /ไม่อยู่ในรายการ/);
  assert.throws(() => validateRddWorkspaceChanges({ garageReturned: "yes" }), /boolean/);
  assert.throws(() => validateRddWorkspaceChanges({ garageSentAt: "15\/08\/2026" }), /YYYY-MM-DD/);
});
