import { readJsonStore, writeJsonStore } from "@/lib/json-store";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { DocumentFieldConfig, DocumentTemplateConfig, DocumentTemplateId } from "@/lib/documents/document-types";

const STORE_FILE = "document-template-configs.json";

export const documentTemplates: DocumentTemplateConfig[] = [
  {
    id: "vehicle-private-use",
    title: "บันทึกรับทราบรถส่วนบุคคล",
    description: "แบบฟอร์มรับทราบการนำรถยนต์นั่งส่วนบุคคลเกินเจ็ดคนไปใช้งาน",
    fileName: "vehicle-private-use.pdf",
    backgroundPath: "public/document-templates/vehicle-private-use.jpg",
    fields: {
      transactionPlace: { page: 1, x: 355, y: 690, fontSize: 11 },
      transactionDate: { page: 1, x: 358, y: 657, fontSize: 11, type: "date" },
      customerName: { page: 1, x: 135, y: 609, fontSize: 11 },
      age: { page: 1, x: 395, y: 609, fontSize: 11 },
      plate: { page: 1, x: 182, y: 584, fontSize: 11 },
      houseNo: { page: 1, x: 405, y: 584, fontSize: 11 },
      villageNo: { page: 1, x: 528, y: 584, fontSize: 11 },
      road: { page: 1, x: 135, y: 558, fontSize: 11 },
      subDistrict: { page: 1, x: 382, y: 558, fontSize: 11 },
      district: { page: 1, x: 128, y: 532, fontSize: 11 },
      province: { page: 1, x: 298, y: 532, fontSize: 11 },
      phone: { page: 1, x: 452, y: 532, fontSize: 11 },
      signatureName: { page: 1, x: 305, y: 211, fontSize: 11 }
    }
  },
  {
    id: "sale-summary",
    title: "ใบสรุปการขาย",
    description: "สรุปรายละเอียดลูกค้า รถ เงื่อนไขขาย และงานส่งมอบ",
    fileName: "sale-summary.pdf",
    backgroundPath: "public/document-templates/sale-summary.jpg",
    fields: {
      customerName: { page: 1, x: 118, y: 723, fontSize: 11 },
      phone: { page: 1, x: 452, y: 723, fontSize: 11 },
      address: { page: 1, x: 82, y: 694, fontSize: 10, width: 455 },
      idCard: { page: 1, x: 147, y: 666, fontSize: 11 },
      plate: { page: 1, x: 94, y: 612, fontSize: 11 },
      carBrand: { page: 1, x: 190, y: 612, fontSize: 11 },
      carModel: { page: 1, x: 300, y: 612, fontSize: 10, width: 165 },
      year: { page: 1, x: 512, y: 612, fontSize: 11 },
      vin: { page: 1, x: 170, y: 585, fontSize: 10 },
      color: { page: 1, x: 332, y: 585, fontSize: 11 },
      cashPayment: { page: 1, x: 97, y: 558, fontSize: 12, type: "checkbox", value: "cash" },
      financePayment: { page: 1, x: 165, y: 558, fontSize: 12, type: "checkbox", value: "finance" },
      salePrice: { page: 1, x: 132, y: 530, fontSize: 11 },
      bookingPrice: { page: 1, x: 99, y: 506, fontSize: 11 },
      bookingDate: { page: 1, x: 193, y: 506, fontSize: 11, type: "date" },
      deliveryDate: { page: 1, x: 457, y: 506, fontSize: 11 },
      deliveryLocation: { page: 1, x: 125, y: 480, fontSize: 11 },
      sellerName: { page: 1, x: 115, y: 118, fontSize: 11 },
      approverName: { page: 1, x: 395, y: 118, fontSize: 11 }
    }
  },
  {
    id: "contract",
    title: "สัญญาซื้อขายรถยนต์",
    description: "สัญญาซื้อขายรถยนต์พร้อมรายละเอียดผู้ซื้อและรถ",
    fileName: "contract.pdf",
    backgroundPath: "public/document-templates/contract.pdf",
    fields: {
      transactionDate: { page: 1, x: 466, y: 727, fontSize: 10, type: "date" },
      customerName: { page: 1, x: 377, y: 679, fontSize: 10 },
      idCard: { page: 1, x: 445, y: 650, fontSize: 10 },
      customerAddress: { page: 1, x: 95, y: 627, fontSize: 9, width: 425 },
      carBrand: { page: 1, x: 236, y: 559, fontSize: 10 },
      carModel: { page: 1, x: 306, y: 559, fontSize: 10, width: 210 },
      plate: { page: 1, x: 198, y: 535, fontSize: 10 },
      engineNo: { page: 1, x: 375, y: 535, fontSize: 10 },
      vin: { page: 1, x: 356, y: 513, fontSize: 9, width: 165 },
      salePrice: { page: 1, x: 385, y: 488, fontSize: 10 },
      bookingPrice: { page: 1, x: 382, y: 462, fontSize: 10 },
      financeAmount: { page: 1, x: 276, y: 436, fontSize: 10 },
      signatureName: { page: 1, x: 125, y: 154, fontSize: 10 },
      sellerName: { page: 1, x: 420, y: 154, fontSize: 10 }
    }
  },
  {
    id: "payment-receipt",
    title: "รายละเอียดการชำระเงิน / ใบรับเงินชั่วคราว",
    description: "ใบรับเงินชั่วคราวและรายละเอียดการชำระเงิน",
    fileName: "payment-receipt.pdf",
    backgroundPath: "public/document-templates/payment-receipt.pdf",
    fields: {
      transactionDate: { page: 1, x: 432, y: 750, fontSize: 10, type: "date" },
      customerName: { page: 1, x: 84, y: 692, fontSize: 10 },
      idCard: { page: 1, x: 132, y: 672, fontSize: 10 },
      phone: { page: 1, x: 121, y: 651, fontSize: 10 },
      address: { page: 1, x: 74, y: 630, fontSize: 9, width: 310 },
      plate: { page: 1, x: 127, y: 562, fontSize: 10 },
      carBrand: { page: 1, x: 295, y: 562, fontSize: 10 },
      carModel: { page: 1, x: 94, y: 540, fontSize: 9, width: 205 },
      year: { page: 1, x: 337, y: 540, fontSize: 10 },
      color: { page: 1, x: 402, y: 540, fontSize: 10 },
      vin: { page: 1, x: 121, y: 518, fontSize: 9 },
      engineNo: { page: 1, x: 135, y: 496, fontSize: 9 },
      salePrice: { page: 1, x: 332, y: 408, fontSize: 10 },
      bookingPrice: { page: 1, x: 332, y: 387, fontSize: 10 },
      sellerName: { page: 1, x: 425, y: 650, fontSize: 10 }
    }
  },
  {
    id: "customer-form",
    title: "แบบฟอร์มข้อมูลลูกค้า",
    description: "ฟอร์มข้อมูลลูกค้าประเภทบุคคลธรรมดา",
    fileName: "customer-form.pdf",
    backgroundPath: "public/document-templates/customer-form.jpg",
    fields: {
      customerName: { page: 1, x: 92, y: 694, fontSize: 10 },
      idCard: { page: 1, x: 365, y: 694, fontSize: 10 },
      address: { page: 1, x: 78, y: 585, fontSize: 9, width: 430 },
      phone: { page: 1, x: 170, y: 518, fontSize: 10 },
      email: { page: 1, x: 80, y: 492, fontSize: 10 },
      occupation: { page: 1, x: 100, y: 649, fontSize: 10 },
      transactionDate: { page: 1, x: 450, y: 760, fontSize: 10, type: "date" }
    }
  },
  {
    id: "power-of-attorney",
    title: "หนังสือมอบอำนาจ",
    description: "เอกสารมอบอำนาจสำหรับงานโอน/ดำเนินการแทน",
    fileName: "power-of-attorney.pdf",
    backgroundPath: "public/document-templates/power-of-attorney.pdf",
    fields: {
      transactionDate: { page: 1, x: 430, y: 730, fontSize: 10, type: "date" },
      customerName: { page: 1, x: 130, y: 650, fontSize: 10 },
      idCard: { page: 1, x: 335, y: 650, fontSize: 10 },
      address: { page: 1, x: 90, y: 625, fontSize: 9, width: 430 },
      phone: { page: 1, x: 420, y: 600, fontSize: 10 },
      plate: { page: 1, x: 180, y: 520, fontSize: 10 },
      carBrand: { page: 1, x: 285, y: 520, fontSize: 10 },
      carModel: { page: 1, x: 360, y: 520, fontSize: 10 },
      signatureName: { page: 1, x: 175, y: 170, fontSize: 10 }
    }
  },
  {
    id: "kyc-secap-juristic",
    title: "KYC Secap นิติบุคคล",
    description: "แบบฟอร์ม KYC Secap สำหรับลูกค้านิติบุคคล",
    fileName: "kyc-secap-juristic.pdf",
    backgroundPath: "public/document-templates/kyc-secap-juristic.pdf",
    fields: {
      customerName: { page: 1, x: 120, y: 690, fontSize: 10 },
      idCard: { page: 1, x: 370, y: 690, fontSize: 10 },
      address: { page: 1, x: 90, y: 590, fontSize: 9, width: 430 },
      phone: { page: 1, x: 170, y: 520, fontSize: 10 },
      email: { page: 1, x: 90, y: 495, fontSize: 10 }
    }
  },
  {
    id: "kyc-secap-personal",
    title: "KYC Secap บุคคลธรรมดา",
    description: "แบบฟอร์ม KYC Secap สำหรับลูกค้าบุคคลธรรมดา",
    fileName: "kyc-secap-personal.pdf",
    backgroundPath: "public/document-templates/kyc-secap-personal.pdf",
    fields: {
      customerName: { page: 1, x: 120, y: 690, fontSize: 10 },
      idCard: { page: 1, x: 370, y: 690, fontSize: 10 },
      occupation: { page: 1, x: 110, y: 650, fontSize: 10 },
      address: { page: 1, x: 90, y: 590, fontSize: 9, width: 430 },
      phone: { page: 1, x: 170, y: 520, fontSize: 10 },
      email: { page: 1, x: 90, y: 495, fontSize: 10 }
    }
  },
  {
    id: "kyc-rdd-personal-old",
    title: "KYC รถดีเด็ด บุคคลธรรมดา",
    description: "แบบฟอร์ม KYC รถดีเด็ดสำหรับบุคคลธรรมดา",
    fileName: "kyc-rdd-personal-old.pdf",
    backgroundPath: "public/document-templates/kyc-rdd-personal-old.pdf",
    fields: {
      customerName: { page: 1, x: 120, y: 690, fontSize: 10 },
      idCard: { page: 1, x: 370, y: 690, fontSize: 10 },
      address: { page: 1, x: 90, y: 590, fontSize: 9, width: 430 },
      phone: { page: 1, x: 170, y: 520, fontSize: 10 },
      email: { page: 1, x: 90, y: 495, fontSize: 10 }
    }
  },
  {
    id: "kyc-rdd-juristic",
    title: "RDD KYC นิติบุคคล",
    description: "แบบฟอร์ม KYC RDD สำหรับลูกค้านิติบุคคล",
    fileName: "kyc-rdd-juristic.pdf",
    backgroundPath: "public/document-templates/kyc-rdd-juristic.pdf",
    fields: {
      customerName: { page: 1, x: 120, y: 690, fontSize: 10 },
      idCard: { page: 1, x: 370, y: 690, fontSize: 10 },
      address: { page: 1, x: 90, y: 590, fontSize: 9, width: 430 },
      phone: { page: 1, x: 170, y: 520, fontSize: 10 },
      email: { page: 1, x: 90, y: 495, fontSize: 10 }
    }
  },
  {
    id: "pdpa-right-request",
    title: "แบบคำขอใช้สิทธิข้อมูลส่วนบุคคล RDD",
    description: "แบบคำขอการใช้สิทธิของเจ้าของข้อมูลส่วนบุคคล",
    fileName: "pdpa-right-request.pdf",
    backgroundPath: "public/document-templates/pdpa-right-request.pdf",
    fields: {
      transactionDate: { page: 1, x: 430, y: 730, fontSize: 10, type: "date" },
      customerName: { page: 1, x: 130, y: 650, fontSize: 10 },
      idCard: { page: 1, x: 350, y: 650, fontSize: 10 },
      address: { page: 1, x: 90, y: 610, fontSize: 9, width: 430 },
      phone: { page: 1, x: 170, y: 570, fontSize: 10 },
      email: { page: 1, x: 90, y: 545, fontSize: 10 }
    }
  },
  {
    id: "kyc-rdd-personal",
    title: "แบบฟอร์ม A KYC บุคคลธรรมดา RDD",
    description: "แบบฟอร์ม A KYC บุคคลธรรมดา RDD",
    fileName: "kyc-rdd-personal.pdf",
    backgroundPath: "public/document-templates/kyc-rdd-personal.pdf",
    fields: {
      customerName: { page: 1, x: 120, y: 690, fontSize: 10 },
      idCard: { page: 1, x: 370, y: 690, fontSize: 10 },
      occupation: { page: 1, x: 110, y: 650, fontSize: 10 },
      address: { page: 1, x: 90, y: 590, fontSize: 9, width: 430 },
      phone: { page: 1, x: 170, y: 520, fontSize: 10 },
      email: { page: 1, x: 90, y: 495, fontSize: 10 }
    }
  },
  {
    id: "transfer-request-rdd",
    title: "แบบคำขอโอนและรับโอน RDD",
    description: "แบบฟอร์มกรอกคำขอโอนและรับโอน",
    fileName: "transfer-request-rdd.pdf",
    backgroundPath: "public/document-templates/transfer-request-rdd.pdf",
    fields: {
      customerName: { page: 1, x: 120, y: 690, fontSize: 10 },
      idCard: { page: 1, x: 365, y: 690, fontSize: 10 },
      address: { page: 1, x: 90, y: 640, fontSize: 9, width: 430 },
      plate: { page: 1, x: 140, y: 560, fontSize: 10 },
      carBrand: { page: 1, x: 250, y: 560, fontSize: 10 },
      carModel: { page: 1, x: 330, y: 560, fontSize: 10 },
      vin: { page: 1, x: 145, y: 535, fontSize: 9 },
      signatureName: { page: 1, x: 165, y: 160, fontSize: 10 }
    }
  },
  {
    id: "booking-refund",
    title: "แบบฟอร์มคืนเงินจอง",
    description: "แบบฟอร์มสำหรับคืนเงินจองลูกค้า",
    fileName: "booking-refund.pdf",
    backgroundPath: "public/document-templates/booking-refund.pdf",
    fields: {
      transactionDate: { page: 1, x: 430, y: 730, fontSize: 10, type: "date" },
      customerName: { page: 1, x: 130, y: 650, fontSize: 10 },
      phone: { page: 1, x: 390, y: 650, fontSize: 10 },
      plate: { page: 1, x: 150, y: 585, fontSize: 10 },
      bookingPrice: { page: 1, x: 360, y: 585, fontSize: 10 },
      sellerName: { page: 1, x: 150, y: 520, fontSize: 10 },
      signatureName: { page: 1, x: 165, y: 160, fontSize: 10 }
    }
  },
  {
    id: "transport-transfer",
    title: "ใบคำขอโอนขนส่ง",
    description: "ใบคำขอโอนขนส่งสำหรับงานทะเบียน",
    fileName: "transport-transfer.pdf",
    backgroundPath: "public/document-templates/transport-transfer.pdf",
    fields: {
      customerName: { page: 1, x: 130, y: 670, fontSize: 10 },
      idCard: { page: 1, x: 350, y: 670, fontSize: 10 },
      address: { page: 1, x: 90, y: 625, fontSize: 9, width: 430 },
      plate: { page: 1, x: 150, y: 560, fontSize: 10 },
      carBrand: { page: 1, x: 250, y: 560, fontSize: 10 },
      carModel: { page: 1, x: 330, y: 560, fontSize: 10 },
      vin: { page: 1, x: 145, y: 535, fontSize: 9 },
      signatureName: { page: 1, x: 165, y: 160, fontSize: 10 }
    }
  },
  {
    id: "document-cover",
    title: "ใบปะหน้าส่งเอกสาร",
    description: "ใบปะหน้าส่งเอกสารสำหรับส่งต่อภายใน/ภายนอก",
    fileName: "document-cover.pdf",
    backgroundPath: "public/document-templates/document-cover.pdf",
    fields: {
      transactionDate: { page: 1, x: 430, y: 730, fontSize: 10, type: "date" },
      customerName: { page: 1, x: 130, y: 650, fontSize: 10 },
      phone: { page: 1, x: 390, y: 650, fontSize: 10 },
      plate: { page: 1, x: 150, y: 600, fontSize: 10 },
      carModel: { page: 1, x: 250, y: 600, fontSize: 10 },
      sellerName: { page: 1, x: 130, y: 550, fontSize: 10 }
    }
  }
];

