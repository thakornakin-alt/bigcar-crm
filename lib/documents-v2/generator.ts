import { readFile } from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import type { DocumentV2Data, DocumentV2FieldDebug } from "@/lib/documents-v2/types";
import { getTemplateById, type DocumentV2TemplateId } from "@/lib/documents-v2/template-config";

export async function listTemplateFieldsV2(templateId?: string): Promise<{
  fields: DocumentV2FieldDebug[];
  templateId: DocumentV2TemplateId;
  templatePath: string;
  templateFile: string;
}> {
  const template = getTemplateById(templateId);
  throw new Error("internal: use listTemplateFieldsV2WithBytes");
}

export async function listTemplateFieldsV2WithBytes(
  templateId: string | undefined,
  bytes: Uint8Array
): Promise<{
  fields: DocumentV2FieldDebug[];
  templateId: DocumentV2TemplateId;
  templatePath: string;
  templateFile: string;
}> {
  const template = getTemplateById(templateId);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdf.getForm();
  const fields = form.getFields();
  if (!fields.length) throw new Error("ไม่พบ AcroForm fields ในไฟล์นี้");
  return {
    templateId: template.id,
    templatePath: template.path,
    templateFile: template.fileName,
    fields: fields.map((f) => ({ name: f.getName(), type: f.constructor.name }))
  };
}

function setTextIfExists(
  form: ReturnType<PDFDocument["getForm"]>,
  names: string[],
  value: string,
  thaiFont: Awaited<ReturnType<PDFDocument["embedFont"]>>
) {
  if (!value) return;
  for (const n of names) {
    try {
      const field = form.getTextField(n);
      field.setText(value);
      field.updateAppearances(thaiFont);
      return;
    } catch {}
  }
}

export async function generateDocumentV2(data: DocumentV2Data, templateId?: string): Promise<Uint8Array> {
  throw new Error("internal: use generateDocumentV2WithBytes");
}

export async function generateDocumentV2WithBytes(
  data: DocumentV2Data,
  bytes: Uint8Array
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  pdf.registerFontkit(fontkit);
  const fontBytes = await readFile(path.join(process.cwd(), "public/fonts/tahoma.ttf"));
  const thaiFont = await pdf.embedFont(fontBytes, { subset: true });
  const form = pdf.getForm();
  const fields = form.getFields();
  if (!fields.length) throw new Error("PDF ไม่มี AcroForm fields");
  form.updateFieldAppearances(thaiFont);

  setTextIfExists(form, ["Text1", "CUSTOMER_NAME", "customerName"], data.customerName, thaiFont);
  setTextIfExists(form, ["Text3", "CONTRACT_DATE", "contractDate"], data.contractDate, thaiFont);
  setTextIfExists(form, ["Text4", "CUSTOMER_ADDRESS", "customerAddress"], data.customerAddress, thaiFont);
  setTextIfExists(form, ["Text6", "ID_CARD", "idCard"], data.idCard, thaiFont);
  setTextIfExists(form, ["Text7", "LICENSE_PLATE", "plateNo"], data.plateNo, thaiFont);
  setTextIfExists(form, ["Text8", "CAR_BRAND", "brand"], data.brand, thaiFont);
  setTextIfExists(form, ["Text9", "CAR_MODEL", "model"], data.model, thaiFont);
  setTextIfExists(form, ["Text10", "CAR_YEAR", "year"], data.year, thaiFont);
  setTextIfExists(form, ["Text11", "CAR_COLOR", "color"], data.color, thaiFont);
  setTextIfExists(form, ["Text12", "ENGINE_NO", "engineNo"], data.engineNo, thaiFont);
  setTextIfExists(form, ["Text13", "CHASSIS_NO", "chassisNo"], data.chassisNo, thaiFont);
  setTextIfExists(form, ["Text14", "SELL_PRICE", "sellPrice"], data.sellPrice, thaiFont);
  setTextIfExists(form, ["Text15", "DOWN_PAYMENT", "deposit"], data.deposit, thaiFont);
  setTextIfExists(form, ["Text16", "REMAINING_AMOUNT", "remainingAmount"], data.remainingAmount, thaiFont);
  setTextIfExists(form, ["Text17", "SALES_NAME", "saleName"], data.saleName, thaiFont);

  form.flatten();
  return pdf.save();
}
