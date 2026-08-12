import { createHash } from "crypto";
import {
  calculateMonthlyStatement,
  calculateVehicleCommission,
  createCommissionRuleSet,
  type CommissionCorrection,
  type CommissionGroup,
  type CommissionMonthlyDisposition,
  type CommissionRuleSet,
  type CommissionSnapshot,
  type MonthlyCommissionStatement
} from "./commission.ts";

export type CommissionWorkingState =
  | "working"
  | "eligible_for_recognition"
  | "recognized"
  | "carry_forward"
  | "no_carry"
  | "needs_review"
  | "recognition_blocked";

export type CommissionWorkingCase = {
  bookingCaseId: string;
  bookingReportId?: string;
  salesReportId?: string;
  salespersonUserId?: string;
  salespersonDisplayName: string;
  vehiclePlate: string;
  vehicleModel?: string;
  commissionGroup?: CommissionGroup;
  standardPrice?: number;
  salePrice?: number;
  discountAmount: number;
  isCounted: boolean;
  qaTestRecord?: boolean;
  excludeFromMetrics?: boolean;
  caseStatus: string;
  deliveredAt?: string;
  sourceMonth: string;
};

export type CommissionActivity = {
  id: string;
  action: "commission_recognized" | "commission_carried_forward" | "commission_not_carried" | "commission_adjusted" | "commission_statement_closed" | "commission_reversed";
  targetId: string;
  actorUserId: string;
  occurredAt: string;
  changedFields: string[];
};

export type IsolatedCommissionStore = {
  rules: CommissionRuleSet[];
  cases: CommissionWorkingCase[];
  snapshots: CommissionSnapshot[];
  statements: MonthlyCommissionStatement[];
  dispositions: CommissionMonthlyDisposition[];
  corrections: CommissionCorrection[];
  activity: CommissionActivity[];
  dismissedClosingMonths: string[];
};

export type RecognitionAssessment = {
  state: CommissionWorkingState;
  reasons: string[];
};

export function assessRecognition(record: CommissionWorkingCase, manualCutoff = false): RecognitionAssessment {
  const reasons: string[] = [];
  if (record.qaTestRecord || record.excludeFromMetrics) reasons.push("qa_excluded");
  if (!record.isCounted) reasons.push("not_counted");
  if (record.caseStatus === "cancelled") reasons.push("cancelled");
  if (!record.salespersonUserId) reasons.push("missing_salesperson_user_id");
  if (!record.commissionGroup) reasons.push("missing_commission_group");
  if (reasons.some((item) => ["qa_excluded", "not_counted", "cancelled"].includes(item))) return { state: "recognition_blocked", reasons };
  if (reasons.length) return { state: "needs_review", reasons };
  if (record.deliveredAt || record.caseStatus === "delivered" || manualCutoff) return { state: "eligible_for_recognition", reasons };
  return { state: "working", reasons: ["not_delivered_or_cutoff"] };
}

function fingerprint(record: CommissionWorkingCase, ruleId: string, method: "delivered" | "manual_cutoff", month: string) {
  return createHash("sha256").update(JSON.stringify({
    bookingCaseId: record.bookingCaseId,
    salespersonUserId: record.salespersonUserId,
    commissionGroup: record.commissionGroup,
    standardPrice: record.standardPrice,
    salePrice: record.salePrice,
    discountAmount: record.discountAmount,
    method,
    month,
    ruleId
  })).digest("hex");
}

function seedStore(): IsolatedCommissionStore {
  const august = createCommissionRuleSet("2026-08");
  const september = createCommissionRuleSet("2026-09", { g3BaseRate: 15_000 });
  return {
    rules: [august, september],
    cases: [
      { bookingCaseId: "ISO-DELIVERED-G1", salespersonUserId: "USER-PREVIEW-BIG", salespersonDisplayName: "ฐากร กาญจนอังกูร (บิ๊ก)", vehiclePlate: "PREVIEW 1001", vehicleModel: "TOYOTA REVO 2021", commissionGroup: "G1", standardPrice: 500000, salePrice: 500000, discountAmount: 0, isCounted: true, caseStatus: "delivered", deliveredAt: "2026-08-08T10:00:00+07:00", sourceMonth: "2026-08" },
      { bookingCaseId: "ISO-WAITING-G2", salespersonUserId: "USER-PREVIEW-BIG", salespersonDisplayName: "ฐากร กาญจนอังกูร (บิ๊ก)", vehiclePlate: "PREVIEW 1002", vehicleModel: "HONDA CITY 2020", commissionGroup: "G2", standardPrice: 480000, salePrice: 472000, discountAmount: 8000, isCounted: true, caseStatus: "waiting_delivery", sourceMonth: "2026-07" },
      { bookingCaseId: "ISO-PAUSED-G3", salespersonUserId: "USER-PREVIEW-BIG", salespersonDisplayName: "ฐากร กาญจนอังกูร (บิ๊ก)", vehiclePlate: "PREVIEW 1003", vehicleModel: "ISUZU D-MAX 2022", commissionGroup: "G3", standardPrice: 600000, salePrice: 585000, discountAmount: 15000, isCounted: true, caseStatus: "customer_paused", sourceMonth: "2026-07" },
      { bookingCaseId: "ISO-CANCELLED", salespersonUserId: "USER-PREVIEW-BIG", salespersonDisplayName: "ฐากร กาญจนอังกูร (บิ๊ก)", vehiclePlate: "PREVIEW 1004", vehicleModel: "FORD RANGER 2019", commissionGroup: "G1", standardPrice: 450000, salePrice: 450000, discountAmount: 0, isCounted: true, caseStatus: "cancelled", sourceMonth: "2026-07" },
      { bookingCaseId: "ISO-NEEDS-REVIEW", salespersonDisplayName: "ยังไม่ผูกผู้ใช้", vehiclePlate: "PREVIEW 1005", discountAmount: 0, isCounted: true, caseStatus: "waiting_delivery", sourceMonth: "2026-07" }
    ],
    snapshots: [], statements: [], dispositions: [], corrections: [], activity: [], dismissedClosingMonths: []
  };
}

