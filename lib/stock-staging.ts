import { createHash } from "crypto";
import * as XLSX from "xlsx";
import { importStock, listStockVehicles } from "@/lib/apps-script";
import { readJsonStore, writeJsonStore } from "@/lib/json-store";
import { saveStockExtraFields } from "@/lib/stock-extra-fields";
import { sanitizeStockText, sanitizeStockVehicleTextFields } from "@/lib/stock-text-sanitizer";
import type { StockVehicle } from "@/lib/types";

export type StockStagingStatus = "Pending" | "Confirmed" | "Rejected" | "Duplicate" | "Ignored" | "Excluded";

export type StockStagingItem = {
  id: string;
  status: StockStagingStatus;
  source: "gmail" | "manual";
  fileName: string;
  subject: string;
  sender: string;
  emailTime: string;
  fileDate: string;
  checksum: string;
  rows: StockVehicle[];
  previewRows: StockVehicle[];
  totalCars: number;
  columnCount: number;
  hiddenColumnCount: number;
  hiddenColumns: string[];
  validation: StockValidationResult;
  diff?: StockDiffResult;
  excludedReason?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  rejectedAt?: string;
};

export type StockValidationResult = {
  ok: boolean;
  warnings: string[];
  errors: string[];
  plateRows: number;
  modelRows: number;
  importantColumns: string[];
  missingColumns: string[];
};

export type StockDiffResult = {
  currentTotal: number;
  nextTotal: number;
  added: number;
  missing: number;
  priceChanged: number;
  suspicious: boolean;
  warnings: string[];
};

export type StockStagingStore = {
  updatedAt: string;
  latestConfirmedId: string;
  items: StockStagingItem[];
};

const storeName = "stock-import-staging.json";
const maxItems = 40;
const defaultHeaderRow = 5;
const vinFallbackColumnIndex = 20;
const engineNoFallbackColumnIndex = 21;
const allowedSender = "sirinada.p@tgh.co.th";
const subjectKeywords = ["pricing", "pricig", "status update", "new format"];
const blacklistKeywords = ["rt price delay 7 days", "price delay 7 days", "delay 7 days", "rt price delay"];

const aliases: Record<keyof StockVehicle, string[]> = {
  plate: ["ทะเบียน", "ทะเบียนรถ", "plate", "licenseplate", "regno", "เลขทะเบียน"],
  brand: ["ยี่ห้อรถ", "ยี่ห้อ", "brand", "make"],
  model: ["รุ่นรถ", "รุ่นรถยนต์", "รุ่น", "model"],
  year: ["ปีรถ", "ปีจด", "ปี", "year", "modelyear", "ปีจดทะเบียน"],
  color: ["สีรถ", "สี", "color", "colour"],
  salePrice: ["ราคาตั้งขาย", "ราคาเสนอขายrt", "ราคาเสนอขาย", "ราคา", "price", "saleprice", "sellingprice"],
  source: ["แหล่งที่มา", "source"],
  ownership: ["กรรมสิทธิ์", "ownership"],
  reportReturnDate: ["วันที่รับรายงานคืน", "reportreturndate", "returnedreportdate"],
  agingGroup: ["กลุ่มaging", "กลุ่ม aging", "aginggroup"],
  aging: ["aging"],
  customerName: ["ชื่อลูกค้า", "customername", "customer"],
  project: ["project", "โปรเจกต์"],
  campaign: ["campaign", "แคมเปญ"],
  colorGroup: ["กลุ่มสี", "colorgroup"],
  closedSales: ["closed sales", "closedsales"],
  inspection: ["inspection"],
  extendedWarranty: ["extended warranty", "extendedwarranty", "warranty"],
  sellerName: ["ชื่อผู้ขาย", "salename", "salesname", "sellername"],
  bookingSaleDate: ["วันที่จอง/ขาย", "วันที่จอง", "วันที่ขาย", "bookingsaledate", "bookingdate", "solddate"],
  pdiStatus: ["สถานะปรับสภาพ pdi", "pdistatus", "สถานะ pdi"],
  engineNo: ["เลขเครื่อง", "เลขเครื่องยนต์", "engine", "engine no", "engine no.", "engine number", "engineno", "enginenumber", "motor no", "motorno"],
  financeName: ["ไฟแนนซ์", "บริษัทไฟแนนซ์", "finance", "financename"],
  vin: ["เลขตัวรถ", "เลขตัวถัง", "vin", "chassis"],
  finalGrade: ["เกรด final", "เกรดfinal", "finalgrade", "grade"],
  program: ["program"],
  parkingLocation: ["location", "สถานที่จอด", "โลเคชั่น", "parking"],
  status: ["สถานะ", "status"],
  gear: ["เกียร์", "gear", "transmission"],
  mileage: ["เลขไมล์", "ไมล์", "mileage", "odo", "odometer"],
  pdiNote: ["หมายเหตุ pdi", "หมายเหตุpdi", "pdi", "pdinote", "หมายเหตุ"],
  vehicleGroup: ["กลุ่มรถยนต์", "กลุ่มรถ", "กลุ่ม", "ประเภทรถ", "ประเภท", "vehiclegroup", "cartype", "segment"],
  extraFields: []
};

