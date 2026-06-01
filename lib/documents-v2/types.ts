import type { ReportHistoryItem } from "@/lib/types";

export const DOC_V2_TEMPLATE_ID = "contract-field" as const;

export type DocumentV2FieldDebug = {
  name: string;
  type: string;
};

export type DocumentV2Data = {
  customerName: string;
  plateNo: string;
  chassisNo: string;
  sellPrice: string;
  deposit: string;
};

export function mapBookingToDocumentV2(report?: ReportHistoryItem | null): DocumentV2Data {
  return {
    customerName: String(report?.customerName || ""),
    plateNo: String(report?.plate || ""),
    chassisNo: "",
    sellPrice: "",
    deposit: ""
  };
}
