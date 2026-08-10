export const RDD_DELIVERY_LOCATIONS = [
  "โกดังบางนา",
  "โกดังเทพารักษ์",
  "สาขากาญจนาภิเษก",
  "นอกสถานที่"
] as const;

export type RddWorkspaceEditableField = "deliveryLocation" | "financeCaseNote";
export type RddWorkspaceChanges = Partial<Record<RddWorkspaceEditableField, string>>;
