import test from "node:test";
import assert from "node:assert/strict";
import {
  assessCommissionCandidate,
  calculateFuelAllowance,
  calculateMonthlyStatement,
  calculateVehicleCommission,
  commissionReadinessReport,
  createCommissionRuleSet,
  lookupMonthlyStep,
  resolveDiscountTier,
  type CommissionSnapshot
} from "../lib/commission.ts";
import type { BookingDeliveryRecord } from "../lib/types.ts";

const rules = createCommissionRuleSet("2026-08");

test("discount tier boundaries are exact and inclusive", () => {
  assert.equal(resolveDiscountTier(6_000, rules).id, "up_to_6000");
  assert.equal(resolveDiscountTier(6_001, rules).id, "6001_to_10000");
  assert.equal(resolveDiscountTier(10_000, rules).id, "6001_to_10000");
  assert.equal(resolveDiscountTier(10_001, rules).id, "10001_to_20000");
  assert.equal(resolveDiscountTier(20_000, rules).id, "10001_to_20000");
  assert.equal(resolveDiscountTier(20_001, rules).id, "20001_to_30000");
  assert.equal(resolveDiscountTier(30_000, rules).id, "20001_to_30000");
  assert.equal(resolveDiscountTier(30_001, rules).id, "over_30000");
});

test("golden vehicle commission examples include G3 and tax only per car", () => {
  assert.deepEqual(calculateVehicleCommission({ group: "G1", discountAmount: 0 }, rules), {
    discountTier: "up_to_6000", countWeight: 1, grossVehicleCommission: 5_000, withholdingTaxAmount: 150,
    netVehicleCommission: 4_850, manualAdjustment: 0, adjustedVehicleCommission: 4_850
  });
  assert.equal(calculateVehicleCommission({ group: "G2", discountAmount: 8_000 }, rules).netVehicleCommission, 5_820);
  assert.deepEqual(calculateVehicleCommission({ group: "G3", discountAmount: 15_000 }, rules), {
    discountTier: "10001_to_20000", countWeight: 0.7, grossVehicleCommission: 4_500, withholdingTaxAmount: 135,
    netVehicleCommission: 4_365, manualAdjustment: 0, adjustedVehicleCommission: 4_365
  });
  assert.equal(calculateVehicleCommission({ group: "G1", discountAmount: 25_000 }, rules).netVehicleCommission, 1_940);
  assert.deepEqual(calculateVehicleCommission({ group: "G3", discountAmount: 35_000 }, rules), {
    discountTier: "over_30000", countWeight: 0, grossVehicleCommission: 2_000, withholdingTaxAmount: 60,
    netVehicleCommission: 1_940, manualAdjustment: 0, adjustedVehicleCommission: 1_940
  });
});

test("month-specific rule permits a different G3 base rate", () => {
  const special = createCommissionRuleSet("2026-09", { g3BaseRate: 15_000 });
  const result = calculateVehicleCommission({ group: "G3", discountAmount: 0 }, special);
  assert.equal(result.grossVehicleCommission, 15_000);
  assert.equal(result.withholdingTaxAmount, 450);
  assert.equal(result.netVehicleCommission, 14_550);
  assert.notEqual(special.id, rules.id);
});

test("monthly Step uses floor lookup without rounding weighted count", () => {
  const cases: Array<[number, number]> = [[2.9, 0], [3, 0], [4, 5_000], [4.9, 5_000], [5, 10_000], [9.7, 38_000], [11.9, 55_000], [12, 55_000], [13, 67_000], [14.9, 67_000], [15, 77_000], [19.9, 77_000], [20, 88_000]];
  for (const [count, expected] of cases) assert.equal(lookupMonthlyStep(count, rules), expected, String(count));
});

test("fuel allowance starts at exactly three weighted cars and stays 10000", () => {
  for (const [count, expected] of [[2.99, 0], [3, 10_000], [3.5, 10_000], [20, 10_000]] as const) assert.equal(calculateFuelAllowance(count, rules), expected);
});

