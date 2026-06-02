import { readFile } from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import type { DocumentV2Data, DocumentV2FieldDebug } from "@/lib/documents-v2/types";
import { getTemplateById, type DocumentV2TemplateId } from "@/lib/documents-v2/template-config";
import type { DocumentV2FieldMapping, DocumentV2FieldKey, DocumentV2MappedValue } from "@/lib/documents-v2/mapping-store";

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

function makeFieldWidgetsInvisible(field: ReturnType<ReturnType<PDFDocument["getForm"]>["getFields"]>[number]) {
  try {
    const widgets = field.acroField.getWidgets();
    widgets.forEach((widget) => {
      widget.getOrCreateBorderStyle().setWidth(0);
      const appearance = widget.getOrCreateAppearanceCharacteristics();
      appearance.setBorderColor([]);
    });
  } catch {
    // Some PDFs have unusual field dictionaries. Keep generation alive.
  }
}

export async function generateDocumentV2(data: DocumentV2Data, templateId?: string): Promise<Uint8Array> {
  throw new Error("internal: use generateDocumentV2WithBytes");
}

export async function generateDocumentV2WithBytes(
  data: DocumentV2Data,
  bytes: Uint8Array,
  mapping?: DocumentV2FieldMapping,
  options: { hideFieldBorders?: boolean } = {}
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  pdf.registerFontkit(fontkit);
  const fontBytes = await readFile(path.join(process.cwd(), "public/fonts/tahoma.ttf"));
  const thaiFont = await pdf.embedFont(fontBytes, { subset: true });
  const form = pdf.getForm();
  const fields = form.getFields();
  if (!fields.length) throw new Error("PDF ไม่มี AcroForm fields");
  fields.forEach((field) => {
    if (options.hideFieldBorders) makeFieldWidgetsInvisible(field);
    try {
      form.getTextField(field.getName()).setText("");
    } catch {}
  });

  const active: DocumentV2FieldMapping = {};
  for (const [pdfField, mappedKey] of Object.entries(mapping || {})) {
    active[pdfField] = (mappedKey || "") as DocumentV2FieldKey | "";
  }
  const allData = data as Record<string, string>;
  for (const [pdfField, mappedValue] of Object.entries(active)) {
    if (!mappedValue) continue;
    let value = "";
    const mappingToken = mappedValue as DocumentV2MappedValue;
    if (mappingToken.startsWith("raw:")) {
      const rawKey = mappingToken.slice(4).trim();
      value = String(allData[rawKey] || "");
    } else {
      value = String(allData[mappingToken as DocumentV2FieldKey] || "");
    }
    setTextIfExists(form, [pdfField], value, thaiFont);
  }
  form.updateFieldAppearances(thaiFont);

  form.flatten();
  return pdf.save();
}
