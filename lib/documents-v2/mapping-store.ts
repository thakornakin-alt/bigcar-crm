import { readJsonStore, writeJsonStore } from "@/lib/json-store";

export const DOCUMENT_V2_MAPPING_STORE = "documents-v2-field-mapping.json";

export type DocumentV2FieldKey =
  | "contractDate"
  | "customerName"
  | "customerAddress"
  | "idCard"
  | "plateNo"
  | "brand"
  | "model"
  | "year"
  | "color"
  | "engineNo"
  | "chassisNo"
  | "sellPrice"
  | "deposit"
  | "remainingAmount"
  | "saleName";

export type DocumentV2FieldMapping = Record<string, DocumentV2FieldKey | "">;

const DEFAULT_MAPPING: DocumentV2FieldMapping = {
  Text1: "customerName",
  Text3: "contractDate",
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

export function getDefaultDocumentV2Mapping(): DocumentV2FieldMapping {
  return { ...DEFAULT_MAPPING };
}

export async function readDocumentV2Mapping(): Promise<DocumentV2FieldMapping> {
  const stored = await readJsonStore<DocumentV2FieldMapping>(DOCUMENT_V2_MAPPING_STORE, getDefaultDocumentV2Mapping());
  return { ...getDefaultDocumentV2Mapping(), ...(stored || {}) };
}

export async function writeDocumentV2Mapping(mapping: DocumentV2FieldMapping): Promise<DocumentV2FieldMapping> {
  const normalized: DocumentV2FieldMapping = {};
  for (const [key, value] of Object.entries(mapping || {})) {
    normalized[String(key)] = (value || "") as DocumentV2FieldKey | "";
  }
  const merged = { ...getDefaultDocumentV2Mapping(), ...normalized };
  await writeJsonStore(DOCUMENT_V2_MAPPING_STORE, merged);
  return merged;
}

