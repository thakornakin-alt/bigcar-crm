import type { ReportHistoryItem } from "@/lib/types";

export const DOC_V2_TEMPLATE_ID = "contract-field" as const;

export type DocumentV2FieldDebug = {
  name: string;
  type: string;
};

export type DocumentV2Data = {
  contractDate: string;
  customerName: string;
  customerAddress: string;
  idCard: string;
  plateNo: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  engineNo: string;
  chassisNo: string;
  sellPrice: string;
  deposit: string;
  remainingAmount: string;
  saleName: string;
};

export function mapBookingToDocumentV2(report?: ReportHistoryItem | null): DocumentV2Data {
  const rawFinal =
    (report as any)?.finalPrice ??
    (report as any)?.netPayment ??
    (report as any)?.salePrice ??
    "";
  const rawDeposit =
    (report as any)?.bookingPrice ??
    (report as any)?.downPayment ??
    "";
  const finalPrice = Number(String(rawFinal || "").replace(/,/g, ""));
  const depositPrice = Number(String(rawDeposit || "").replace(/,/g, ""));
  const remaining = Number.isFinite(finalPrice) && Number.isFinite(depositPrice) ? Math.max(finalPrice - depositPrice, 0) : 0;
  return {
    contractDate: String(report?.createdAt || "").slice(0, 10),
    customerName: String(report?.customerName || ""),
    customerAddress: String((report as any)?.address || ""),
    idCard: String(report?.idCard || ""),
    plateNo: String(report?.plate || ""),
    brand: String(report?.brand || ""),
    model: String(report?.model || ""),
    year: String(report?.year || ""),
    color: String(report?.color || ""),
    engineNo: String((report as any)?.engineNo || ""),
    chassisNo: String((report as any)?.chassisNo || (report as any)?.vin || ""),
    sellPrice: String((report as any)?.salePrice || rawFinal || ""),
    deposit: String(rawDeposit || ""),
    remainingAmount: remaining > 0 ? remaining.toLocaleString("th-TH") : "",
    saleName: String(report?.saleName || "")
  };
}
