import { listReportHistory, lookupStockByPlate } from "@/lib/apps-script";
import { mergeStockExtraFields } from "@/lib/stock-extra-fields";
import { readJsonStore, writeJsonStore } from "@/lib/json-store";
import type { BookingDeliveryRecord, BookingDeliveryStatus, ReportHistoryItem } from "@/lib/types";

type BookingDeliveryStore = {
  records: BookingDeliveryRecord[];
};

const storeFile = "booking-delivery.json";

function blankStore(): BookingDeliveryStore {
  return { records: [] };
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizePlate(value: unknown) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function moneyText(value: unknown) {
  const raw = text(value).replace(/,/g, "");
  if (!raw) return "";
  const numeric = Number(raw.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(numeric)) return text(value);
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(numeric);
}

function extractLineValue(textValue: string, labels: string[]) {
  const lines = String(textValue || "").split(/\r?\n/);
  for (const line of lines) {
    const compact = line.replace(/\*/g, "").trim();
    for (const label of labels) {
      if (compact.startsWith(label)) {
        return compact.slice(label.length).replace(/^[:：\s-]+/, "").trim();
      }
    }
  }
  return "";
}

function normalizeTeamId(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9ก-๙_-]/g, "");
}

function deriveStatus(report: ReportHistoryItem | null, sales: ReportHistoryItem | null, current?: BookingDeliveryRecord): BookingDeliveryStatus {
  if (current?.statusSource === "manual") return current.status;
  if (report?.status === "send_cancelled" || report?.status === "deleted") return "ยกเลิก";
  if (sales?.status === "closed" || sales?.status === "delivered") return "ส่งมอบแล้ว";
  if (sales) return "พร้อมส่งมอบ";
  return "ติดจองรอคอนเฟิร์ม";
}

function deriveSummary(
  status: BookingDeliveryStatus,
  report?: ReportHistoryItem | null,
  sales?: ReportHistoryItem | null,
  current?: BookingDeliveryRecord | null
) {
  const plate = text(report?.plate || sales?.plate || current?.plate);
  const customer = text(report?.customerName || sales?.customerName || current?.customerName);
  const model = [
    text(report?.brand || sales?.brand || current?.brand),
    text(report?.model || sales?.model || current?.model),
    text(report?.year || sales?.year || current?.year)
  ]
    .filter(Boolean)
    .join(" ");
  const parts = [plate, customer, model].filter(Boolean);
  return `${status}${parts.length ? ` · ${parts.join(" / ")}` : ""}`;
}

function deriveAlertSummary(
  status: BookingDeliveryStatus,
  report?: ReportHistoryItem | null,
  sales?: ReportHistoryItem | null,
  current?: BookingDeliveryRecord | null
) {
  if (status === "ยกเลิก") return "รายการถูกยกเลิก";
  if (status === "ส่งมอบแล้ว") return "ส่งมอบครบแล้ว";
  if (status === "พร้อมส่งมอบ") return "พร้อมส่งมอบ";
  const payment = extractLineValue(String(report?.reportText || current?.alertSummary || ""), ["การชำระเงิน"]);
  if (payment.toLowerCase().includes("finance") || payment.includes("ไฟแนนซ์")) return "ติดจองรอคอนเฟิร์มไฟแนนซ์";
  if (sales) return "มีรายงานขายแล้ว";
  return "ติดจองรอคอนเฟิร์ม";
}

async function readStore(): Promise<BookingDeliveryStore> {
  const parsed = await readJsonStore<Partial<BookingDeliveryStore>>(storeFile, blankStore());
  return { records: Array.isArray(parsed.records) ? parsed.records : [] };
}

async function writeStore(store: BookingDeliveryStore) {
  await writeJsonStore(storeFile, store);
}

function nextBookingId(records: BookingDeliveryRecord[], createdAt: string) {
  const stamp = (createdAt || new Date().toISOString()).slice(0, 7).replace("-", "");
  const prefix = `BK-${stamp}-`;
  const maxSequence = records
    .map((record) => {
      const match = String(record.bookingId || "").match(new RegExp(`^${prefix}(\\d{4})$`));
      return match ? Number(match[1]) : 0;
    })
    .reduce((max, value) => Math.max(max, value), 0);
  return `${prefix}${String(maxSequence + 1).padStart(4, "0")}`;
}

function stockPick(source: Record<string, unknown>, keys: string[]) {
  const extra = source.extraFields && typeof source.extraFields === "object" ? (source.extraFields as Record<string, unknown>) : {};
  for (const key of keys) {
    const value = source[key] ?? extra[key];
    if (value !== undefined && value !== null && text(value)) return text(value);
  }
  return "";
}