const globalStore = globalThis as typeof globalThis & { __commissionIsolatedStore?: IsolatedCommissionStore };

export function isolatedCommissionStore() {
  globalStore.__commissionIsolatedStore ??= seedStore();
  return globalStore.__commissionIsolatedStore;
}

function event(store: IsolatedCommissionStore, action: CommissionActivity["action"], targetId: string, actorUserId: string, changedFields: string[], now: string) {
  const item: CommissionActivity = { id: `ISO-ACT-${store.activity.length + 1}`, action, targetId, actorUserId, occurredAt: now, changedFields };
  store.activity.push(item);
  return item;
}

export function recognizeIsolatedCase(input: { bookingCaseId: string; method: "delivered" | "manual_cutoff"; recognizedMonth: string; actorUserId: string; now: string }) {
  const store = isolatedCommissionStore();
  const existing = store.snapshots.find((item) => item.bookingCaseId === input.bookingCaseId && item.status !== "reversed");
  if (existing) return { snapshot: existing, created: false };
  const record = store.cases.find((item) => item.bookingCaseId === input.bookingCaseId);
  if (!record) throw new Error("ไม่พบรายการค่าคอม");
  const assessment = assessRecognition(record, input.method === "manual_cutoff");
  if (assessment.state !== "eligible_for_recognition") throw new Error(`ไม่สามารถรับรู้ค่าคอม: ${assessment.reasons.join(",")}`);
  if (input.method === "delivered" && !record.deliveredAt && record.caseStatus !== "delivered") throw new Error("ยังไม่ได้ส่งมอบ");
  const rules = store.rules.find((item) => item.month === input.recognizedMonth);
  if (!rules || !record.salespersonUserId || !record.commissionGroup) throw new Error("ข้อมูลสำหรับรับรู้ค่าคอมไม่ครบ");
  const calc = calculateVehicleCommission({ group: record.commissionGroup, discountAmount: record.discountAmount }, rules);
  const recognizedAt = input.method === "delivered" ? String(record.deliveredAt || input.now) : input.now;
  const snapshot: CommissionSnapshot = Object.freeze({
    id: `ISO-SNAP-${store.snapshots.length + 1}`,
    bookingCaseId: record.bookingCaseId, bookingReportId: record.bookingReportId, salesReportId: record.salesReportId,
    salespersonUserId: record.salespersonUserId, salespersonDisplayName: record.salespersonDisplayName,
    vehiclePlate: record.vehiclePlate, vehicleModel: record.vehicleModel, commissionGroup: record.commissionGroup,
    standardPrice: record.standardPrice, salePrice: record.salePrice, discountAmount: record.discountAmount,
    discountTier: calc.discountTier, countWeight: calc.countWeight, grossVehicleCommission: calc.grossVehicleCommission,
    withholdingTaxAmount: calc.withholdingTaxAmount, netVehicleCommission: calc.netVehicleCommission,
    manualAdjustment: 0, recognizedAt, recognizedMonth: input.recognizedMonth, recognitionMethod: input.method,
    ruleVersionId: rules.id, calculatedAt: input.now, sourceFingerprint: fingerprint(record, rules.id, input.method, input.recognizedMonth), status: "recognized"
  });
  store.snapshots.push(snapshot);
  event(store, "commission_recognized", snapshot.id, input.actorUserId, ["status", "recognizedMonth", "recognitionMethod"], input.now);
  return { snapshot, created: true };
}

