import test from "node:test";
import assert from "node:assert/strict";
import { deriveRddHomeKpis, deriveRddReminders, filterRddWorkspaceRecords, upcomingRddDeliveries } from "../lib/rdd-phase2.ts";
import { classifyQaRecord, dryRunQaMetadata } from "../lib/rdd-qa-audit.ts";
import type { BookingDeliveryRecord } from "../lib/types.ts";

function record(overrides: Partial<BookingDeliveryRecord> = {}): BookingDeliveryRecord {
  return {
    id: "CASE-1", bookingId: "BK-1", bookingReportId: "", salesReportId: "", bookingDate: "2026-08-02", plate: "กข 1", customerName: "ลูกค้า",
    brand: "Toyota", model: "Model", year: "2025", color: "ขาว", engineNo: "", chassisNo: "", saleName: "เซลล์", teamName: "", teamId: "",
    source: "", ownership: "", project: "", campaign: "", bookingPrice: "", salePrice: "", finalPrice: "", centralDiscount: "", bookingDeduction: "",
    downPayment: "", netPayment: "", paymentType: "", deliveryDate: "2026-08-10", deliveryLocation: "", garageOutDate: "", garageReturnDate: "",
    spaFullSystemDone: false, oilChangeDone: false, decalRemovalDone: false, insuranceDone: false, workflowStatus: "รอส่งมอบ", financeCaseSubmitted: false,
    financeCaseSubmittedAt: "", financeCaseNote: "", financeAttachmentIds: [], status: "ยอดจอง", statusSource: "auto", summary: "", alertSummary: "",
    cancelReason: "", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z", ...overrides
  };
}

test("historical records without QA metadata keep their previous operational behavior", () => {
  const historical = record({ id: "HISTORICAL", bookingDate: undefined, customerName: "TEST-like customer", plate: "TEST 123" });
  assert.deepEqual(filterRddWorkspaceRecords([historical], { year: 2026, month: 8 }).map((item) => item.id), ["HISTORICAL"]);
  assert.equal(deriveRddHomeKpis([historical], 2026, 8).unknownBookingDate, 1);
});

test("explicit QA metadata hides by default and can be displayed with the QA filter", () => {
  const qa = record({ id: "QA", qaTestRecord: true, excludeFromMetrics: true });
  assert.equal(filterRddWorkspaceRecords([qa], { year: 2026, month: 8 }).length, 0);
  assert.deepEqual(filterRddWorkspaceRecords([qa], { year: 2026, month: 8, includeQa: true }).map((item) => item.id), ["QA"]);
});

test("excludeFromMetrics removes KPI reminders and upcoming delivery without changing ownership rules", () => {
  const normalMine = record({ id: "MINE", ownerUserId: "u1" });
  const excludedMine = record({ id: "QA-MINE", ownerUserId: "u1", qaTestRecord: true, excludeFromMetrics: true });
  const unassigned = record({ id: "UNASSIGNED", deliveryDate: "2026-08-11" });
  const records = [normalMine, excludedMine, unassigned];
  assert.equal(deriveRddHomeKpis(records, 2026, 8).waitingDelivery, 2);
  assert.deepEqual(deriveRddReminders(records, "2026-08-10").map((item) => item.count), [1, 1, 0, 0]);
  assert.deepEqual(upcomingRddDeliveries(records, "2026-08-09").map((item) => item.id), ["MINE", "UNASSIGNED"]);
  assert.deepEqual(filterRddWorkspaceRecords(records, { year: 2026, month: 8, scope: "mine", userId: "u1" }).map((item) => item.id), ["MINE"]);
  assert.deepEqual(filterRddWorkspaceRecords(records, { year: 2026, month: 8, scope: "unassigned", userId: "u1" }).map((item) => item.id), ["UNASSIGNED"]);
});

test("isCounted and runtime TEST-like strings never become operational QA metadata", () => {
  const stringOnly = record({ id: "STRING", plate: "TESTV2-STRING", customerName: "TEST QA", isCounted: false });
  assert.equal(stringOnly.qaTestRecord, undefined);
  assert.equal(stringOnly.excludeFromMetrics, undefined);
  assert.deepEqual(filterRddWorkspaceRecords([stringOnly], { year: 2026, month: 8 }).map((item) => item.id), ["STRING"]);
  assert.equal(classifyQaRecord(stringOnly)?.confidence, "confirmed");
});

test("QA dry run is an in-memory simulation and does not mutate source records", () => {
  const confirmed = record({ id: "CONFIRMED", bookingDate: undefined });
  const normal = record({ id: "NORMAL", workflowStatus: "รอผลไฟแนนซ์" });
  const source = [confirmed, normal];
  const before = structuredClone(source);
  const result = dryRunQaMetadata(source, ["CONFIRMED"], 2026, 8, "2026-08-10");
  assert.equal(result.current.totalOperationalRecords, 2);
  assert.equal(result.expected.totalOperationalRecords, 1);
  assert.equal(result.current.unknownBookingDate, 1);
  assert.equal(result.expected.unknownBookingDate, 0);
  assert.deepEqual(source, before);
});
