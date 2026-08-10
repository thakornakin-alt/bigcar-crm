import type { RddCanonicalPurchaseType, RddCaseStatus } from "@/lib/rdd-phase3b";

export const RDD_DELIVERY_LOCATIONS = [
  "โกดังบางนา",
  "โกดังเทพารักษ์",
  "สาขากาญจนาภิเษก",
  "นอกสถานที่"
] as const;

export type RddWorkspaceEditableField =
  | "purchaseType"
  | "caseStatus"
  | "deliveryDate"
  | "deliveryTime"
  | "deliveryLocation"
  | "deliveryLocationNote"
  | "financeCaseNote";

export type RddWorkspaceChanges = {
  purchaseType?: RddCanonicalPurchaseType;
  caseStatus?: RddCaseStatus;
  deliveryDate?: string;
  deliveryTime?: string;
  deliveryLocation?: string;
  deliveryLocationNote?: string;
  financeCaseNote?: string;
};
