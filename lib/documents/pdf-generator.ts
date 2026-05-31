import { readFile } from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { formatThaiDate, getDocumentTemplate } from "@/lib/documents/template-config";
import type { DocumentData, DocumentFieldConfig, DocumentTemplateId } from "@/lib/documents/document-types";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

function absoluteAssetPath(assetPath: string) {
  return path.isAbsolute(assetPath) ? assetPath : path.join(process.cwd(), assetPath);
}

function publicAssetUrl(assetPath: string, baseUrl?: string) {
  const normalized = `/${String(assetPath || "").replace(/^public[\\/]/, "").replace(/\\/g, "/")}`;
  if (!baseUrl) return "";
  return `${baseUrl.replace(/\/+$/, "")}${normalized}`;
}

async function readAssetBytes(assetPath: string, baseUrl?: string) {
  const maybePublic = String(assetPath || "").replace(/\\/g, "/").startsWith("public/");
  // In serverless production, static files under /public are most reliable via HTTP URL.
  if (maybePublic && baseUrl) {
    const url = publicAssetUrl(assetPath, baseUrl);
    if (url) {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        const arr = await response.arrayBuffer();
        return Buffer.from(arr);
      }
    }
  }

  try {
    return await readFile(absoluteAssetPath(assetPath));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT" || !maybePublic) throw error;
    const url = publicAssetUrl(assetPath, baseUrl);
    if (!url) throw error;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw error;
    const arr = await response.arrayBuffer();
    return Buffer.from(arr);
  }
}

function normalizeFieldName(value: string) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function fieldValue(fieldKey: string, field: DocumentFieldConfig, data: DocumentData) {
  const aliases: Record<string, string[]> = {
    customerAddress: ["address"],
    address: ["customerAddress"],
    plateNumber: ["plate"],
    plate: ["plateNumber"],
    vin: ["chassisNumber", "เลขตัวรถ", "เลขตัวถัง"],
    engineNo: ["engineNumber", "เลขเครื่อง"],
    salePrice: ["price", "finalPrice", "ราคาเสนอขายRT"],
    price: ["salePrice", "finalPrice", "ราคาเสนอขายRT"],
    sellerName: ["saleName", "ชื่อผู้ขาย"],
    saleName: ["sellerName", "ชื่อผู้ขาย"],
    signatureName: ["customerName"]
  };

  if (field.type === "date") return textValue(data[fieldKey]) || formatThaiDate();
  const direct = textValue(data[fieldKey]);
  if (direct) return direct;
  for (const alias of aliases[fieldKey] || []) {
    const value = textValue(data[alias]);
    if (value) return value;
  }
  return "";
}

const pdfFieldAliases: Record<string, string[]> = {
  CUSTOMERNAME: ["customerName"],
  CUSTOMERPHONE: ["phone", "customerPhone"],
  CUSTOMERIDCARD: ["idCard", "customerIdCard"],
  CUSTOMERADDRESS: ["address", "customerAddress"],
  BOOKINGNO: ["bookingNo", "bookingNumber", "id"],
  BOOKINGDATE: ["bookingDate", "transactionDate", "createdAt"],
  LICENSEPLATE: ["plate", "plateNumber"],
  CARBRAND: ["carBrand", "brand"],
  CARMODEL: ["carModel", "model"],
  CARYEAR: ["year", "registeredYear"],
  CARCOLOR: ["color"],
  CHASSISNO: ["vin", "chassisNo", "chassisNumber"],
  ENGINENO: ["engineNo", "engineNumber"],
  FINANCECOMPANY: ["financeCompany", "financeName"],
  SELLPRICE: ["salePrice", "finalPrice", "price"],
  DISCOUNTPRICE: ["discountPrice", "discount"],
  NETCARPRICE: ["netCarPrice", "finalPrice", "salePrice"],
  DOWNPAYMENT: ["bookingPrice", "downPayment"],
  FINANCEAMOUNT: ["financeAmount"],
  SALESNAME: ["sellerName", "saleName"]
};

function findMappedValueByPdfFieldName(fieldName: string, data: DocumentData) {
  const key = normalizeFieldName(fieldName);
  const aliases = pdfFieldAliases[key] || [];
  for (const alias of aliases) {
    const value = textValue(data[alias]);
    if (value) return value;
  }
  return "";
}