function emptyStore(): StockStagingStore {
  return { updatedAt: "", latestConfirmedId: "", items: [] };
}

function normalize(value: string) {
  return String(value || "").toLowerCase().replace(/\s+/g, "").replace(/[()/_\-.]/g, "");
}

function text(value: unknown) {
  return sanitizeStockText(value);
}

function money(value: unknown) {
  return text(value).replace(/[^\d.]/g, "");
}

function yearOnly(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return String(value.getFullYear());
  }

  if (typeof value === "number" && value > 25000 && value < 60000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y) return String(parsed.y);
  }

  const raw = text(value);
  if (!raw) return "";

  const match = raw.match(/\b(19|20|25)\d{2}\b/);
  if (match) {
    const y = Number(match[0]);
    if (y >= 2400) return String(y - 543);
    return String(y);
  }

  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 25000 && numeric < 60000) {
    const parsed = XLSX.SSF.parse_date_code(numeric);
    if (parsed?.y) return String(parsed.y);
  }

  const shortDateMatch = raw.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-](\d{2})\b/);
  if (shortDateMatch) {
    const yy = Number(shortDateMatch[1]);
    return String(yy >= 40 ? 2500 + yy - 543 : 2000 + yy);
  }

  const digits = raw.replace(/[^\d]/g, "");
  if (/^\d{2}$/.test(digits)) {
    const yy = Number(digits);
    return String(yy >= 40 ? 2500 + yy - 543 : 2000 + yy);
  }

  return "";
}

function sheetCell(sheet: XLSX.WorkSheet, columnIndex: number, rowNumber: number) {
  return text(sheet[XLSX.utils.encode_cell({ c: columnIndex, r: rowNumber })]?.v);
}

