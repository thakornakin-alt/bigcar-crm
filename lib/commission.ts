import type { BookingDeliveryRecord } from "@/lib/types";

export type CommissionGroup = "G1" | "G2" | "G3";
export type DiscountTierId = "up_to_6000" | "6001_to_10000" | "10001_to_20000" | "20001_to_30000" | "over_30000";

export type CommissionDiscountTier = {
  id: DiscountTierId;
  min: number;
  max?: number;
  countWeight: number;
  rates: Record<CommissionGroup, number>;
};

export type CommissionRuleSet = {
  id: string;
  month: string;
  withholdingRate: number;
  fuelAllowanceThreshold: number;
  fuelAllowanceAmount: number;
  discountTiers: CommissionDiscountTier[];
  monthlySteps: Array<{ threshold: number; amount: number }>;
};

export type CommissionSnapshot = {
  id: string;
  bookingCaseId: string;
  bookingReportId?: string;
  salesReportId?: string;
  salespersonUserId: string;
  salespersonDisplayName: string;
  vehiclePlate: string;
  vehicleModel?: string;
  commissionGroup: CommissionGroup;
  standardPrice?: number;
  salePrice?: number;
  discountAmount: number;
  discountTier: DiscountTierId;
  countWeight: number;
  grossVehicleCommission: number;
  withholdingTaxAmount: number;
  netVehicleCommission: number;
  manualAdjustment: number;
  manualAdjustmentReason?: string;
  recognizedAt: string;
  recognizedMonth: string;
  recognitionMethod: "delivered" | "manual_cutoff";
  ruleVersionId: string;
  calculatedAt: string;
  sourceFingerprint: string;
  status: "recognized" | "reversed" | "corrected";
};

export type MonthlyCommissionStatement = {
  salespersonUserId: string;
  month: string;
  recognizedSnapshots: CommissionSnapshot[];
  totalPhysicalCars: number;
  totalWeightedCars: number;
  grossVehicleCommission: number;
  withholdingTax: number;
  netVehicleCommission: number;
  manualAdjustments: number;
  monthlyStep: number;
  fuelAllowance: number;
  finalTotal: number;
  ruleVersionId: string;
  status: "draft" | "closed";
  closedAt?: string;
  closedByUserId?: string;
};

export type CommissionMonthlyDisposition = {
  bookingCaseId: string;
  sourceMonth: string;
  action: "carry_forward" | "do_not_carry";
  reason?: "cancelled" | "customer_paused" | "other";
  targetMonth?: string;
  actorUserId: string;
  actedAt: string;
};

export type VehicleCommissionInput = {
  group: CommissionGroup;
  discountAmount: number;
  manualAdjustment?: number;
  manualAdjustmentReason?: string;
};

export type VehicleCommissionResult = {
  discountTier: DiscountTierId;
  countWeight: number;
  grossVehicleCommission: number;
  withholdingTaxAmount: number;
  netVehicleCommission: number;
  manualAdjustment: number;
  adjustedVehicleCommission: number;
};

const LOCKED_STEPS = [
  [4, 5_000], [5, 10_000], [6, 15_000], [7, 23_000], [8, 31_000], [9, 38_000],
  [10, 45_000], [11, 55_000], [13, 67_000], [15, 77_000], [20, 88_000]
] as const;

export function createCommissionRuleSet(month: string, options?: { g3BaseRate?: number }): CommissionRuleSet {
  const g3BaseRate = options?.g3BaseRate ?? 7_000;
  return {
    id: `${month}-commission-v1${g3BaseRate === 7_000 ? "" : `-g3-${g3BaseRate}`}`,
    month,
    withholdingRate: 0.03,
    fuelAllowanceThreshold: 3,
    fuelAllowanceAmount: 10_000,
    discountTiers: [
      { id: "up_to_6000", min: 0, max: 6_000, countWeight: 1, rates: { G1: 5_000, G2: 6_000, G3: g3BaseRate } },
      { id: "6001_to_10000", min: 6_001, max: 10_000, countWeight: 1, rates: { G1: 5_000, G2: 6_000, G3: g3BaseRate } },
      { id: "10001_to_20000", min: 10_001, max: 20_000, countWeight: 0.7, rates: { G1: 3_000, G2: 4_000, G3: 4_500 } },
      { id: "20001_to_30000", min: 20_001, max: 30_000, countWeight: 0.5, rates: { G1: 2_000, G2: 3_000, G3: 3_500 } },
      { id: "over_30000", min: 30_001, countWeight: 0, rates: { G1: 1_000, G2: 1_500, G3: 2_000 } }
    ],
    monthlySteps: LOCKED_STEPS.map(([threshold, amount]) => ({ threshold, amount }))
  };
}

function assertMoney(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) throw new Error(`${label} ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป`);
}

export function resolveDiscountTier(discountAmount: number, rules: CommissionRuleSet) {
  assertMoney(discountAmount, "ส่วนลด");
  const tier = rules.discountTiers.find((item) => discountAmount >= item.min && (item.max === undefined || discountAmount <= item.max));
  if (!tier) throw new Error("ไม่พบช่วงส่วนลดใน CommissionRuleSet");
  return tier;
}

