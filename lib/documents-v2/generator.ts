import { readFile } from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import type { DocumentV2Data, DocumentV2FieldDebug } from "@/lib/documents-v2/types";
import { getTemplateById, type DocumentV2TemplateId } from "@/lib/documents-v2/template-config";
import type { DocumentV2FieldMapping, DocumentV2FieldKey } from "@/lib/documents-v2/mapping-store";

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
  bytes: Uint8Array,
  mapping?: DocumentV2FieldMapping
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  pdf.registerFontkit(fontkit);
  const fontBytes = await readFile(path.join(process.cwd(), "public/fonts/tahoma.ttf"));
  const thaiFont = await pdf.embedFont(fontBytes, { subset: true });
  const form = pdf.getForm();
  const fields = form.getFields();
  if (!fields.length) throw new Error("PDF ไม่มี AcroForm fields");
  form.updateFieldAppearances(thaiFont);

  const fallback: DocumentV2FieldMapping = {
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
  const active = { ...fallback, ...(mapping || {}) };
  for (const [pdfField, dataKey] of Object.entries(active)) {
    if (!dataKey) continue;
    const value = String((data as Record<string, string>)[dataKey as DocumentV2FieldKey] || "");
    setTextIfExists(form, [pdfField], value, thaiFont);
  }

  form.flatten();
  return pdf.save();
}