function normalizePlate(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function headerMatch(headers: string[], key: keyof StockVehicle) {
  const fieldAliases = aliases[key] || [];
  return headers.find((header) => fieldAliases.some((alias) => normalize(header) === normalize(alias))) || "";
}

function parseFileDate(fileName: string, subject: string, fallback: string) {
  const raw = `${fileName} ${subject}`;
  const match = raw.match(/(\d{1,2})[-_/](\d{1,2})[-_/](\d{2,4})/);
  if (!match) return fallback.slice(0, 10);
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${month}-${day}`;
}

function checksum(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function findBlacklist(value: string) {
  const lower = value.toLowerCase();
  return blacklistKeywords.find((keyword) => lower.includes(keyword)) || "";
}

function subjectAllowed(subject: string) {
  const lower = subject.toLowerCase();
  return subjectKeywords.some((keyword) => lower.includes(keyword));
}

function senderAllowed(sender: string) {
  return sender.toLowerCase().includes(allowedSender);
}

function detectHiddenColumns(sheet: XLSX.WorkSheet | undefined, headerRow: number) {
  if (!sheet) return [];
  const range = XLSX.utils.decode_range(String(sheet["!ref"] || "A1:A1"));
  const cols = sheet["!cols"] || [];
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const meta = cols[c] as XLSX.ColInfo | undefined;
    if (!meta?.hidden) continue;
    const header = text(sheet[XLSX.utils.encode_cell({ c, r: Math.max(headerRow - 1, 0) })]?.v) || XLSX.utils.encode_col(c);
    headers.push(header);
  }
  return headers;
}

export function parseStockWorkbook(bytes: Buffer) {
  const workbook = XLSX.read(bytes, { type: "buffer", cellDates: false, cellStyles: true });
  let best: { rows: StockVehicle[]; headers: string[]; hiddenColumns: string[] } = { rows: [], headers: [], hiddenColumns: [] };

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    for (let offset = 0; offset < 8; offset += 1) {
      const headerRow = defaultHeaderRow + offset;
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", range: Math.max(headerRow - 1, 0) });
      if (!rawRows.length) continue;
      const headers = Object.keys(rawRows[0] || {});
      const mapping = Object.fromEntries((Object.keys(aliases) as Array<keyof StockVehicle>).map((key) => [key, headerMatch(headers, key)])) as Record<keyof StockVehicle, string>;
      if (!mapping.plate) continue;

      const mappedRows = rawRows
        .map((row) => {
          const rowNumber = typeof row.__rowNum__ === "number" ? row.__rowNum__ : 0;
          return sanitizeStockVehicleTextFields({
            plate: text(row[mapping.plate]),
            brand: text(row[mapping.brand]),
            model: text(row[mapping.model]),
            year: yearOnly(row[mapping.year]),
            color: text(row[mapping.color]),
            salePrice: money(row[mapping.salePrice]),
            source: text(row[mapping.source]),
            ownership: text(row[mapping.ownership]),
            reportReturnDate: text(row[mapping.reportReturnDate]),
            agingGroup: text(row[mapping.agingGroup]),
            aging: text(row[mapping.aging]),
            customerName: text(row[mapping.customerName]),
            project: text(row[mapping.project]),
            campaign: text(row[mapping.campaign]),
            colorGroup: text(row[mapping.colorGroup]),
            closedSales: text(row[mapping.closedSales]),
            inspection: text(row[mapping.inspection]),
            extendedWarranty: text(row[mapping.extendedWarranty]),
            sellerName: text(row[mapping.sellerName]),
            bookingSaleDate: text(row[mapping.bookingSaleDate]),
            vin: text(row[mapping.vin]) || sheetCell(sheet, vinFallbackColumnIndex, rowNumber),
            engineNo: text(row[mapping.engineNo]) || sheetCell(sheet, engineNoFallbackColumnIndex, rowNumber),
            financeName: text(row[mapping.financeName]),
            finalGrade: text(row[mapping.finalGrade]),
            program: text(row[mapping.program]),
            parkingLocation: text(row[mapping.parkingLocation]),
            status: text(row[mapping.status]),
            gear: text(row[mapping.gear]),
            mileage: money(row[mapping.mileage]),
            pdiStatus: text(row[mapping.pdiStatus]),
            pdiNote: text(row[mapping.pdiNote]),
            vehicleGroup: text(row[mapping.vehicleGroup]),
            extraFields: {}
          });
        })
        .filter((row) => row.plate);

      if (mappedRows.length > best.rows.length) {
        best = { rows: mappedRows, headers, hiddenColumns: detectHiddenColumns(sheet, headerRow) };
      }
    }
  }

  return best;
}

function validateRows(rows: StockVehicle[], headers: string[]): StockValidationResult {
  const important = ["ทะเบียน", "รุ่นรถยนต์", "ราคาเสนอขายRT"];
  const normalizedHeaders = new Set(headers.map(normalize));
  const missingColumns = important.filter((item) => !normalizedHeaders.has(normalize(item)));
  const plateRows = rows.filter((row) => row.plate).length;
  const modelRows = rows.filter((row) => row.model).length;
  const errors = [];
  const warnings = [];

  if (!plateRows) errors.push("ไม่พบคอลัมน์/ข้อมูลทะเบียน");
  if (!modelRows) warnings.push("รุ่นรถว่างหลายรายการ");
  if (rows.length < 20) warnings.push("จำนวนรถน้อยผิดปกติ กรุณาตรวจไฟล์ก่อน Confirm");
  if (missingColumns.length) warnings.push(`คอลัมน์สำคัญอาจไม่ครบ: ${missingColumns.join(", ")}`);

  return { ok: !errors.length, warnings, errors, plateRows, modelRows, importantColumns: important, missingColumns };
}

async function calculateDiff(rows: StockVehicle[]): Promise<StockDiffResult> {
  const current = await listStockVehicles({ query: "", limit: 1000 }).catch(() => ({ vehicles: [], total: 0 }));
  const currentByPlate = new Map((current.vehicles || []).map((vehicle) => [normalizePlate(vehicle.plate), vehicle]));
  const nextByPlate = new Map(rows.map((vehicle) => [normalizePlate(vehicle.plate), vehicle]));
  let added = 0;
  let missing = 0;
  let priceChanged = 0;

  for (const [plate, vehicle] of nextByPlate) {
    const currentVehicle = currentByPlate.get(plate);
    if (!currentVehicle) added += 1;
    else if (money(currentVehicle.salePrice) !== money(vehicle.salePrice)) priceChanged += 1;
  }
  for (const plate of currentByPlate.keys()) {
    if (!nextByPlate.has(plate)) missing += 1;
  }

  const warnings = [];
  const currentTotal = currentByPlate.size;
  const nextTotal = nextByPlate.size;
  if (currentTotal && nextTotal < currentTotal * 0.75) warnings.push("จำนวนรถลดลงมากกว่า 25%");
  if (missing > 50) warnings.push(`มีรถหายจากไฟล์ใหม่ ${missing.toLocaleString("th-TH")} คัน`);
  return { currentTotal, nextTotal, added, missing, priceChanged, suspicious: warnings.length > 0, warnings };
}

export async function readStockStagingStore() {
  return readJsonStore<StockStagingStore>(storeName, emptyStore());
}

async function writeStore(store: StockStagingStore) {
  store.updatedAt = new Date().toISOString();
  store.items = store.items.slice(0, maxItems);
  await writeJsonStore(storeName, store);
}

export async function createStockStagingItem(input: {
  bytes: Buffer;
  fileName: string;
  subject?: string;
  sender?: string;
  emailTime?: string;
  source: "gmail" | "manual";
}) {
  const fileName = text(input.fileName);
  const subject = text(input.subject || fileName);
  const sender = text(input.sender || (input.source === "manual" ? "Manual Upload" : ""));
  const emailTime = input.emailTime || new Date().toISOString();
  const hash = checksum(input.bytes);
  const store = await readStockStagingStore();
  const blacklist = findBlacklist(`${subject} ${fileName}`);
  const parsed = parseStockWorkbook(input.bytes);
  const validation = validateRows(parsed.rows, parsed.headers);
  const duplicate = store.items.find((item) => item.checksum === hash);
  const excluded = Boolean(blacklist) || (input.source === "gmail" && (!senderAllowed(sender) || !subjectAllowed(subject)));
  const status: StockStagingStatus = excluded ? "Excluded" : duplicate ? "Duplicate" : validation.ok ? "Pending" : "Ignored";
  const diff = parsed.rows.length ? await calculateDiff(parsed.rows) : undefined;
  const item: StockStagingItem = {
    id: `STG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status,
    source: input.source,
    fileName,
    subject,
    sender,
    emailTime,
    fileDate: parseFileDate(fileName, subject, emailTime),
    checksum: hash,
    rows: parsed.rows,
    previewRows: parsed.rows.slice(0, 12),
    totalCars: parsed.rows.length,
    columnCount: parsed.headers.length,
    hiddenColumnCount: parsed.hiddenColumns.length,
    hiddenColumns: parsed.hiddenColumns,
    validation,
    diff,
    excludedReason: blacklist ? `Matched blacklist keyword "${blacklist}"` : excluded ? "Sender/subject not allowed" : duplicate ? `Duplicate of ${duplicate.fileName}` : ""
  };

  store.items.unshift(item);
  await writeStore(store);
  return item;
}

