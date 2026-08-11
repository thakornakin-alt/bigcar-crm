import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveRddHomeKpis,
  deriveRddReminders,
  filterRddWorkspaceRecords,
  legacyStatusForRecord,
  purchaseTypeForRecord,
  recordInRddMonth,
  recordMatchesRddSearch
} from "../lib/rdd-phase2.ts";
import type { BookingDeliveryRecord } from "../lib/types.ts";

function record(input: Partial<BookingDeliveryRecord> & Pick<BookingDeliveryRecord, "id">): BookingDeliveryRecord {
  return {
    bookingId: input.id,
    bookingReportId: "",
    salesReportId: "",
    plate: "",
    customerName: "",
    brand: "",
    model: "",
    year: "",
    color: "",
    engineNo: "",
    chassisNo: "",
    saleName: "",
    teamName: "",
    teamId: "",
    source: "",
    ownership: "",
    project: "",
    campaign: "",
    bookingPrice: "",
    salePrice: "",
    finalPrice: "",
    centralDiscount: "",
    bookingDeduction: "",
    downPayment: "",
    netPayment: "",
    paymentType: "",
    deliveryDate: "",
    deliveryLocation: "",
    garageOutDate: "",
    garageReturnDate: "",
    spaFullSystemDone: false,
    oilChangeDone: false,
    decalRemovalDone: false,
    insuranceDone: false,
    workflowStatus: "ยอดจอง",
    financeCaseSubmitted: false,
    financeCaseSubmittedAt: "",
    financeCaseNote: "",
    financeAttachmentIds: [],
    status: "ยอดจอง",
    statusSource: "auto",
    summary: "",
    alertSummary: "",
    cancelReason: "",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...input
  };
}

const fixtures = [
  record({ id: "mine", ownerUserId: "u1", bookingDate: "2026-08-02", plate: "กข 1234", customerName: "สมชาย", purchaseType: "finance", paymentType: "ไฟแนนซ์", workflowStatus: "รอผลไฟแนนซ์" }),
  record({ id: "unassigned", bookingDate: "2026-08-03", plate: "AB-9999", customerName: "Jane", purchaseType: "cash", paymentType: "เงินสด", workflowStatus: "รอส่งมอบ", deliveryDate: "2026-08-10" }),
  record({ id: "delivered", ownerUserId: "u2", bookingDate: "2026-07-20", status: "ยอดส่งมอบ", workflowStatus: "ยอดส่งมอบ", deliveredAt: "2026-08-04" }),
  record({ id: "unknown-date", ownerUserId: "u1", bookingDate: undefined, plate: "UNKNOWN" })
];

test("legacy status mapping is display-only and conservative", () => {
  assert.equal(legacyStatusForRecord(fixtures[0]), "รอผลไฟแนนซ์");
  assert.equal(legacyStatusForRecord(fixtures[2]), "ส่งมอบแล้ว");
  assert.equal(legacyStatusForRecord(record({ id: "legacy" })), "ยอดจองทั้งหมด");
  assert.equal(purchaseTypeForRecord(fixtures[0]), "ไฟแนนซ์");
  assert.equal(purchaseTypeForRecord(record({ id: "legacy-payment", paymentType: "ไฟแนนซ์" })), "ไม่ระบุ");
  assert.equal(purchaseTypeForRecord(record({ id: "missing" })), "ไม่ระบุ");
});

test("historical missing bookingDate remains visible in every selected month", () => {
  assert.equal(recordInRddMonth(fixtures[3], 2026, 8), true);
  assert.equal(recordInRddMonth(fixtures[3], 2025, 1), true);
});

test("All Mine and Unassigned use exact ownerUserId", () => {
  const base = { year: 2026, month: 8, userId: "u1" };
  assert.equal(filterRddWorkspaceRecords(fixtures, { ...base, scope: "all" }).length, 4);
  assert.deepEqual(filterRddWorkspaceRecords(fixtures, { ...base, scope: "mine" }).map((item) => item.id), ["mine", "unknown-date"]);
  assert.deepEqual(filterRddWorkspaceRecords(fixtures, { ...base, scope: "unassigned" }).map((item) => item.id), ["unassigned"]);
});

test("search prioritizes normalized registration and also matches customer", () => {
  assert.equal(recordMatchesRddSearch(fixtures[0], "กข1234"), true);
  assert.equal(recordMatchesRddSearch(fixtures[0], "สมชาย"), true);
  assert.equal(recordMatchesRddSearch(fixtures[0], "9999"), false);
});

test("month status and purchase filters are deterministic", () => {
  assert.deepEqual(filterRddWorkspaceRecords(fixtures, { year: 2026, month: 8, purchaseType: "ซื้อสด" }).map((item) => item.id), ["unassigned"]);
  assert.deepEqual(filterRddWorkspaceRecords(fixtures, { year: 2026, month: 8, status: "ส่งมอบแล้ว" }).map((item) => item.id), ["delivered"]);
  assert.deepEqual(filterRddWorkspaceRecords(fixtures, { year: 2026, month: 6 }).map((item) => item.id), ["unknown-date"]);
});

test("Home KPI uses reliable business dates only", () => {
  assert.deepEqual(deriveRddHomeKpis(fixtures, 2026, 8), {
    newBookings: 2,
    waitingFinanceSubmission: 0,
    waitingFinanceResult: 1,
    waitingDelivery: 1,
    delivered: 1,
    customerPaused: 0,
    unknownBookingDate: 1
  });
});

test("reminders derive only from existing delivery and garage dates", () => {
  const reminders = deriveRddReminders([
    record({ id: "today", deliveryDate: "2026-08-09" }),
    record({ id: "tomorrow", deliveryDate: "2026-08-10" }),
    record({ id: "overdue", deliveryDate: "2026-08-08" }),
    record({ id: "garage", garageReturnDate: "2026-08-09" }),
    record({ id: "done", status: "ยอดส่งมอบ", workflowStatus: "ยอดส่งมอบ", deliveryDate: "2026-08-09" })
  ], "2026-08-09");
  assert.deepEqual(reminders.map((item) => item.count), [1, 1, 1, 1, 1]);
});