type StoredTemplateOverride = {
  fields?: Record<string, DocumentFieldConfig>;
  backgroundPath?: string;
  fileName?: string;
  uploadedAt?: string;
};

type StoredTemplateConfigs = Partial<Record<DocumentTemplateId, Record<string, DocumentFieldConfig> | StoredTemplateOverride>>;

function dataDirectory() {
  return process.env.BIG_CAR_DATA_DIR
    ? path.resolve(process.env.BIG_CAR_DATA_DIR)
    : path.join(process.cwd(), ".data");
}

function normalizeOverride(value: Record<string, DocumentFieldConfig> | StoredTemplateOverride | undefined): StoredTemplateOverride {
  if (!value) return {};
  if ("fields" in value || "backgroundPath" in value || "fileName" in value) return value as StoredTemplateOverride;
  return { fields: value as Record<string, DocumentFieldConfig> };
}

function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|#%&{}$!'@+=`]/g, "-").replace(/\s+/g, "-").slice(0, 120) || "template.pdf";
}

export function listDocumentTemplates() {
  return documentTemplates;
}

export async function listDocumentTemplatesWithOverrides() {
  const stored = await readJsonStore<StoredTemplateConfigs>(STORE_FILE, {});
  return documentTemplates.map((template) => ({
    ...template,
    ...(() => {
      const override = normalizeOverride(stored[template.id]);
      return {
        backgroundPath: override.backgroundPath || template.backgroundPath,
        fileName: override.fileName || template.fileName
      };
    })(),
    fields: {
      ...template.fields,
      ...(normalizeOverride(stored[template.id]).fields || {})
    }
  }));
}

