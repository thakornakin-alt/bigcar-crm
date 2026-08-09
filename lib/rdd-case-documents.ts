import type { BookingDeliveryRecord } from "@/lib/types";

export type CaseDocumentKind =
  | "booking_report"
  | "sales_report"
  | "purchase_contract"
  | "delivery_document"
  | "transfer_document"
  | "case_attachment";

export type CaseDocumentManifestItem = {
  kind: CaseDocumentKind;
  label: string;
  available: boolean;
  sourceType: "booking_report" | "sales_report" | "booking_delivery" | "unresolved";
  sourceId?: string;
  fileCount?: number;
};

export type CaseDocumentManifest = {
  caseId: string;
  bookingId: string;
  items: CaseDocumentManifestItem[];
  availableCount: number;
  totalCount: number;
};

export function resolveCaseDocumentManifest(record: BookingDeliveryRecord): CaseDocumentManifest {
  const attachmentCount = Array.isArray(record.financeAttachmentIds)
    ? record.financeAttachmentIds.filter((id) => String(id || "").trim()).length
    : 0;
  const items: CaseDocumentManifestItem[] = [
    {
      kind: "booking_report",
      label: "รายงานจอง",
      available: Boolean(record.bookingReportId),
      sourceType: record.bookingReportId ? "booking_report" : "unresolved",
      ...(record.bookingReportId ? { sourceId: record.bookingReportId } : {})
    },
    {
      kind: "sales_report",
      label: "รายงานขาย",
      available: Boolean(record.salesReportId),
      sourceType: record.salesReportId ? "sales_report" : "unresolved",
      ...(record.salesReportId ? { sourceId: record.salesReportId } : {})
    },
    { kind: "purchase_contract", label: "สัญญาซื้อขาย", available: false, sourceType: "unresolved" },
    { kind: "delivery_document", label: "เอกสารส่งมอบ", available: false, sourceType: "unresolved" },
    { kind: "transfer_document", label: "เอกสารโอน", available: false, sourceType: "unresolved" },
    {
      kind: "case_attachment",
      label: "เอกสารแนบเคส",
      available: attachmentCount > 0,
      sourceType: attachmentCount > 0 ? "booking_delivery" : "unresolved",
      ...(attachmentCount > 0 ? { fileCount: attachmentCount } : {})
    }
  ];

  return {
    caseId: record.id,
    bookingId: record.bookingId,
    items,
    availableCount: items.filter((item) => item.available).length,
    totalCount: items.length
  };
}
