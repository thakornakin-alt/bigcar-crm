import { readFile } from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, TextAlignment } from "pdf-lib";
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
      const shouldCenter = /^(SELL_Price|fill_34|fill_36|Downpayment|fill_38|fill_39|fill_40|fill_41|fill_42|fill_43|fill_44|fill_45|fill_46|Deposit|TOTAL_PAY|TOTAL_THAI|Underline\d+|Total_thai)$/i.test(n);
      if (shouldCenter) {
        field.setAlignment(TextAlignment.Center);
      }
      field.setText(value);
      field.updateAppearances(thaiFont);
      return;
    } catch {}
  }
}

function normalizeMoneyLike(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const normalized = raw.replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!normalized) return "";
  const number = Number(normalized);
  if (!Number.isFinite(number)) return "";
  return number;
}

function thaiNumberToWords(input: number) {
  if (!Number.isFinite(input)) return "";
  const rounded = Math.round(input * 100) / 100;
  const integerPart = Math.floor(Math.abs(rounded));
  const satangPart = Math.round((Math.abs(rounded) - integerPart) * 100);
  const unitWords = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  const digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];

  function convertChunk(n: number): string {
    if (n === 0) return "";
    let result = "";
    const chars = String(n).split("");
    for (let i = 0; i < chars.length; i++) {
      const digit = Number(chars[i]);
      const pos = chars.length - i - 1;
      if (digit === 0) continue;
      if (pos === 0) {
        if (digit === 1 && chars.length > 1) result += "เอ็ด";
        else result += digits[digit];
      } else if (pos === 1) {
        if (digit === 1) result += "สิบ";
        else if (digit === 2) result += "ยี่สิบ";
        else result += `${digits[digit]}สิบ`;
      } else {
        result += `${digits[digit]}${unitWords[pos]}`;
      }
    }
    return result;
  }

  function convertInteger(n: number): string {
    if (n === 0) return "ศูนย์";
    let remaining = n;
    let result = "";
    const million = 1_000_000;
    const chunks: number[] = [];
    while (remaining > 0) {
      chunks.unshift(remaining % million);
      remaining = Math.floor(remaining / million);
    }
    chunks.forEach((chunk, index) => {
      if (chunk === 0) return;
      const chunkText = convertChunk(chunk);
      if (index > 0) {
        result += chunkText ? `${chunkText}ล้าน` : "ล้าน";
      } else {
        result += chunkText;
      }
    });
    return result || "ศูนย์";
  }

  const integerText = convertInteger(integerPart);
  if (satangPart === 0) return `${integerText}บาทถ้วน`;
  const satangText = convertInteger(satangPart);
  return `${integerText}บาท${satangText}สตางค์`;
}

function autoThaiTextFromTotalPay(totalPayValue: unknown) {
  const normalized = normalizeMoneyLike(totalPayValue);
  if (normalized === "") return "";
  return thaiNumberToWords(normalized);
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
  const totalPayWords = autoThaiTextFromTotalPay(allData.TOTAL_PAY || allData.remainingAmount || allData.totalPay);
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
    if (/^(TOTAL_THAI)$/i.test(pdfField) && totalPayWords) {
      value = totalPayWords;
    }
    setTextIfExists(form, [pdfField], value, thaiFont);
  }
  if (totalPayWords) {
    setTextIfExists(form, ["TOTAL_THAI", "Total_thai"], totalPayWords, thaiFont);
  }
  form.updateFieldAppearances(thaiFont);

  form.flatten();
  return pdf.save();
}
