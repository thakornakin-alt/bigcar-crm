import { readJsonStore, writeJsonStore } from "@/lib/json-store";

export const DOCUMENT_V2_MAPPING_STORE = "documents-v2-field-mapping.json";

export type DocumentV2FieldKey =
  | "contractDate"
  | "contractDateDay"
  | "contractDateMonth"
  | "contractDateYear"
  | "paymentDate"
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
  | "remainingAmountThaiText"
  | "financeCompany"
  | "saleName"
  | "approverName";

export type DocumentV2MappedValue = DocumentV2FieldKey | `raw:${string}` | "";
export type DocumentV2FieldMapping = Record<string, DocumentV2MappedValue>;
type MappingByTemplate = Record<string, DocumentV2FieldMapping>;

const DEFAULT_MAPPING: DocumentV2FieldMapping = {
  Text1: "paymentDate",
  Text3: "remainingAmount",
  Text4: "sellPrice",
  Text6: "chassisNo",
  Text7: "contractDate",
  Text8: "contractDate",
  Text9: "customerName",
  Text10: "customerAddress",
  Text11: "idCard",
  Text13: "brand",
  Text14: "model",
  Text15: "plateNo",
  Text16: "engineNo",
  Text17: "deposit"
};

const TEMPORARY_RECEIPT_DEFAULT_MAPPING: DocumentV2FieldMapping = {
  Date_Now: "currentDate",
  DATE_NOW: "currentDate",
  DATE_DAY: "currentDateDay",
  DATE_month: "currentDateMonth",
  DATE_Year: "currentDateYear",
  Name_CUSTOMER: "customerName",
  CUSTOMER_NAE: "customerName",
  fill_10: "customerAddress",
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
  Underline3: "raw:row3Note",
  TOTAL_THAI: "remainingAmountThaiText",
  SELL_Price: "sellPrice",
  TOTAL_PAY: "remainingAmount",
  Deposit: "deposit",
  fill_7: "raw:bookingDate",
  fill_9: "raw:depositDate",
  Underline1: "raw:row1Note",
  undefined_19: "raw:line14Label",
  fill_46: "raw:line14Amount",
  Sale_Name: "saleName",
  MANAGER_NAME: "approverName"
};

const POWER_OF_ATTORNEY_DEFAULT_MAPPING: DocumentV2FieldMapping = {
  DOCUMENT_DAY: "raw:document_day",
  DOCUMENT_MONTH: "raw:document_month",
  DOCUMENT_YEAR: "raw:document_year",
  Customer_name: "customerName",
  customer_age: "raw:customer_age",
  customer_race: "raw:customer_race",
  customer_nationality: "raw:customer_nationality",
  customer_house_no: "raw:customer_house_no",
  customer_moo: "raw:customer_moo",
  customer_soi: "raw:customer_soi",
  customer_road: "raw:customer_road",
  cusyomer_subdistrict: "raw:cusyomer_subdistrict",
  customer_district: "raw:customer_district",
  customer_province: "raw:customer_province",
  vehicle_plate: "raw:vehicle_plate"
};

const TRANSPORT_TRANSFER_REQUEST_DEFAULT_MAPPING: DocumentV2FieldMapping = {
  transfer_date_day: "raw:transfer_date_day",
  transfer_date_month: "raw:transfer_date_month",
  transfer_date_year: "raw:transfer_date_year",
  vehicle_plate_no: "raw:vehicle_plate_no",
  transferee_name: "raw:transferee_name",
  transferee_age: "raw:transferee_age",
  transferee_nationality: "raw:transferee_nationality",
  transferee_address_no: "raw:transferee_address_no",
  transferee_moo: "raw:transferee_moo",
  transferee_soi: "raw:transferee_soi",
  transferee_road: "raw:transferee_road",
  transferee_subdistrict: "raw:transferee_subdistrict",
  transferee_district: "raw:transferee_district",
  transferee_province: "raw:transferee_province",
  transferee_phone: "raw:transferee_phone",
  vehicle_chassis_no: "raw:vehicle_chassis_no",
  vehicle_engine_no: "raw:vehicle_engine_no"
};

const VEHICLE_DELIVERY_DOCUMENT_DEFAULT_MAPPING: DocumentV2FieldMapping = {
  delivery_date: "raw:delivery_date",
  customer_name: "raw:customer_name",
  customer_id_no: "raw:customer_id_no",
  customer_address_1: "raw:customer_address_1",
  customer_address_2: "raw:customer_address_2",
  customer_postal_code: "raw:customer_postal_code",
  customer_phone: "raw:customer_phone",
  vehicle_brand: "raw:vehicle_brand",
  vehicle_model: "raw:vehicle_model",
  vehicle_year: "raw:vehicle_year",
  vehicle_color: "raw:vehicle_color",
  vehicle_plate: "raw:vehicle_plate",
  vehicle_chassis_no: "raw:vehicle_chassis_no",
  customer_id_card_image_af_image: "raw:customer_id_card_image"
};

export function getDefaultDocumentV2Mapping(templateId?: string): DocumentV2FieldMapping {
  if (templateId === "temporary-receipt") {
    return { ...TEMPORARY_RECEIPT_DEFAULT_MAPPING };
  }
  if (templateId === "power-of-attorney") {
    return { ...POWER_OF_ATTORNEY_DEFAULT_MAPPING };
  }
  if (templateId === "transport-transfer-request") {
    return { ...TRANSPORT_TRANSFER_REQUEST_DEFAULT_MAPPING };
  }
  if (templateId === "vehicle-delivery-document") {
    return { ...VEHICLE_DELIVERY_DOCUMENT_DEFAULT_MAPPING };
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