async function resolveStockSnapshot(plate: string) {
  const normalized = normalizePlate(plate);
  if (!normalized) return null;
  const stock = await lookupStockByPlate(plate).catch(() => null);
  if (!stock) return null;
  const [merged] = await mergeStockExtraFields([stock]);
  const raw = (merged || stock) as Record<string, unknown>;
  return {
    engineNo: stockPick(raw, ["engineNo", "engineNumber", "engine", "เลขเครื่อง", "เลขเครื่องยนต์", "MotorNo", "Motor No"]),
    chassisNo: stockPick(raw, ["vin", "chassisNo", "chassisNumber", "เลขตัวถัง", "เลขตัวรถ", "VIN", "Chassis"]),
    deliveryLocation: stockPick(raw, ["parkingLocation", "ParkingLocation", "location", "สถานที่จอด", "สถานที่ส่งมอบ"]),
    source: stockPick(raw, ["source", "แหล่งที่มา"]),
    ownership: stockPick(raw, ["ownership", "กรรมสิทธิ์"]),
    project: stockPick(raw, ["project", "PROJECT"]),
    campaign: stockPick(raw, ["campaign", "CAMPAIGN"]),
    salePrice: stockPick(raw, ["salePrice", "price", "ราคาเสนอขายRT", "ราคาตั้งขาย"]),
    model: stockPick(raw, ["model", "รุ่นรถยนต์", "รุ่น"]),
    brand: stockPick(raw, ["brand", "ยี่ห้อ", "ยี่ห้อรถ"]),
    year: stockPick(raw, ["year", "ปีจด", "ปีรถ"]),
    color: stockPick(raw, ["color", "สี"])
  };
}

export async function syncBookingDeliveryFromReportHistory() {
  const reports = await listReportHistory("", "all");
  return upsertBookingDeliveryFromReportHistory(reports);
}

function buildRecordFromReports(
  booking: ReportHistoryItem,
  sales: ReportHistoryItem | null,
  current?: BookingDeliveryRecord,
  bookingId?: string
): BookingDeliveryRecord {
  const now = new Date().toISOString();
  const resolvedBookingId = current?.bookingId || bookingId || nextBookingId([...(current ? [current] : [])], booking.createdAt || now);
  const paymentText = extractLineValue(String(booking.reportText || sales?.reportText || ""), ["การชำระเงิน"]);
  const status = deriveStatus(booking, sales, current);
  const summary = deriveSummary(status, booking, sales, current);
  const alertSummary = deriveAlertSummary(status, booking, sales, current);
  const teamId = normalizeTeamId(text(booking.teamName || sales?.teamName || booking.saleName || sales?.saleName));
  return {
    id: current?.id || booking.id,
    bookingId: resolvedBookingId,
    bookingReportId: booking.id,
    salesReportId: sales?.id || current?.salesReportId || "",
    plate: text(booking.plate || sales?.plate),
    customerName: text(booking.customerName || sales?.customerName),
    brand: text(booking.brand || sales?.brand),
    model: text(booking.model || sales?.model),
    year: text(booking.year || sales?.year),
    color: text(booking.color || sales?.color),
    engineNo: text(booking.engineNo || sales?.engineNo || current?.engineNo),
    chassisNo: text(booking.chassisNo || sales?.chassisNo || current?.chassisNo),
    saleName: text(booking.saleName || sales?.saleName),
    teamName: text(booking.teamName || sales?.teamName),
    teamId,
    source: text(
      extractLineValue(String(booking.reportText || sales?.reportText || ""), ["แหล่งที่มา"]) || current?.source
    ),
    ownership: text(
      extractLineValue(String(booking.reportText || sales?.reportText || ""), ["กรรมสิทธิ์"]) || current?.ownership
    ),
    project: text(
      extractLineValue(String(booking.reportText || sales?.reportText || ""), ["Project", "project"]) || current?.project
    ),
    campaign: text(
      extractLineValue(String(booking.reportText || sales?.reportText || ""), ["Campaign", "campaign"]) || current?.campaign
    ),
    bookingPrice: moneyText(extractLineValue(String(booking.reportText || ""), ["จองรถยนต์"])),
    salePrice: moneyText(
      extractLineValue(String(sales?.reportText || booking.reportText || ""), ["ราคาที่ตั้งขาย", "ราคาตั้งขาย", "ราคาขาย"]) ||
        current?.salePrice
    ),
    finalPrice: moneyText(extractLineValue(String(sales?.reportText || booking.reportText || ""), ["ราคาที่ขาย"]) || current?.finalPrice),
    centralDiscount: moneyText(
      extractLineValue(String(sales?.reportText || booking.reportText || ""), ["ส่วนลดส่วนกลาง", "ส่วนลด"]) || current?.centralDiscount
    ),
    bookingDeduction: moneyText(
      extractLineValue(String(sales?.reportText || booking.reportText || ""), ["หักเงินจอง"]) ||
        extractLineValue(String(booking.reportText || ""), ["จองรถยนต์"]) ||
        current?.bookingDeduction
    ),
    downPayment: moneyText(extractLineValue(String(sales?.reportText || ""), ["เงินดาวน์"]) || current?.downPayment),
    netPayment: moneyText(extractLineValue(String(sales?.reportText || ""), ["จ่ายสุทธิ"]) || current?.netPayment),
    paymentType: text(extractLineValue(String(booking.reportText || sales?.reportText || ""), ["การชำระเงิน"]) || paymentText),
    deliveryDate: text(extractLineValue(String(sales?.reportText || ""), ["วันรับรถ"]) || current?.deliveryDate),
    deliveryLocation: text(extractLineValue(String(sales?.reportText || ""), ["สาขา"]) || current?.deliveryLocation),
    status,
    statusSource: current?.statusSource || "auto",
    summary,
    alertSummary,
    cancelReason: text(current?.cancelReason || ""),
    createdAt: current?.createdAt || booking.createdAt || now,
    updatedAt: now
  };
}

