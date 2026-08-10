import type { RddCanonicalPurchaseType, RddCaseStatus } from "@/lib/rdd-phase3b";
import type { BookingDeliveryRecord } from "@/lib/types";

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
  | "financeCaseNote"
  | "garageRequired" | "garageName" | "garageSentAt" | "garageExpectedReturnDate" | "garageReturned"
  | "washStatus" | "stickerStatus" | "oilStatus" | "batteryStatus" | "taxStatus" | "insuranceStatus";

export type RddWorkspaceChanges = {
  purchaseType?: RddCanonicalPurchaseType;
  caseStatus?: RddCaseStatus;
  deliveryDate?: string;
  deliveryTime?: string;
  deliveryLocation?: string;
  deliveryLocationNote?: string;
  financeCaseNote?: string;
  garageRequired?: boolean;
  garageName?: string;
  garageSentAt?: string;
  garageExpectedReturnDate?: string;
  garageReturned?: boolean;
  washStatus?: BookingDeliveryRecord["washStatus"];
  stickerStatus?: BookingDeliveryRecord["stickerStatus"];
  oilStatus?: BookingDeliveryRecord["oilStatus"];
  batteryStatus?: BookingDeliveryRecord["batteryStatus"];
  taxStatus?: BookingDeliveryRecord["taxStatus"];
  insuranceStatus?: BookingDeliveryRecord["insuranceStatus"];
};
