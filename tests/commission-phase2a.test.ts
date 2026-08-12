import assert from "node:assert/strict";
import test from "node:test";
import { calculateMonthlyStatement, createCommissionRuleSet } from "../lib/commission.ts";
import {
  addIsolatedAdjustment,
  assessRecognition,
  closeIsolatedStatement,
  commissionIsolatedView,
  disposeIsolatedCase,
  isolatedCommissionStore,
  recognizeIsolatedCase,
  resetIsolatedCommissionStoreForTests,
  reverseIsolatedSnapshot,
  type CommissionWorkingCase
} from "../lib/commission-persistence.ts";

const actor = "USER-ADMIN-FIXTURE";
const now = "2026-08-12T12:00:00+07:00";

function caseRecord(overrides: Partial<CommissionWorkingCase> = {}): CommissionWorkingCase {
  return { bookingCaseId: "CASE-X", salespersonUserId: "USER-SALES", salespersonDisplayName: "Sales Fixture", vehiclePlate: "FIXTURE", commissionGroup: "G1", discountAmount: 0, isCounted: true, caseStatus: "waiting_delivery", sourceMonth: "2026-08", ...overrides };
}

test.beforeEach(() => resetIsolatedCommissionStoreForTests());

test("recognition state machine separates lifecycle from isCounted", () => {
  assert.equal(assessRecognition(caseRecord({ caseStatus: "delivered", deliveredAt: now })).state, "eligible_for_recognition");
  assert.equal(assessRecognition(caseRecord(), true).state, "eligible_for_recognition");
  assert.equal(assessRecognition(caseRecord()).state, "working");
  assert.equal(assessRecognition(caseRecord({ caseStatus: "cancelled" })).state, "recognition_blocked");
  assert.equal(assessRecognition(caseRecord({ isCounted: false })).state, "recognition_blocked");
  assert.equal(assessRecognition(caseRecord({ qaTestRecord: true })).state, "recognition_blocked");
  assert.equal(assessRecognition(caseRecord({ excludeFromMetrics: true })).state, "recognition_blocked");
  assert.equal(assessRecognition(caseRecord({ salespersonUserId: undefined })).state, "needs_review");
  assert.equal(assessRecognition(caseRecord({ commissionGroup: undefined })).state, "needs_review");
});

test("delivered recognition creates immutable idempotent snapshot and actor activity", () => {
  const first = recognizeIsolatedCase({ bookingCaseId: "ISO-DELIVERED-G1", method: "delivered", recognizedMonth: "2026-08", actorUserId: actor, now });
  const second = recognizeIsolatedCase({ bookingCaseId: "ISO-DELIVERED-G1", method: "delivered", recognizedMonth: "2026-08", actorUserId: actor, now });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.snapshot.id, second.snapshot.id);
  assert.equal(Object.isFrozen(first.snapshot), true);
  assert.equal(isolatedCommissionStore().activity[0].actorUserId, actor);
});

test("waiting case requires explicit manual cutoff", () => {
  assert.throws(() => recognizeIsolatedCase({ bookingCaseId: "ISO-WAITING-G2", method: "delivered", recognizedMonth: "2026-08", actorUserId: actor, now }), /ไม่สามารถรับรู้/);
  const result = recognizeIsolatedCase({ bookingCaseId: "ISO-WAITING-G2", method: "manual_cutoff", recognizedMonth: "2026-08", actorUserId: actor, now });
  assert.equal(result.snapshot.recognitionMethod, "manual_cutoff");
});

test("cancelled counted case stays visible but cannot produce snapshot", () => {
  assert.equal(commissionIsolatedView().cases.some((item) => item.bookingCaseId === "ISO-CANCELLED"), true);
  assert.throws(() => recognizeIsolatedCase({ bookingCaseId: "ISO-CANCELLED", method: "manual_cutoff", recognizedMonth: "2026-08", actorUserId: actor, now }), /cancelled/);
  assert.equal(isolatedCommissionStore().snapshots.length, 0);
});