export async function listBookingDeliveryRecords() {
  return (await readStore()).records;
}

export async function getBookingDeliveryRecord(id: string) {
  const safeId = text(id);
  return (await readStore()).records.find((record) => record.id === safeId || record.bookingId === safeId) || null;
}

export async function upsertBookingDeliveryFromReportHistory(reports: ReportHistoryItem[]) {
  const store = await readStore();
  const activeReports = reports.filter((report) => report.status !== "deleted");
  const bookings = activeReports.filter((report) => report.type === "booking");
  const sales = activeReports.filter((report) => report.type === "sales");
  const workingRecords = [...store.records];
  const salesByPlate = new Map<string, ReportHistoryItem>();

  for (const sale of sales) {
    const key = normalizePlate(sale.plate);
    if (!key) continue;
    const current = salesByPlate.get(key);
    if (!current || String(sale.createdAt).localeCompare(String(current.createdAt)) > 0) {
      salesByPlate.set(key, sale);
    }
  }

  for (const booking of bookings) {
    const key = normalizePlate(booking.plate);
    const salesReport = salesByPlate.get(key) || null;
    const existing = workingRecords.find((record) => record.bookingReportId === booking.id || normalizePlate(record.plate) === key) || null;
    const next = buildRecordFromReports(
      booking,
      salesReport,
      existing || undefined,
      existing?.bookingId || nextBookingId(workingRecords, booking.createdAt || new Date().toISOString())
    );
    const stockSnapshot = await resolveStockSnapshot(next.plate);
    if (stockSnapshot) {
      next.engineNo = next.engineNo || stockSnapshot.engineNo;
      next.chassisNo = next.chassisNo || stockSnapshot.chassisNo;
      next.deliveryLocation = next.deliveryLocation || stockSnapshot.deliveryLocation;
      next.source = next.source || stockSnapshot.source;
      next.ownership = next.ownership || stockSnapshot.ownership;
      next.project = next.project || stockSnapshot.project;
      next.campaign = next.campaign || stockSnapshot.campaign;
      next.salePrice = next.salePrice || stockSnapshot.salePrice;
      next.model = next.model || stockSnapshot.model;
      next.brand = next.brand || stockSnapshot.brand;
      next.year = next.year || stockSnapshot.year;
      next.color = next.color || stockSnapshot.color;
      next.summary = deriveSummary(next.status, booking, salesReport);
      next.alertSummary = deriveAlertSummary(next.status, booking, salesReport);
    }
    const index = workingRecords.findIndex((record) => record.id === next.id || record.bookingId === next.bookingId);
    if (index >= 0) workingRecords[index] = next;
    else workingRecords.push(next);
  }

  store.records = workingRecords;
  await writeStore(store);
  return store.records;
}

export async function updateBookingDeliveryRecord(input: {
  id: string;
  status?: BookingDeliveryStatus;
  deliveryDate?: string;
  deliveryLocation?: string;
  alertSummary?: string;
  cancelReason?: string;
}) {
  const store = await readStore();
  const id = text(input.id);
  const index = store.records.findIndex((record) => record.id === id || record.bookingId === id);
  if (index < 0) throw new Error("ไม่พบ Booking Delivery");

  const current = store.records[index];
  const next: BookingDeliveryRecord = {
    ...current,
    status: input.status || current.status,
    statusSource: "manual",
    deliveryDate: text(input.deliveryDate ?? current.deliveryDate),
    deliveryLocation: text(input.deliveryLocation ?? current.deliveryLocation),
    alertSummary: text(input.alertSummary ?? current.alertSummary),
    cancelReason: text(input.cancelReason ?? current.cancelReason),
    updatedAt: new Date().toISOString(),
    summary: deriveSummary(input.status || current.status, null, null, current)
  };

  if (input.status === "ยกเลิก" && !next.cancelReason) {
    next.cancelReason = "ผู้ใช้ยกเลิกรายการ";
  }

  store.records[index] = next;
  await writeStore(store);
  return next;
}

export async function cancelBookingDelivery(id: string, reason = "ผู้ใช้ยกเลิกรายการ") {
  return updateBookingDeliveryRecord({ id, status: "ยกเลิก", cancelReason: reason, alertSummary: "ยกเลิกรายการ" });
}

export async function countBookingDeliveryRecords() {
  return (await readStore()).records.length;
}

export async function countBookingDeliveryByStatus(status: BookingDeliveryStatus) {
  return (await readStore()).records.filter((record) => record.status === status).length;
}
