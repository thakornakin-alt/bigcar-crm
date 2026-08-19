import { readJsonStore, writeJsonStore } from "../json-store.ts";
import { identifierText, normalizeDocumentValueRecord, salesContractOverrideData } from "../documents/value-integrity.ts";

const STORE_FILE = "document-overrides-v2.json";

export type DocumentV2Override = {
  templateId: string;
  reportId: string;
  data: Record<string, string>;
  templateData: Record<string, unknown>;
  updatedAt: string;
  updatedByUserId: string;
};

type OverrideStore = Record<string, DocumentV2Override>;

export function documentOverrideKey(templateId: string, reportId: string) {
  return `${identifierText(templateId)}::${identifierText(reportId)}`;
}

function cleanRecord(templateId: string, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("ข้อมูลแก้ไขเอกสารไม่ถูกต้อง");
  }
  return normalizeDocumentValueRecord(
    templateId === "contract-field" ? salesContractOverrideData(input) : input
  );
}

function cleanTemplateData(input: unknown) {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const cleanNested = (value: unknown) => normalizeDocumentValueRecord(value);
  return {
    temporaryReceiptExtras: cleanNested(source.temporaryReceiptExtras),
    powerOfAttorneyExtras: cleanNested(source.powerOfAttorneyExtras),
    transportTransferExtras: cleanNested(source.transportTransferExtras),
    vehicleDeliveryExtras: cleanNested(source.vehicleDeliveryExtras)
  };
}

export async function readDocumentV2Override(templateId: string, reportId: string) {
  const store = await readJsonStore<OverrideStore>(STORE_FILE, {});
  return store[documentOverrideKey(templateId, reportId)] || null;
}

export async function writeDocumentV2Override(input: {
  templateId: string;
  reportId: string;
  data: unknown;
  templateData: unknown;
  actorUserId: string;
}) {
  const templateId = identifierText(input.templateId);
  const reportId = identifierText(input.reportId);
  if (!templateId || !reportId) throw new Error("templateId และ reportId จำเป็นต้องมีค่า");
  const saved: DocumentV2Override = {
    templateId,
    reportId,
    data: cleanRecord(templateId, input.data),
    templateData: cleanTemplateData(input.templateData),
    updatedAt: new Date().toISOString(),
    updatedByUserId: identifierText(input.actorUserId)
  };
  const store = await readJsonStore<OverrideStore>(STORE_FILE, {});
  store[documentOverrideKey(templateId, reportId)] = saved;
  await writeJsonStore(STORE_FILE, store);
  return saved;
}

export async function deleteDocumentV2Override(templateId: string, reportId: string) {
  const store = await readJsonStore<OverrideStore>(STORE_FILE, {});
  delete store[documentOverrideKey(templateId, reportId)];
  await writeJsonStore(STORE_FILE, store);
}