test("carry forward is historical and does not recognize; no-carry never enters next queue", () => {
  const carry = disposeIsolatedCase({ bookingCaseId: "ISO-WAITING-G2", sourceMonth: "2026-07", action: "carry_forward", actorUserId: actor, now });
  const noCarry = disposeIsolatedCase({ bookingCaseId: "ISO-PAUSED-G3", sourceMonth: "2026-07", action: "do_not_carry", reason: "customer_paused", actorUserId: actor, now });
  assert.equal(carry.targetMonth, "2026-08");
  assert.equal(noCarry.targetMonth, undefined);
  assert.equal(isolatedCommissionStore().snapshots.length, 0);
  assert.equal(isolatedCommissionStore().dispositions.length, 2);
  assert.equal(isolatedCommissionStore().dispositions.filter((item) => item.action === "do_not_carry").length, 1);
  isolatedCommissionStore().cases.push(caseRecord({ bookingCaseId: "NEW-BOOKING", vehiclePlate: "NEW FIXTURE" }));
  assert.equal(isolatedCommissionStore().cases.some((item) => item.bookingCaseId === "NEW-BOOKING"), true);
});

test("adjustment requires reason and reversal preserves original snapshot", () => {
  const recognized = recognizeIsolatedCase({ bookingCaseId: "ISO-DELIVERED-G1", method: "delivered", recognizedMonth: "2026-08", actorUserId: actor, now });
  assert.throws(() => addIsolatedAdjustment({ snapshotId: recognized.snapshot.id, amount: -1500, reason: "", actorUserId: actor, now }), /เหตุผล/);
  const adjustment = addIsolatedAdjustment({ snapshotId: recognized.snapshot.id, amount: -1500, reason: "อนุมัติค่าปรับสภาพ", actorUserId: actor, now });
  const reversal = reverseIsolatedSnapshot({ snapshotId: recognized.snapshot.id, reason: "แก้ไขรายการ", actorUserId: actor, now });
  assert.equal(adjustment.originalSnapshotId, recognized.snapshot.id);
  assert.equal(reversal.originalSnapshotId, recognized.snapshot.id);
  assert.equal(isolatedCommissionStore().snapshots[0].status, "recognized");
});

test("monthly statement is closed append-only with locked Step and fuel", () => {
  recognizeIsolatedCase({ bookingCaseId: "ISO-DELIVERED-G1", method: "delivered", recognizedMonth: "2026-08", actorUserId: actor, now });
  recognizeIsolatedCase({ bookingCaseId: "ISO-WAITING-G2", method: "manual_cutoff", recognizedMonth: "2026-08", actorUserId: actor, now });
  const statement = closeIsolatedStatement({ salespersonUserId: "USER-PREVIEW-BIG", month: "2026-08", actorUserId: actor, now });
  assert.equal(statement.status, "closed");
  assert.equal(statement.totalPhysicalCars, 2);
  assert.equal(statement.totalWeightedCars, 2);
  assert.equal(statement.monthlyStep, 0);
  assert.equal(statement.fuelAllowance, 0);
  assert.equal(statement.finalTotal, statement.netVehicleCommission + statement.manualAdjustments + statement.monthlyStep + statement.fuelAllowance);
  assert.equal(closeIsolatedStatement({ salespersonUserId: "USER-PREVIEW-BIG", month: "2026-08", actorUserId: actor, now }), statement);
});

test("month-specific G3 rule never mutates old recognized snapshot", () => {
  const store = isolatedCommissionStore();
  store.cases.push(caseRecord({ bookingCaseId: "G3-AUG", commissionGroup: "G3", caseStatus: "delivered", deliveredAt: now }));
  store.cases.push(caseRecord({ bookingCaseId: "G3-SEP", commissionGroup: "G3", caseStatus: "delivered", deliveredAt: "2026-09-02T10:00:00+07:00", sourceMonth: "2026-09" }));
  const august = recognizeIsolatedCase({ bookingCaseId: "G3-AUG", method: "delivered", recognizedMonth: "2026-08", actorUserId: actor, now }).snapshot;
  const september = recognizeIsolatedCase({ bookingCaseId: "G3-SEP", method: "delivered", recognizedMonth: "2026-09", actorUserId: actor, now }).snapshot;
  assert.equal(august.grossVehicleCommission, 7000);
  assert.equal(september.grossVehicleCommission, 15000);
  assert.equal(august.grossVehicleCommission, 7000);
});

test("statement formula remains the Phase 1 engine", () => {
  const rules = createCommissionRuleSet("2026-08");
  const result = calculateMonthlyStatement([], rules, "USER");
  assert.equal(result.finalTotal, 0);
  assert.deepEqual(result.recognizedSnapshotIds, []);
});
