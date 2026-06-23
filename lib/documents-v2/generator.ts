import { readFile } from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, TextAlignment, rgb } from "pdf-lib";
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
  thaiFont: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  fontSize?: number
) {
  if (!value) return;
  for (const n of names) {
    try {
      const field = form.getTextField(n);
      if (fontSize) {
        try {
          field.setFontSize(fontSize);
        } catch {}
      }
      const shouldCenter = /^(SELL_Price|fill_34|fill_36|Downpayment|fill_38|fill_39|fill_40|fill_41|fill_42|fill_43|fill_44|fill_45|fill_46|Deposit|TOTAL_PAY|Underline\d+|customer_name|sale_name|manager_name|date_day|date_month|date_year)$/i.test(n);
      if (shouldCenter) {
        field.setAlignment(TextAlignment.Center);
      }
      field.setText(value);
      field.updateAppearances(thaiFont);
      return;
    } catch {}
  }
}

function setCheckboxIfExists(form: ReturnType<PDFDocument["getForm"]>, name: string, checked: boolean) {
  try {
    const field = form.getCheckBox(name);
    if (checked) field.check();
    else field.uncheck();
    return true;
  } catch {
    return false;
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

function wrapTextToLines(
  text: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  fontSize: number,
  maxWidth: number,
  maxLines: number
) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) {
      lines.push(current.trim());
      current = "";
    }
  };

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
      current = next;
      continue;
    }
    flush();
    current = word;
    if (font.widthOfTextAtSize(current, fontSize) > maxWidth) {
      while (current.length > 1 && font.widthOfTextAtSize(`${current}…`, fontSize) > maxWidth) {
        current = current.slice(0, -1);
      }
      current = `${current}…`;
      flush();
    }
    if (lines.length >= maxLines) break;
  }
  flush();

  if (lines.length > maxLines) {
    return lines.slice(0, maxLines);
  }

  if (lines.length === maxLines && current) {
    const last = lines[maxLines - 1];
    let candidate = `${last} ${current}`.trim();
    while (candidate.length > 1 && font.widthOfTextAtSize(`${candidate}…`, fontSize) > maxWidth) {
      candidate = candidate.slice(0, -1);
    }
    lines[maxLines - 1] = `${candidate}…`;
    return lines;
  }

  return lines;
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

function applyTemporaryReceiptExtras(
  form: ReturnType<PDFDocument["getForm"]>,
  data: Record<string, unknown>,
  thaiFont: Awaited<ReturnType<PDFDocument["embedFont"]>>
) {
  const textFieldMap: Array<[string, string[]]> = [
    ["bookingDate", ["fill_7"]],
    ["depositDate", ["fill_9"]],
    ["row1Note", ["Underline1"]],
    ["row3Note", ["Underline3"]],
    ["line2Discount", ["fill_34"]],
    ["line4Installment", ["fill_36"]],
    ["line5DownPayment", ["Downpayment"]],
    ["line6Amount", ["fill_38"]],
    ["line7Amount", ["fill_39"]],
    ["line8Amount", ["fill_40"]],
    ["line9Amount", ["fill_41"]],
    ["line10Amount", ["fill_42"]],
    ["line11Amount", ["fill_43"]],
    ["line12Amount", ["fill_44"]],
    ["line13Amount", ["fill_45"]],
    ["line14Amount", ["fill_46"]]
  ];

  textFieldMap.forEach(([dataKey, fieldNames]) => {
    const value = String(data[dataKey] || "").trim();
    setTextIfExists(form, fieldNames, value, thaiFont);
  });

  const checkboxRows: Array<{ key: string; yes: string; no: string }> = [
    { key: "line6Status", yes: "undefined_3", no: "undefined_4" },
    { key: "line7Status", yes: "undefined_5", no: "undefined_6" },
    { key: "line8Status", yes: "undefined_7", no: "undefined_8" },
    { key: "line9Status", yes: "undefined_9", no: "undefined_10" },
    { key: "line10Status", yes: "undefined_11", no: "undefined_12" },
    { key: "line11Status", yes: "undefined_13", no: "undefined_14" },
    { key: "line12Status", yes: "undefined_15", no: "undefined_16" },
    { key: "line13Status", yes: "undefined_17", no: "undefined_18" },
    { key: "line14Status", yes: "undefined_20", no: "undefined_21" }
  ];

  checkboxRows.forEach(({ key, yes, no }) => {
    const status = String(data[key] || "none");
    const checkedYes = status === "gift";
    const checkedNo = status === "charge";
    setCheckboxIfExists(form, yes, checkedYes);
    setCheckboxIfExists(form, no, checkedNo);
    if (status === "none") {
      setCheckboxIfExists(form, yes, false);
      setCheckboxIfExists(form, no, false);
    }
  });
}

function getPowerOfAttorneyFontSize(pdfField: string) {
  const key = String(pdfField || "");
  if (/^(Customer_name)$/i.test(key)) return 10;
  if (/^(vehicle_plate)$/i.test(key)) return 8.5;
  if (/^(customer_age|customer_race|customer_nationality|customer_house_no|customer_moo|customer_soi|customer_road|cusyomer_subdistrict|customer_district|customer_province)$/i.test(key)) {
    return 8.5;
  }
  return undefined;
}

export async function generateDocumentV2(data: DocumentV2Data, templateId?: string): Promise<Uint8Array> {
  throw new Error("internal: use generateDocumentV2WithBytes");
}

export async function generateDocumentV2WithBytes(
  data: DocumentV2Data,
  bytes: Uint8Array,
  templateId?: DocumentV2TemplateId,
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
  const fixedManagerName = "รองสฤษดิ์ ศรีสมาน";
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
    if (/^(manager_name|MANAGER_NAME|approverName)$/i.test(pdfField)) {
      value = fixedManagerName;
    }
    const powerOfAttorneyFontSize = templateId === "power-of-attorney" ? getPowerOfAttorneyFontSize(pdfField) : undefined;
    setTextIfExists(form, [pdfField], value, thaiFont, powerOfAttorneyFontSize);
  }
  setTextIfExists(form, ["manager_name", "MANAGER_NAME", "approverName"], fixedManagerName, thaiFont);
  if (templateId === "temporary-receipt") {
    applyTemporaryReceiptExtras(form, allData, thaiFont);
  }
  form.updateFieldAppearances(thaiFont);

  form.flatten();
  return pdf.save();
}
