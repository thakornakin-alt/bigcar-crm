import { listStockVehicles, lookupStockByPlate } from "@/lib/apps-script";
import { mergeStockExtraFields } from "@/lib/stock-extra-fields";
import type { ReportHistoryItem, StockVehicle } from "@/lib/types";
import { mapBookingToDocumentV2, type DocumentV2Data } from "@/lib/documents-v2/types";

export type ResolvedDocumentV2Data = DocumentV2Data & Record<string, string>;

export type DocumentV2ResolveDebug = {
  plateFromReport: string;
  normalizedReportPlate: string;
  stockFound: boolean;
  stockPlate: string;
  stockKeys: string[];
  stockEngineNo: string;
  stockChassisNo: string;
  reportEngineNo: string;
  reportChassisNo: string;
  resolvedEngineNo: string;
  resolvedChassisNo: string;
  resolvedAddress: string;
};

function normalizePlate(value: unknown) {
  return String(value || "").replace(/[\s\-_.]/g, "").trim().toUpperCase();
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function objectValue(source: Record<string, unknown>, keys: string[]) {
  const extra = source.extraFields && typeof source.extraFields === "object" ? source.extraFields as Record<string, unknown> : {};
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, "").replace(/[()/_\-.]/g, "");
  for (const key of keys) {
    const value = source[key] ?? extra[key];
    if (value !== undefined && value !== null && clean(value)) return clean(value);
  }
  const extraEntries = Object.entries(extra);
  for (const key of keys) {
    const normalizedKey = normalize(key);
    const matched = extraEntries.find(([extraKey]) => normalize(String(extraKey || "")) === normalizedKey);
    if (matched && matched[1] !== undefined && matched[1] !== null && clean(matched[1])) return clean(matched[1]);
  }
  return "";
}

function extractFromReportText(text: string, patterns: RegExp[]) {
  const source = String(text || "");
  for (const pattern of patterns) {
    const matched = source.match(pattern);
    if (matched?.[1]) return clean(matched[1]);
  }
  return "";
}

const engineKeys = [
  "engineNo",
  "engineNumber",
  "engine",
  "Engine",
  "EngineNo",
  "Engine No",
  "Engine No.",
  "EngineNumber",
  "Engine Number",
  "ENGINE_NO",
  "เลขเครื่อง",
  "เลขเครื่องยนต์",
  "MotorNo",
  "Motor No"
];

const chassisKeys = [
  "chassisNo",
  "chassisNumber",
  "vin",
  "VIN",
  "Chassis",
  "เลขตัวถัง",
  "เลขตัวรถ"
];

async function findStockByPlate(plate: string) {
  if (!plate) return null;
  const normalizedPlate = normalizePlate(plate);
  let stock = await lookupStockByPlate(plate).catch(() => null);
  if (stock) {
    const [merged] = await mergeStockExtraFields([stock]);
    stock = merged || stock;
  }

  const stockRaw = (stock || {}) as Record<string, unknown>;
  const hasEngine = objectValue(stockRaw, engineKeys);
  const hasChassis = objectValue(stockRaw, chassisKeys);
  if (stock && hasEngine && hasChassis) return stock;

  const listed = await listStockVehicles({ query: plate, limit: 80 }).catch(() => ({ vehicles: [], total: 0 }));
  const mergedListed = await mergeStockExtraFields(listed.vehicles || []);
  const exact = mergedListed.find((vehicle) => normalizePlate(vehicle.plate) === normalizedPlate) || null;
  if (!exact) return stock;

  const exactRaw = exact as StockVehicle & Record<string, unknown>;
  const next = { ...(exact as Record<string, unknown>), ...(stock as Record<string, unknown> || {}) } as StockVehicle & Record<string, unknown>;
  const exactEngine = objectValue(exactRaw, engineKeys);
  const exactChassis = objectValue(exactRaw, chassisKeys);
  if (!objectValue(next, engineKeys) && exactEngine) next.engineNo = exactEngine;
  if (!objectValue(next, chassisKeys) && exactChassis) next.vin = exactChassis;
  return next as StockVehicle;
}

export async function resolveDocumentV2Data(
  report: ReportHistoryItem | null,
  override: Record<string, string> = {}
): Promise<{ data: ResolvedDocumentV2Data; debug: DocumentV2ResolveDebug }> {
  const rawReport = ((report || {}) as Record<string, unknown>);
  const reportText = clean(rawReport.reportText);
  const plateFromReport = clean(rawReport.plate || rawReport.licensePlate || rawReport.plateNo);
  const normalizedReportPlate = normalizePlate(plateFromReport);
  const stock = await findStockByPlate(plateFromReport);
  const stockRaw = (stock || {}) as Record<string, unknown>;
  const stockPlate = clean(stockRaw.plate);
  const isSamePlate = normalizedReportPlate && normalizePlate(stockPlate) === normalizedReportPlate;

  const reportEngineNo = objectValue(rawReport, engineKeys) ||
    extractFromReportText(reportText, [/เลขเครื่อง(?:ยนต์)?\s*[:：]\s*([^\r\n]+)/i]);
  const reportChassisNo = objectValue(rawReport, chassisKeys) ||
    extractFromReportText(reportText, [/เลขตัวถัง\s*[:：]\s*([^\r\n]+)/i, /VIN\s*[:：]\s*([^\r\n]+)/i]);
  const stockEngineNo = objectValue(stockRaw, engineKeys);
  const stockChassisNo = objectValue(stockRaw, chassisKeys);

  const mapped = mapBookingToDocumentV2(report);
  const resolvedAddress =
    objectValue(rawReport, ["address", "customerAddress", "shippingAddress", "ที่อยู่", "ที่อยู่จัดส่งเอกสาร"]) ||
    mapped.customerAddress ||
    (isSamePlate ? objectValue(stockRaw, ["customerAddress", "address", "shippingAddress", "ที่อยู่", "ที่อยู่จัดส่งเอกสาร"]) : "");

  const data = {
    ...Object.fromEntries(Object.entries(rawReport).map(([k, v]) => [k, v == null ? "" : clean(v)])),
    ...Object.fromEntries(Object.entries(stockRaw).map(([k, v]) => [k, v == null ? "" : clean(v)])),
    ...mapped,
    plateNo: clean(rawReport.plate || rawReport.licensePlate || stockRaw.plate || mapped.plateNo),
    customerAddress: resolvedAddress,
    engineNo: reportEngineNo || (isSamePlate ? stockEngineNo : "") || mapped.engineNo,
    chassisNo: reportChassisNo || (isSamePlate ? stockChassisNo : "") || mapped.chassisNo,
    ...Object.fromEntries(Object.entries(override || {}).map(([k, v]) => [k, clean(v)]))
  } as ResolvedDocumentV2Data;

  return {
    data,
    debug: {
      plateFromReport,
      normalizedReportPlate,
      stockFound: Boolean(stock),
      stockPlate,
      stockKeys: Object.keys(stockRaw),
      stockEngineNo,
      stockChassisNo,
      reportEngineNo,
      reportChassisNo,
      resolvedEngineNo: data.engineNo,
      resolvedChassisNo: data.chassisNo,
      resolvedAddress: data.customerAddress
    }
  };
}