export function disposeIsolatedCase(input: { bookingCaseId: string; sourceMonth: string; action: "carry_forward" | "do_not_carry"; reason?: "cancelled" | "customer_paused" | "other"; actorUserId: string; now: string }) {
  const store = isolatedCommissionStore();
  const existing = store.dispositions.find((item) => item.bookingCaseId === input.bookingCaseId && item.sourceMonth === input.sourceMonth);
  if (existing) return existing;
  if (input.action === "do_not_carry" && input.reason && !["cancelled", "customer_paused", "other"].includes(input.reason)) throw new Error("เหตุผลไม่ถูกต้อง");
  const targetMonth = input.action === "carry_forward" ? nextMonth(input.sourceMonth) : undefined;
  const disposition: CommissionMonthlyDisposition = { id: `ISO-DISP-${store.dispositions.length + 1}`, bookingCaseId: input.bookingCaseId, sourceMonth: input.sourceMonth, action: input.action, reason: input.reason, targetMonth, actorUserId: input.actorUserId, actedAt: input.now };
  store.dispositions.push(disposition);
  event(store, input.action === "carry_forward" ? "commission_carried_forward" : "commission_not_carried", input.bookingCaseId, input.actorUserId, ["action", ...(targetMonth ? ["targetMonth"] : []), ...(input.reason ? ["reason"] : [])], input.now);
  return disposition;
}

function nextMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function addIsolatedAdjustment(input: { snapshotId: string; amount: number; reason: string; actorUserId: string; now: string }) {
  if (!Number.isInteger(input.amount) || input.amount === 0) throw new Error("Adjustment ต้องเป็นจำนวนเต็มที่ไม่เท่ากับศูนย์");
  if (!input.reason.trim()) throw new Error("Adjustment ต้องมีเหตุผล");
  const store = isolatedCommissionStore();
  if (!store.snapshots.some((item) => item.id === input.snapshotId)) throw new Error("ไม่พบ snapshot");
  const correction: CommissionCorrection = { id: `ISO-CORR-${store.corrections.length + 1}`, originalSnapshotId: input.snapshotId, type: "adjustment", amount: input.amount, reason: input.reason.trim(), actorUserId: input.actorUserId, createdAt: input.now };
  store.corrections.push(correction);
  event(store, "commission_adjusted", correction.id, input.actorUserId, ["amount", "reason"], input.now);
  return correction;
}

export function reverseIsolatedSnapshot(input: { snapshotId: string; reason: string; actorUserId: string; now: string }) {
  if (!input.reason.trim()) throw new Error("การกลับรายการต้องมีเหตุผล");
  const store = isolatedCommissionStore();
  const original = store.snapshots.find((item) => item.id === input.snapshotId);
  if (!original) throw new Error("ไม่พบ snapshot");
  const correction: CommissionCorrection = { id: `ISO-CORR-${store.corrections.length + 1}`, originalSnapshotId: original.id, type: "reversal", amount: -original.netVehicleCommission, reason: input.reason.trim(), actorUserId: input.actorUserId, createdAt: input.now };
  store.corrections.push(correction);
  event(store, "commission_reversed", correction.id, input.actorUserId, ["type", "reason"], input.now);
  return correction;
}

export function commissionIsolatedView(month = "2026-08") {
  const store = isolatedCommissionStore();
  const rules = store.rules.find((item) => item.month === month) || store.rules[0];
  const assessments = store.cases.map((record) => ({ ...record, assessment: assessRecognition(record), disposition: store.dispositions.find((item) => item.bookingCaseId === record.bookingCaseId && item.sourceMonth === record.sourceMonth) }));
  const statements = Array.from(new Set(store.snapshots.map((item) => item.salespersonUserId))).map((userId) => calculateMonthlyStatement(store.snapshots, rules, userId));
  return { mode: "isolated_fixture" as const, realWritesEnabled: false, rules: store.rules, cases: assessments, snapshots: store.snapshots, statements, dispositions: store.dispositions, corrections: store.corrections, activity: store.activity, pendingClosingCount: assessments.filter((item) => item.sourceMonth < month && !item.disposition && item.assessment.state !== "recognized").length };
}

export function closeIsolatedStatement(input: { salespersonUserId: string; month: string; actorUserId: string; now: string }) {
  const store = isolatedCommissionStore();
  const existing = store.statements.find((item) => item.salespersonUserId === input.salespersonUserId && item.month === input.month && item.status === "closed");
  if (existing) return existing;
  const rules = store.rules.find((item) => item.month === input.month);
  if (!rules) throw new Error("ไม่พบ CommissionRuleSet");
  const statement = calculateMonthlyStatement(store.snapshots, rules, input.salespersonUserId);
  const closed: MonthlyCommissionStatement = Object.freeze({ ...statement, status: "closed", closedAt: input.now, closedByUserId: input.actorUserId });
  store.statements.push(closed);
  event(store, "commission_statement_closed", `${input.salespersonUserId}:${input.month}`, input.actorUserId, ["status", "closedAt"], input.now);
  return closed;
}

export function resetIsolatedCommissionStoreForTests() {
  globalStore.__commissionIsolatedStore = seedStore();
}