test("non-zero manual adjustment requires a reason", () => {
  assert.throws(() => calculateVehicleCommission({ group: "G1", discountAmount: 0, manualAdjustment: -1_500 }, rules), /ต้องมีเหตุผล/);
  assert.equal(calculateVehicleCommission({ group: "G1", discountAmount: 0, manualAdjustment: -1_500, manualAdjustmentReason: "อนุมัติค่าปรับสภาพ" }, rules).adjustedVehicleCommission, 3_350);
});

test("monthly statement keeps Step and fuel outside withholding tax", () => {
  const base = calculateVehicleCommission({ group: "G1", discountAmount: 0 }, rules);
  const snapshots = Array.from({ length: 4 }, (_, index): CommissionSnapshot => ({
    id: `S${index}`, bookingCaseId: `C${index}`, salespersonUserId: "USER-1", salespersonDisplayName: "Sales",
    vehiclePlate: `TEST-${index}`, commissionGroup: "G1", discountAmount: 0, discountTier: base.discountTier,
    countWeight: base.countWeight, grossVehicleCommission: base.grossVehicleCommission, withholdingTaxAmount: base.withholdingTaxAmount,
    netVehicleCommission: base.netVehicleCommission, manualAdjustment: 0, recognizedAt: "2026-08-01T00:00:00+07:00",
    recognizedMonth: "2026-08", recognitionMethod: "delivered", ruleVersionId: rules.id, calculatedAt: "2026-08-01T00:00:00+07:00",
    sourceFingerprint: `fixture-${index}`, status: "recognized"
  }));
  const statement = calculateMonthlyStatement(snapshots, rules, "USER-1");
  assert.equal(statement.withholdingTax, 600);
  assert.equal(statement.monthlyStep, 5_000);
  assert.equal(statement.fuelAllowance, 10_000);
  assert.equal(statement.finalTotal, 34_400);
});

function record(overrides: Partial<BookingDeliveryRecord> = {}): BookingDeliveryRecord {
  return { id: "CASE", bookingId: "BK", bookingReportId: "BR", salesReportId: "", plate: "กข 1", customerName: "Customer", brand: "", model: "", year: "", color: "", engineNo: "", chassisNo: "", saleName: "บิ๊ก", teamName: "", teamId: "", source: "", ownership: "", project: "", campaign: "", bookingPrice: "", salePrice: "", finalPrice: "", centralDiscount: "", bookingDeduction: "", downPayment: "", netPayment: "", paymentType: "", deliveryDate: "", deliveryLocation: "", garageOutDate: "", garageReturnDate: "", spaFullSystemDone: false, oilChangeDone: false, decalRemovalDone: false, insuranceDone: false, workflowStatus: "", financeCaseSubmitted: false, financeCaseSubmittedAt: "", financeCaseNote: "", financeAttachmentIds: [], status: "ยอดจอง", statusSource: "auto", summary: "", alertSummary: "", cancelReason: "", createdAt: "", updatedAt: "", ...overrides };
}

test("real-data readiness never guesses commission group or salesperson identity", () => {
  const missing = assessCommissionCandidate(record());
  assert.equal(missing.state, "needs_review");
  assert.ok(missing.reasons.includes("missing_commission_group"));
  assert.ok(missing.reasons.includes("missing_salesperson_user_id"));
  const qa = assessCommissionCandidate(record({ qaTestRecord: true, commissionGroup: "G1" }), { "บิ๊ก": "USER-1" });
  assert.equal(qa.state, "excluded");
  const notCounted = assessCommissionCandidate(record({ isCounted: false }));
  assert.equal(notCounted.state, "excluded");
  const report = commissionReadinessReport([record(), record({ qaTestRecord: true })]);
  assert.equal(report.total, 2);
  assert.equal(report.needsReview, 1);
  assert.equal(report.excluded, 1);
});
