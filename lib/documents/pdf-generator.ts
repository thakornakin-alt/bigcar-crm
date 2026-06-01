import { readFile } from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { formatThaiDate, getDocumentTemplate } from "@/lib/documents/template-config";
import type { DocumentData, DocumentFieldConfig, DocumentTemplateId } from "@/lib/documents/document-types";

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
    ,
    contractDate: ["transactionDate", "bookingDate", "createdAt"],
    licensePlate: ["plate", "plateNumber"],
    engineNumber: ["engineNo", "engineNumber"],
    chassisNumber: ["vin", "chassisNo", "chassisNumber"],
    sellPrice: ["salePrice", "price", "finalPrice"],
    depositAmount: ["bookingPrice", "downPayment"],
    remainingAmount: ["financeAmount", "netCarPrice"],
    buyerSignature: ["customerName", "signatureName"],
    sellerSignature: ["sellerName", "saleName"],
    buyerWitness: ["customerName"],
    sellerWitness: ["sellerName", "saleName"]
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

export async function generateFilledDocumentPdf(input: {
  templateId: DocumentTemplateId;
  data: DocumentData;
  fields?: Record<string, DocumentFieldConfig>;
  baseUrl?: string;
}) {
  const template = await getDocumentTemplate(input.templateId);
  if (!template) throw new Error("ไม่พบ PDF Template");

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
  if (!isPdfTemplate) {
    throw new Error("Template นี้ไม่ใช่ PDF แบบมีฟิลด์กรอก (AcroForm)");
  }

  const pdf = await PDFDocument.load(backgroundBytes, { ignoreEncryption: true });
  pdf.registerFontkit(fontkit);
  let thaiFont;
  try {
    const fontBytes = await readAssetBytes("public/fonts/tahoma.ttf", input.baseUrl);
    thaiFont = await pdf.embedFont(fontBytes, { subset: true });
  } catch {
    throw new Error("โหลดฟอนต์ภาษาไทยไม่สำเร็จ");
  }

  const fields = input.fields || template.fields;

  // Manual Mapping mode for contract: do not require AcroForm.
  if (input.templateId === "contract") {
    const pages = pdf.getPages();
    const firstPage = pages[0];
    if (!firstPage) throw new Error("ไม่พบหน้าของ PDF");
    for (const [key, field] of Object.entries(fields)) {
      const page = pages[Math.max((field.page || 1) - 1, 0)] || firstPage;
      const value = fieldValue(key, field, input.data);
      if (!value) continue;
      page.drawText(value, {
        x: field.x,
        y: field.y,
        size: field.fontSize || 10,
        font: thaiFont,
        color: rgb(0.02, 0.04, 0.07)
      });
    }
    return pdf.save();
  }

  const form = pdf.getForm();
  const formFields = form.getFields();
  if (!formFields.length) {
    throw new Error("ไม่พบช่องกรอกใน PDF Template (AcroForm)");
  }
  form.updateFieldAppearances(thaiFont);

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

  return pdf.save();
}