function wrapText(value: string, maxChars: number) {
  if (!maxChars || value.length <= maxChars) return [value];

  const lines: string[] = [];
  let current = "";
  for (const part of value.split(/\s+/)) {
    const next = current ? `${current} ${part}` : part;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = part;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

export async function generateFilledDocumentPdf(input: {
  templateId: DocumentTemplateId;
  data: DocumentData;
  fields?: Record<string, DocumentFieldConfig>;
  baseUrl?: string;
}) {
  const template = await getDocumentTemplate(input.templateId);
  if (!template) throw new Error("ไม่พบ PDF Template");
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  let backgroundBytes: Buffer;
  try {
    if (template.backgroundBase64) {
      backgroundBytes = Buffer.from(template.backgroundBase64, "base64");
    } else {
      backgroundBytes = await readAssetBytes(template.backgroundPath, input.baseUrl);
    }
  } catch (error) {
    throw error;
  }
  const isPdfTemplate = template.backgroundPath.toLowerCase().endsWith(".pdf");
  const pages = [];

  if (isPdfTemplate) {
    const sourcePdf = await PDFDocument.load(backgroundBytes, { ignoreEncryption: true });
    const copiedPages = await pdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
    for (const copiedPage of copiedPages) {
      pages.push(pdf.addPage(copiedPage));
    }
  } else {
    const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    pages.push(page);
    const backgroundImage = await pdf.embedJpg(backgroundBytes);
    page.drawImage(backgroundImage, {
      x: 0,
      y: 0,
      width: A4_WIDTH,
      height: A4_HEIGHT
    });
  }

  let font;
  try {
    const fontBytes = await readAssetBytes("public/fonts/tahoma.ttf", input.baseUrl);
    font = await pdf.embedFont(fontBytes, { subset: true });
  } catch {
    throw new Error("โหลดฟอนต์ภาษาไทยไม่สำเร็จ");
  }

  const fields = input.fields || template.fields;
  let usedAcroForm = false;
  if (isPdfTemplate) {
    try {
      const form = pdf.getForm();
      const formFields = form.getFields();
      if (formFields.length) {
        usedAcroForm = true;
        for (const formField of formFields) {
          const rawName = formField.getName();
          const normalized = normalizeFieldName(rawName);
          const configured = Object.entries(fields).find(([, config]) => normalizeFieldName(config.pdfFieldName || "") === normalized);
          const fromConfigured = configured ? fieldValue(configured[0], configured[1], input.data) : "";
          const fromAlias = fromConfigured || findMappedValueByPdfFieldName(rawName, input.data);
          const value = fromAlias || textValue(input.data[rawName]);
          if (!value) continue;

          const maybeText = formField as unknown as { setText?: (value: string) => void; check?: () => void };
          if (typeof maybeText.setText === "function") {
            maybeText.setText(value);
            continue;
          }
          if (typeof maybeText.check === "function") {
            const flag = value.toLowerCase();
            if (flag === "1" || flag === "true" || flag === "yes" || flag === "checked" || flag === "x") {
              maybeText.check();
            }
          }
        }
        form.flatten();
      }
    } catch {
      usedAcroForm = false;
    }
  }

  if (isPdfTemplate) {
    try {
      const { replacePdfPlaceholders } = await import("@/lib/documents/pdf-placeholder-replacer");
      await replacePdfPlaceholders({
        sourcePdfBytes: new Uint8Array(backgroundBytes),
        pdfDoc: pdf,
        pages,
        font,
        data: input.data
      });
    } catch {
      // Keep existing workflow: if placeholder replacement fails, continue with existing mapping layers.
    }
  }

  if (!usedAcroForm) {
  for (const [key, field] of Object.entries(fields)) {
    const page = pages[Math.max((field.page || 1) - 1, 0)];
    if (!page) continue;
    const value = fieldValue(key, field, input.data);
    if (field.type === "checkbox") {
      const selectedValue = textValue(input.data.paymentType || input.data[key]).toLowerCase();
      if (selectedValue && selectedValue === textValue(field.value).toLowerCase()) {
        page.drawText("X", {
          x: field.x,
          y: field.y,
          size: field.fontSize || 12,
          font,
          color: rgb(0.02, 0.04, 0.07)
        });
      }
      continue;
    }

    if (!value) continue;
    const maxChars = field.width ? Math.max(Math.floor(field.width / Math.max((field.fontSize || 10) * 0.45, 1)), 10) : 0;
    const lines = wrapText(value, maxChars);
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: field.x,
        y: field.y - index * ((field.fontSize || 10) + 3),
        size: field.fontSize || 10,
        font,
        color: rgb(0.02, 0.04, 0.07)
      });
    });
  }
  }

  return pdf.save();
}
