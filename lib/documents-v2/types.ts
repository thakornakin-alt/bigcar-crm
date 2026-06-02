import type { ReportHistoryItem } from "@/lib/types";

export const DOC_V2_TEMPLATE_ID = "contract-field" as const;

export type DocumentV2FieldDebug = {
  name: string;
  type: string;
};

export type DocumentV2Data = {
  contractDate: string;
  currentDate: string;
  customerName: string;
  customerAddress: string;
  idCard: string;
  plateNo: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  engineNo: string;
  chassisNo: string;
  sellPrice: string;
  deposit: string;
  remainingAmount: string;
  saleName: string;
};

function pick(obj: Record<string, any>, ...keys: string[]) {
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, "").replace(/[()/_\-.]/g, "");
  const extra = obj?.extraFields && typeof obj.extraFields === "object" ? obj.extraFields : {};
  for (const key of keys) {
    const value = obj?.[key] ?? extra?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  const extraEntries = Object.entries(extra || {});
  for (const key of keys) {
    const normalizedKey = normalize(key);
    const matched = extraEntries.find(([extraKey]) => normalize(String(extraKey || "")) === normalizedKey);
    if (matched && matched[1] !== undefined && matched[1] !== null && String(matched[1]).trim() !== "") {
      return String(matched[1]);
    }
  }
  return "";
}

function extractFromReportText(text: string, patterns: RegExp[]) {
  const source = String(text || "");
  for (const pattern of patterns) {
    const m = source.match(pattern);
    if (m?.[1]) return String(m[1]).trim();
  }
  return "";
}

function normalizeMoney(rawValue: string) {
  const only = String(rawValue || "").replace(/[^0-9.\-]/g, "");
  if (!only) return "";
  const num = Number(only);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("th-TH");
}

export function mapBookingToDocumentV2(report?: ReportHistoryItem | null): DocumentV2Data {
  const raw = (report || {}) as Record<string, any>;
  const reportText = String(raw.reportText || "");

  const rawFinal = pick(raw, "finalPrice", "netPayment", "salePrice", "carPrice", "final_price", "ราคาตั้งขาย", "ราคาขาย")
    || extractFromReportText(reportText, [
      /ราคามาตรฐาน.*?[:：]\s*([0-9,]+)/i,
      /ราคาตั้งขาย\s*[:：]\s*([0-9,]+)/i,
      /ราคาขาย\s*[:：]\s*([0-9,]+)/i,
      /ราคาที่ขาย\s*[:：]\s*([0-9,]+)/i,
      /ราคาสุทธิ\s*[:：]\s*([0-9,]+)/i
    ]);
  const rawDeposit = pick(raw, "bookingPrice", "downPayment", "deposit", "booking_price", "เงินจอง")
    || extractFromReportText(reportText, [
      /เงินจอง\s*[:：]\s*([0-9,]+)/i,
      /จองรถยนต์\s*[:：]\s*([0-9,]+)/i,
      /มัดจำ\s*[:：]\s*([0-9,]+)/i
    ]);
  const finalPrice = Number(String(rawFinal || "").replace(/,/g, ""));
  const depositPrice = Number(String(rawDeposit || "").replace(/,/g, ""));
  const remaining = Number.isFinite(finalPrice) && Number.isFinite(depositPrice) ? Math.max(finalPrice - depositPrice, 0) : 0;
  const now = new Date();
  const currentDate = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  return {
    contractDate: pick(raw, "contractDate", "deliveryDate", "bookingDate", "createdAt", "updatedAt").slice(0, 10),
    currentDate,
    customerName: pick(raw, "customerName", "name", "buyerName")
      || extractFromReportText(reportText, [/ชื่อลูกค้า\s*[:：]\s*(.+)/i, /ชื่อ-นามสกุล\s*[:：]\s*(.+)/i]),
    customerAddress: pick(raw, "address", "customerAddress", "shippingAddress", "ที่อยู่", "ที่อยู่จัดส่งเอกสาร")
      || extractFromReportText(reportText, [
        /ที่อยู่จัดส่งเอกสาร\s*[\r\n]+([^\r\n]+)/i,
        /ที่อยู่\s*[:：]\s*(.+)/i
      ]),
    idCard: pick(raw, "idCard", "citizenId", "taxId")
      || extractFromReportText(reportText, [/เลขบัตรประชาชน\s*[:：]\s*([0-9\-]+)/i]),
    plateNo: pick(raw, "plate", "licensePlate", "plateNo")
      || extractFromReportText(reportText, [/ทะเบียนรถ\s*[:：]\s*(.+)/i, /ทะเบียน\s*[:：]\s*(.+)/i]),
    brand: pick(raw, "brand", "carBrand")
      || extractFromReportText(reportText, [/ยี่ห้อรถ\s*[:：]\s*(.+)/i]),
    model: pick(raw, "model", "carModel", "รุ่นรถ")
      || extractFromReportText(reportText, [/รุ่นรถ\s*[:：]\s*(.+)/i]),
    year: pick(raw, "year", "registeredYear", "modelYear"),
    color: pick(raw, "color", "carColor"),
    engineNo: pick(raw, "engineNo", "engineNumber", "engine", "Engine", "EngineNo", "Engine No", "Engine No.", "EngineNumber", "Engine Number", "เลขเครื่อง", "เลขเครื่องยนต์", "MotorNo", "Motor No")
      || extractFromReportText(reportText, [/เลขเครื่อง(?:ยนต์)?\s*[:：]\s*([^\r\n]+)/i]),
    chassisNo: pick(raw, "chassisNo", "vin", "chassisNumber", "เลขตัวถัง", "เลขตัวรถ", "VIN", "Chassis")
      || extractFromReportText(reportText, [/เลขตัวถัง\s*[:：]\s*([^\r\n]+)/i, /VIN\s*[:：]\s*([^\r\n]+)/i]),
    sellPrice: normalizeMoney(pick(raw, "salePrice", "finalPrice", "netPayment", "carPrice") || rawFinal),
    deposit: normalizeMoney(String(rawDeposit || "")),
    remainingAmount: remaining > 0 ? remaining.toLocaleString("th-TH") : "",
    saleName: pick(raw, "saleName", "salesName", "ownerName")
      || extractFromReportText(reportText, [/เซลล์เจ้าของเคส\s*[:：]\s*(.+)/i, /ผู้ขาย\s*[:：]\s*(.+)/i])
  };
}