export function calculateVehicleCommission(input: VehicleCommissionInput, rules: CommissionRuleSet): VehicleCommissionResult {
  const tier = resolveDiscountTier(input.discountAmount, rules);
  const adjustment = input.manualAdjustment ?? 0;
  if (!Number.isFinite(adjustment) || !Number.isInteger(adjustment)) throw new Error("Adjustment ต้องเป็นจำนวนเต็ม");
  if (adjustment !== 0 && !String(input.manualAdjustmentReason || "").trim()) throw new Error("Adjustment ที่ไม่เป็นศูนย์ต้องมีเหตุผล");
  const gross = tier.rates[input.group];
  const tax = Math.round(gross * rules.withholdingRate);
  const net = gross - tax;
  return {
    discountTier: tier.id,
    countWeight: tier.countWeight,
    grossVehicleCommission: gross,
    withholdingTaxAmount: tax,
    netVehicleCommission: net,
    manualAdjustment: adjustment,
    adjustedVehicleCommission: net + adjustment
  };
}

export function calculateWeightedCount(items: Array<{ countWeight: number }>) {
  return Math.round(items.reduce((total, item) => total + item.countWeight, 0) * 10) / 10;
}

export function lookupMonthlyStep(weightedCount: number, rules: CommissionRuleSet) {
  if (!Number.isFinite(weightedCount) || weightedCount < 0) throw new Error("จำนวนคันแบบ Step ไม่ถูกต้อง");
  return rules.monthlySteps.reduce((amount, step) => weightedCount >= step.threshold ? step.amount : amount, 0);
}

export function calculateFuelAllowance(weightedCount: number, rules: CommissionRuleSet) {
  if (!Number.isFinite(weightedCount) || weightedCount < 0) throw new Error("จำนวนคันสำหรับค่าน้ำมันไม่ถูกต้อง");
  return weightedCount >= rules.fuelAllowanceThreshold ? rules.fuelAllowanceAmount : 0;
}

export function calculateMonthlyStatement(snapshots: CommissionSnapshot[], rules: CommissionRuleSet, salespersonUserId: string): MonthlyCommissionStatement {
  const active = snapshots.filter((item) => item.status !== "reversed" && item.salespersonUserId === salespersonUserId && item.recognizedMonth === rules.month);
  const weighted = calculateWeightedCount(active);
  const gross = active.reduce((sum, item) => sum + item.grossVehicleCommission, 0);
  const tax = active.reduce((sum, item) => sum + item.withholdingTaxAmount, 0);
  const net = active.reduce((sum, item) => sum + item.netVehicleCommission, 0);
  const adjustments = active.reduce((sum, item) => sum + item.manualAdjustment, 0);
  const monthlyStep = lookupMonthlyStep(weighted, rules);
  const fuelAllowance = calculateFuelAllowance(weighted, rules);
  return {
    salespersonUserId,
    month: rules.month,
    recognizedSnapshots: active,
    totalPhysicalCars: active.length,
    totalWeightedCars: weighted,
    grossVehicleCommission: gross,
    withholdingTax: tax,
    netVehicleCommission: net,
    manualAdjustments: adjustments,
    monthlyStep,
    fuelAllowance,
    finalTotal: net + adjustments + monthlyStep + fuelAllowance,
    ruleVersionId: rules.id,
    status: "draft"
  };
}

export type CommissionReadinessReason = "not_counted" | "qa_excluded" | "missing_commission_group" | "missing_salesperson_user_id" | "unrecognized";

export type CommissionCandidate = {
  record: BookingDeliveryRecord;
  state: "eligible" | "needs_review" | "excluded";
  reasons: CommissionReadinessReason[];
};

export function assessCommissionCandidate(record: BookingDeliveryRecord, salespersonIds: Readonly<Record<string, string>> = {}): CommissionCandidate {
  const reasons: CommissionReadinessReason[] = [];
  if (record.qaTestRecord === true || record.excludeFromMetrics === true) reasons.push("qa_excluded");
  if (record.isCounted === false) reasons.push("not_counted");
  if (!record.commissionGroup) reasons.push("missing_commission_group");
  if (!salespersonIds[record.saleName]) reasons.push("missing_salesperson_user_id");
  if (!record.deliveredAt && record.caseStatus !== "delivered") reasons.push("unrecognized");
  if (reasons.includes("qa_excluded") || reasons.includes("not_counted")) return { record, state: "excluded", reasons };
  return { record, state: reasons.length ? "needs_review" : "eligible", reasons };
}

export function commissionReadinessReport(records: BookingDeliveryRecord[], salespersonIds: Readonly<Record<string, string>> = {}) {
  const candidates = records.map((record) => assessCommissionCandidate(record, salespersonIds));
  const counts = (reason: CommissionReadinessReason) => candidates.filter((item) => item.reasons.includes(reason)).length;
  return {
    total: records.length,
    eligible: candidates.filter((item) => item.state === "eligible").length,
    needsReview: candidates.filter((item) => item.state === "needs_review").length,
    excluded: candidates.filter((item) => item.state === "excluded").length,
    reasons: {
      missingCommissionGroup: counts("missing_commission_group"),
      missingSalespersonUserId: counts("missing_salesperson_user_id"),
      unrecognized: counts("unrecognized"),
      notCounted: counts("not_counted"),
      qaExcluded: counts("qa_excluded")
    }
  };
}