export async function listStockStagingItems() {
  const store = await readStockStagingStore();
  return {
    latestConfirmed: store.items.find((item) => item.id === store.latestConfirmedId) || null,
    items: store.items.map((item) => ({ ...item, rows: [], previewRows: item.previewRows }))
  };
}

export async function confirmStockStagingItem(id: string, confirmedBy = "CRM User") {
  const store = await readStockStagingStore();
  const item = store.items.find((entry) => entry.id === id);
  if (!item) throw new Error("ไม่พบไฟล์ staging");
  if (item.status === "Excluded" || item.status === "Ignored") throw new Error("ไฟล์นี้ไม่ผ่าน validation จึง Confirm ไม่ได้");
  if (item.status === "Confirmed") throw new Error("ไฟล์นี้ Confirm ไปแล้ว");
  if (!item.validation.ok) throw new Error(item.validation.errors.join(", ") || "ไฟล์ไม่ผ่าน validation");

  const result = await importStock({ rows: item.rows, sourceName: item.fileName, clearExisting: true });
  await saveStockExtraFields(item.rows, { clearExisting: true });
  item.status = "Confirmed";
  item.confirmedAt = new Date().toISOString();
  item.confirmedBy = confirmedBy;
  store.latestConfirmedId = item.id;
  await writeStore(store);
  return { item: { ...item, rows: [], previewRows: item.previewRows }, result };
}

export async function rejectStockStagingItem(id: string) {
  const store = await readStockStagingStore();
  const item = store.items.find((entry) => entry.id === id);
  if (!item) throw new Error("ไม่พบไฟล์ staging");
  if (item.status === "Confirmed") throw new Error("ไฟล์ Confirm แล้ว Reject ไม่ได้");
  item.status = "Rejected";
  item.rejectedAt = new Date().toISOString();
  await writeStore(store);
  return { item: { ...item, rows: [], previewRows: item.previewRows } };
}