export async function getDocumentTemplate(id: string) {
  const templates = await listDocumentTemplatesWithOverrides();
  return templates.find((template) => template.id === id) || null;
}

export async function saveDocumentTemplateFields(templateId: DocumentTemplateId, fields: Record<string, DocumentFieldConfig>) {
  const stored = await readJsonStore<StoredTemplateConfigs>(STORE_FILE, {});
  const current = normalizeOverride(stored[templateId]);
  stored[templateId] = { ...current, fields };
  await writeJsonStore(STORE_FILE, stored);
  return getDocumentTemplate(templateId);
}

export async function saveDocumentTemplatePdf(input: {
  templateId: DocumentTemplateId;
  fileName: string;
  base64: string;
}) {
  if (!input.templateId) throw new Error("กรุณาเลือก template");
  if (!input.base64) throw new Error("ไม่พบไฟล์ PDF");
  const targetDir = path.join(dataDirectory(), "document-template-uploads");
  await mkdir(targetDir, { recursive: true });
  const fileName = `${input.templateId}-${Date.now()}-${safeFileName(input.fileName || "template.pdf")}`;
  const targetPath = path.join(targetDir, fileName);
  await writeFile(targetPath, Buffer.from(input.base64, "base64"));

  const stored = await readJsonStore<StoredTemplateConfigs>(STORE_FILE, {});
  const current = normalizeOverride(stored[input.templateId]);
  stored[input.templateId] = {
    ...current,
    backgroundPath: targetPath,
    fileName: input.fileName || fileName,
    uploadedAt: new Date().toISOString()
  };
  await writeJsonStore(STORE_FILE, stored);
  return getDocumentTemplate(input.templateId);
}

export function formatThaiDate(value?: string | Date) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}
