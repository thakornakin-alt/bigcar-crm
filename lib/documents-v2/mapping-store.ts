import { readJsonStore, writeJsonStore } from "@/lib/json-store";

export const DOCUMENT_V2_MAPPING_STORE = "documents-v2-field-mapping.json";

export type DocumentV2FieldKey =
  | "contractDate"
  | "contractDateDay"
  | "contractDateMonth"
  | "contractDateYear"
  | "currentDate"
  | "currentDateDay"
  | "currentDateMonth"
  | "currentDateYear"
  | "customerName"
  | "customerAddress"
  | "idCard"
  | "phone"
  | "plateNo"
  | "brand"
  | "model"
  | "year"
  | "color"
  | "engineNo"
  | "chassisNo"
  | "bookingNo"
  | "sellPrice"
  | "deposit"
  | "remainingAmount"
  | "financeCompany"
  | "saleName"
  | "approverName";

export type DocumentV2MappedValue = DocumentV2FieldKey | `raw:${string}` | "";
export type DocumentV2FieldMapping = Record<string, DocumentV2MappedValue>;
type MappingByTemplate = Record<string, DocumentV2FieldMapping>;

const DEFAULT_MAPPING: DocumentV2FieldMapping = {
  Text1: "customerName",
  Text3: "contractDate",
  Text3Day: "contractDateDay",
  Text3Month: "contractDateMonth",
  Text3Year: "contractDateYear",
  Text4: "customerAddress",
  Text6: "idCard",
  Text7: "plateNo",
  Text8: "brand",
  Text9: "model",
  Text10: "year",
  Text11: "color",
  Text12: "engineNo",
  Text13: "chassisNo",
  Text14: "sellPrice",
  Text15: "deposit",
  Text16: "remainingAmount",
  Text17: "saleName"
};

const TEMPORARY_RECEIPT_DEFAULT_MAPPING: DocumentV2FieldMapping = {
  Date_Now: "currentDate",
  DATE_NOW: "currentDate",
  DATE_DAY: "currentDateDay",
  DATE_month: "currentDateMonth",
  DATE_Year: "currentDateYear",
  Name_CUSTOMER: "customerName",
  CUSTOMER_NAE: "customerName",
  ID_CARD: "idCard",
  Tel_Number: "phone",
  Lincese_no: "plateNo",
  Model_Name: "model",
  Model_Year: "year",
  Brand: "brand",
  Color: "color",
  VIN_NO: "chassisNo",
  Engine_no: "engineNo",
  booking_no: "bookingNo",
  Sale: "saleName",
  FINANCE: "financeCompany",
  TOTAL_THAI: "sellPrice",
  SELL_Price: "sellPrice",
  TOTAL_PAY: "remainingAmount",
  Deposit: "deposit",
  Sale_Name: "saleName",
  MANAGER_NAME: "approverName"
};

export function getDefaultDocumentV2Mapping(templateId?: string): DocumentV2FieldMapping {
  if (templateId === "temporary-receipt") {
    return { ...TEMPORARY_RECEIPT_DEFAULT_MAPPING };
  }
  return { ...DEFAULT_MAPPING };
}

export async function readDocumentV2Mapping(templateId: string): Promise<DocumentV2FieldMapping> {
  const stored = await readJsonStore<MappingByTemplate>(DOCUMENT_V2_MAPPING_STORE, {});
  return { ...getDefaultDocumentV2Mapping(templateId), ...((stored || {})[templateId] || {}) };
}

export async function writeDocumentV2Mapping(templateId: string, mapping: DocumentV2FieldMapping): Promise<DocumentV2FieldMapping> {
  const stored = await readJsonStore<MappingByTemplate>(DOCUMENT_V2_MAPPING_STORE, {});
  const normalized: DocumentV2FieldMapping = {};
  for (const [key, value] of Object.entries(mapping || {})) {
    normalized[String(key)] = (value || "") as DocumentV2MappedValue;
  }
  const merged = { ...getDefaultDocumentV2Mapping(templateId), ...normalized };
  const next: MappingByTemplate = { ...(stored || {}), [templateId]: merged };
  await writeJsonStore(DOCUMENT_V2_MAPPING_STORE, next);
  return merged;
}
