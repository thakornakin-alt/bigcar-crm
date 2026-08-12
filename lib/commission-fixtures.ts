import { calculateVehicleCommission, createCommissionRuleSet, type CommissionGroup, type CommissionSnapshot } from "@/lib/commission";

export const COMMISSION_PREVIEW_MONTH = "2026-08";
export const COMMISSION_PREVIEW_RULES = createCommissionRuleSet(COMMISSION_PREVIEW_MONTH);

const rows: Array<{ id: string; plate: string; model: string; group: CommissionGroup; discount: number; method: "delivered" | "manual_cutoff"; recognizedAt: string; adjustment?: number; reason?: string }> = [
  { id: "fixture-1", plate: "กข 1001", model: "TOYOTA REVO 2021", group: "G1", discount: 0, method: "delivered", recognizedAt: "2026-08-03T10:00:00+07:00" },
  { id: "fixture-2", plate: "กข 1002", model: "HONDA CITY 2020", group: "G2", discount: 8_000, method: "delivered", recognizedAt: "2026-08-06T11:00:00+07:00" },
  { id: "fixture-3", plate: "กข 1003", model: "ISUZU D-MAX 2022", group: "G3", discount: 15_000, method: "manual_cutoff", recognizedAt: "2026-08-09T09:30:00+07:00" },
  { id: "fixture-4", plate: "กข 1004", model: "FORD RANGER 2019", group: "G1", discount: 25_000, method: "delivered", recognizedAt: "2026-08-11T13:00:00+07:00" },
  { id: "fixture-5", plate: "กข 1005", model: "MG ZS 2021", group: "G3", discount: 35_000, method: "delivered", recognizedAt: "2026-08-12T15:00:00+07:00" }
];

export const COMMISSION_PREVIEW_SNAPSHOTS: CommissionSnapshot[] = rows.map((row) => {
  const result = calculateVehicleCommission({ group: row.group, discountAmount: row.discount, manualAdjustment: row.adjustment, manualAdjustmentReason: row.reason }, COMMISSION_PREVIEW_RULES);
  return {
    id: row.id,
    bookingCaseId: `case-${row.id}`,
    salespersonUserId: "USER-PREVIEW-BIG",
    salespersonDisplayName: "ฐากร กาญจนอังกูร (บิ๊ก)",
    vehiclePlate: row.plate,
    vehicleModel: row.model,
    commissionGroup: row.group,
    discountAmount: row.discount,
    discountTier: result.discountTier,
    countWeight: result.countWeight,
    grossVehicleCommission: result.grossVehicleCommission,
    withholdingTaxAmount: result.withholdingTaxAmount,
    netVehicleCommission: result.netVehicleCommission,
    manualAdjustment: result.manualAdjustment,
    manualAdjustmentReason: row.reason,
    recognizedAt: row.recognizedAt,
    recognizedMonth: COMMISSION_PREVIEW_MONTH,
    recognitionMethod: row.method,
    ruleVersionId: COMMISSION_PREVIEW_RULES.id,
    calculatedAt: "2026-08-12T16:00:00+07:00",
    sourceFingerprint: `preview:${row.id}`,
    status: "recognized"
  };
});

export const COMMISSION_CLOSING_FIXTURES = [
  { bookingCaseId: "pending-1", plate: "กข 2001", model: "TOYOTA YARIS 2020", status: "รอส่งมอบ", estimated: 4_850 },
  { bookingCaseId: "pending-2", plate: "กข 2002", model: "HONDA CIVIC 2019", status: "ลูกค้าชะลอ", estimated: 5_820 }
] as const;
