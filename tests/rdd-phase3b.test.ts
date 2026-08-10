import assert from "node:assert/strict";
import test from "node:test";
import { deriveRddHomeKpis, deriveRddReminders, legacyStatusForRecord, purchaseTypeForRecord, upcomingRddDeliveries } from "../lib/rdd-phase2.ts";
import { RDD_CASH_STATUSES, RDD_FINANCE_STATUSES, isStatusValidForPurchaseType, reminderEligibleForRecord } from "../lib/rdd-phase3b.ts";
import { validateRddWorkspaceChanges } from "../lib/rdd-workspace-write.ts";
import type { BookingDeliveryRecord } from "../lib/types.ts";

function record(overrides: Partial<BookingDeliveryRecord> = {}): BookingDeliveryRecord {
  return {
    id: "CASE", bookingId: "BK", bookingReportId: "", salesReportId: "", plate: "กข 1", customerName: "ลูกค้า", brand: "", model: "", year: "", color: "", engineNo: "", chassisNo: "", saleName: "", teamName: "", teamId: "", source: "", ownership: "", project: "", campaign: "", bookingPrice: "", salePrice: "", finalPrice: "", centralDiscount: "", bookingDeduction: "", downPayment: "", netPayment: "", paymentType: "ไฟแนนซ์", deliveryDate: "2026-08-15", deliveryLocation: "", garageOutDate: "", garageReturnDate: "", spaFullSystemDone: true, oilChangeDone: false, decalRemovalDone: true, insuranceDone: false, workflowStatus: "รอส่งมอบ", financeCaseSubmitted: false, financeCaseSubmittedAt: "", financeCaseNote: "", financeAttachmentIds: [], status: "ยอดจอง", statusSource: "auto", summary: "", alertSummary: "", cancelReason: "", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z", bookingDate: "2026-08-01", ...overrides
  };
}

test("purchase type is explicit-only and historical missing metadata is preserved", () => {
  assert.equal(purchaseTypeForRecord(record()), "ไม่ระบุ");
  assert.equal(purchaseTypeForRecord(record({ purchaseType: "cash" })), "ซื้อสด");
  assert.equal(purchaseTypeForRecord(record({ purchaseType: "finance" })), "ไฟแนนซ์");
  assert.throws(() => validateRddWorkspaceChanges({ purchaseType: "other" }), /cash หรือ finance/);
});

test("all cash and finance statuses validate only for their purchase type", () => {
  for (const status of RDD_CASH_STATUSES) assert.equal(isStatusValidForPurchaseType("cash", status), true);
  for (const status of RDD_FINANCE_STATUSES) assert.equal(isStatusValidForPurchaseType("finance", status), true);
  assert.equal(isStatusValidForPurchaseType("cash", "waiting_finance_result"), false);
  assert.equal(isStatusValidForPurchaseType("finance", "waiting_delivery"), false);
  assert.equal(isStatusValidForPurchaseType("cash", "unknown"), false);
});

test("reminder eligibility follows canonical workflow without resetting task data", () => {
  const prep = { spaFullSystemDone: true, decalRemovalDone: true };
  for (const status of ["waiting_delivery", "settled_waiting_delivery"] as const) assert.equal(reminderEligibleForRecord(record({ purchaseType: "cash", caseStatus: status })), true);
  for (const status of ["waiting_finance_submission", "waiting_finance_result"] as const) assert.equal(reminderEligibleForRecord(record({ purchaseType: "finance", caseStatus: status })), false);
  for (const status of ["approved_waiting_delivery", "settled_waiting_delivery"] as const) assert.equal(reminderEligibleForRecord(record({ purchaseType: "finance", caseStatus: status })), true);
  const paused = record({ purchaseType: "finance", caseStatus: "customer_paused", ...prep });
  assert.equal(reminderEligibleForRecord(paused), false);
  const resumed = { ...paused, caseStatus: "approved_waiting_delivery" as const };
  assert.equal(reminderEligibleForRecord(resumed), true);
  assert.equal(resumed.spaFullSystemDone, true);
  assert.equal(resumed.decalRemovalDone, true);
  for (const status of ["delivered", "cancelled"] as const) assert.equal(reminderEligibleForRecord(record({ purchaseType: "cash", caseStatus: status })), false);
});

test("canonical KPI and reminder selectors react to status and appointment changes", () => {
  const records = [
    record({ id: "submit", purchaseType: "finance", caseStatus: "waiting_finance_submission" }),
    record({ id: "result", purchaseType: "finance", caseStatus: "waiting_finance_result" }),
    record({ id: "approved", purchaseType: "finance", caseStatus: "approved_waiting_delivery", deliveryDate: "2026-08-17" }),
    record({ id: "cash", purchaseType: "cash", caseStatus: "waiting_delivery", deliveryDate: "2026-08-10" }),
    record({ id: "paused", purchaseType: "cash", caseStatus: "customer_paused", deliveryDate: "2026-08-10" }),
    record({ id: "delivered", purchaseType: "cash", caseStatus: "delivered", deliveredAt: undefined }),
    record({ id: "qa", purchaseType: "cash", caseStatus: "waiting_delivery", excludeFromMetrics: true })
  ];
  const kpis = deriveRddHomeKpis(records, 2026, 8);
  assert.equal(kpis.waitingFinanceSubmission, 1);
  assert.equal(kpis.waitingFinanceResult, 1);
  assert.equal(kpis.waitingDelivery, 2);
  assert.equal(kpis.customerPaused, 1);
  assert.equal(deriveRddReminders(records, "2026-08-10")[0].count, 1);
  assert.deepEqual(upcomingRddDeliveries(records, "2026-08-10").map((item) => item.id), ["cash", "approved"]);
  const rescheduled = records.map((item) => item.id === "cash" ? { ...item, deliveryDate: "2026-08-17" } : item);
  assert.equal(deriveRddReminders(rescheduled, "2026-08-10")[0].count, 0);
});

test("legacy values render compatibly without mutation or purchase inference", () => {
  const legacy = record({ caseStatus: undefined, purchaseType: undefined, workflowStatus: "รอผลไฟแนนซ์" });
  const before = structuredClone(legacy);
  assert.equal(legacyStatusForRecord(legacy), "รอผลไฟแนนซ์");
  assert.equal(purchaseTypeForRecord(legacy), "ไม่ระบุ");
  assert.deepEqual(legacy, before);
});

test("delivery validation accepts canonical values and rejects malformed inputs", () => {
  assert.deepEqual(validateRddWorkspaceChanges({ deliveryDate: "2026-08-17", deliveryTime: "14:30", deliveryLocation: "นอกสถานที่", deliveryLocationNote: "บ้านลูกค้า" }), { deliveryDate: "2026-08-17", deliveryTime: "14:30", deliveryLocation: "นอกสถานที่", deliveryLocationNote: "บ้านลูกค้า" });
  assert.throws(() => validateRddWorkspaceChanges({ deliveryDate: "2026-02-30" }), /YYYY-MM-DD/);
  assert.throws(() => validateRddWorkspaceChanges({ deliveryTime: "25:00" }), /HH:mm/);
  assert.throws(() => validateRddWorkspaceChanges({ deliveryLocation: "ที่อื่น" }), /ไม่อยู่ในรายการ/);
  assert.throws(() => validateRddWorkspaceChanges({ deliveryLocationNote: "ก".repeat(301) }), /300/);
  assert.throws(() => validateRddWorkspaceChanges({ financeCaseNote: "ก".repeat(1001) }), /1,000/);
});
