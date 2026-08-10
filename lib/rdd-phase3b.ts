import type { BookingDeliveryRecord } from "@/lib/types";

export const RDD_PURCHASE_TYPES = ["cash", "finance"] as const;
export type RddCanonicalPurchaseType = typeof RDD_PURCHASE_TYPES[number];

export const RDD_CASH_STATUSES = [
  "waiting_delivery",
  "settled_waiting_delivery",
  "customer_paused",
  "delivered",
  "cancelled"
] as const;

export const RDD_FINANCE_STATUSES = [
  "waiting_finance_submission",
  "waiting_finance_result",
  "approved_waiting_delivery",
  "settled_waiting_delivery",
  "customer_paused",
  "delivered",
  "cancelled"
] as const;

export type RddCashStatus = typeof RDD_CASH_STATUSES[number];
export type RddFinanceStatus = typeof RDD_FINANCE_STATUSES[number];
export type RddCaseStatus = RddCashStatus | RddFinanceStatus;

export const RDD_PURCHASE_TYPE_LABELS: Record<RddCanonicalPurchaseType, string> = {
  cash: "ซื้อสด",
  finance: "ไฟแนนซ์"
};

export const RDD_CASE_STATUS_LABELS: Record<RddCaseStatus, string> = {
  waiting_delivery: "รอส่งมอบ",
  waiting_finance_submission: "รอจัดไฟแนนซ์",
  waiting_finance_result: "รอผลไฟแนนซ์",
  approved_waiting_delivery: "อนุมัติ / รอส่งมอบ",
  settled_waiting_delivery: "ตัดยอดแล้ว / รอส่งมอบ",
  customer_paused: "ลูกค้าชะลอการดำเนินการ",
  delivered: "ส่งมอบแล้ว",
  cancelled: "ยกเลิก"
};

export function isRddPurchaseType(value: unknown): value is RddCanonicalPurchaseType {
  return RDD_PURCHASE_TYPES.includes(value as RddCanonicalPurchaseType);
}

export function isRddCaseStatus(value: unknown): value is RddCaseStatus {
  return Object.prototype.hasOwnProperty.call(RDD_CASE_STATUS_LABELS, String(value || ""));
}

export function statusesForPurchaseType(purchaseType: RddCanonicalPurchaseType | "" | undefined): readonly RddCaseStatus[] {
  if (purchaseType === "cash") return RDD_CASH_STATUSES;
  if (purchaseType === "finance") return RDD_FINANCE_STATUSES;
  return [];
}

export function isStatusValidForPurchaseType(purchaseType: unknown, status: unknown) {
  return isRddPurchaseType(purchaseType) && isRddCaseStatus(status) && statusesForPurchaseType(purchaseType).includes(status);
}

export function canonicalPurchaseType(record: Pick<BookingDeliveryRecord, "purchaseType">) {
  return isRddPurchaseType(record.purchaseType) ? record.purchaseType : undefined;
}

export function canonicalCaseStatus(record: Pick<BookingDeliveryRecord, "caseStatus">) {
  return isRddCaseStatus(record.caseStatus) ? record.caseStatus : undefined;
}

export function reminderEligibleForRecord(record: Pick<BookingDeliveryRecord, "purchaseType" | "caseStatus" | "status" | "workflowStatus">) {
  const purchaseType = canonicalPurchaseType(record);
  const status = canonicalCaseStatus(record);
  if (purchaseType && status) {
    if (!isStatusValidForPurchaseType(purchaseType, status)) return false;
    if (purchaseType === "cash") return status === "waiting_delivery" || status === "settled_waiting_delivery";
    return status === "approved_waiting_delivery" || status === "settled_waiting_delivery";
  }
  const legacy = String(record.status === "ยกเลิก" ? record.status : record.workflowStatus || record.status || "").trim();
  return legacy !== "ยอดส่งมอบ" && legacy !== "ยกเลิก";
}
