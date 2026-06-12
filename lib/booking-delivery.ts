import { listReportHistory, lookupStockByPlate } from "@/lib/apps-script";
import { buildBookingDeliveryAlertSummary } from "@/lib/booking-delivery-alert";
import { mergeStockExtraFields } from "@/lib/stock-extra-fields";
import { getLastJsonStoreTiming, readJsonStore, writeJsonStore } from "@/lib/json-store";
import type { BookingDeliveryRecord, BookingDeliveryStatus, BookingReport, ReportHistoryItem } from "@/lib/types";

type BookingDeliveryStore = {
  records: BookingDeliveryRecord[];
};

type BookingDeliveryTiming = {
  provider: string;
  readMs: number;
  normalizeMs: number;
  count: number;
};

const storeFile = "booking-delivery.json";
let lastBookingDeliveryTiming: BookingDeliveryTiming = {
  provider: String(process.env.BIG_CAR_STORE_PROVIDER || "json").trim().toLowerCase(),
  readMs: 0,
  normalizeMs: 0,
  count: 0
};

function blankStore(): BookingDeliveryStore {
  return { records: [] };
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function boolValue(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = text(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "y";
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function normalizePlate(value: unknown) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function normalizeWorkflowStatus(status: unknown, workflowStatus: unknown = ""): BookingDeliveryStatus | "" {
  const workflow = text(workflowStatus);
  if (workflow === "ยอดจอง" || workflow === "รอผลไฟแนนซ์" || workflow === "รอส่งมอบ" || workflow === "ยอดส่งมอบ" || workflow === "ยกเลิก") {
    return workflow;
  }
  const legacy = text(status);
  if (legacy === "รอผลไฟแนนซ์" || legacy === "รอส่งมอบ" || legacy === "ยอดส่งมอบ" || legacy === "ยกเลิก") return legacy;
  return "";
}

function normalizeLifecycleStatus(status: unknown) {
  return text(status) === "ยกเลิก" ? "ยกเลิก" : "ยอดจอง";
}

function getDisplayStatus(record?: Partial<BookingDeliveryRecord> | null) {
  if (!record) return "";
  if (text(record.status) === "ยกเลิก") return "ยกเลิก";
  return normalizeWorkflowStatus(record.status, record.workflowStatus) || "ยอดจอง";
}

export function getLastBookingDeliveryTiming() {
  return { ...lastBookingDeliveryTiming };
}

export async function upsertBookingDeliveryRecordByPlate(input: BookingDeliveryRecord) {
  const store = await readStore();
  const normalizedPlate = normalizePlate(input.plate);
  if (!normalizedPlate) throw new Error("ไม่พบทะเบียนสำหรับบันทึก Booking Delivery");

  const index = store.records.findIndex(
    (record) =>
      normalizePlate(record.plate) === normalizedPlate ||
      record.id === input.id ||
      record.bookingId === input.bookingId
  );

  const existing = index >= 0 ? store.records[index] : null;
  const next: BookingDeliveryRecord = applyCommissionDefaults({
    ...existing,
    ...input,
    garageOutDate: text(input.garageOutDate || existing?.garageOutDate),
    garageReturnDate: text(input.garageReturnDate || existing?.garageReturnDate),
    spaFullSystemDone: typeof input.spaFullSystemDone === "boolean" ? input.spaFullSystemDone : boolValue(existing?.spaFullSystemDone),
    oilChangeDone: typeof input.oilChangeDone === "boolean" ? input.oilChangeDone : boolValue(existing?.oilChangeDone),
    decalRemovalDone: typeof input.decalRemovalDone === "boolean" ? input.decalRemovalDone : boolValue(existing?.decalRemovalDone),
    insuranceDone: typeof input.insuranceDone === "boolean" ? input.insuranceDone : boolValue(existing?.insuranceDone),
    id: existing?.id || input.id,
    bookingId: existing?.bookingId || input.bookingId,
    bookingReportId: existing?.bookingReportId || input.bookingReportId,
    salesReportId: existing?.salesReportId || input.salesReportId,
    statusSource: input.statusSource || existing?.statusSource || "auto",
    workflowStatus: normalizeWorkflowStatus(input.status || existing?.status, (input as BookingDeliveryRecord).workflowStatus || existing?.workflowStatus),
    financeCaseSubmitted: typeof input.financeCaseSubmitted === "boolean" ? input.financeCaseSubmitted : boolValue(existing?.financeCaseSubmitted),
    financeCaseSubmittedAt: text(input.financeCaseSubmittedAt || existing?.financeCaseSubmittedAt),
    financeCaseNote: text(input.financeCaseNote || existing?.financeCaseNote),
    financeAttachmentIds: Array.isArray(input.financeAttachmentIds) ? input.financeAttachmentIds.map((item) => text(item)).filter(Boolean) : stringArrayValue(existing?.financeAttachmentIds),
    createdAt: existing?.createdAt || input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || new Date().toISOString()
  }, existing || input);

  if (index >= 0) {
    store.records[index] = next;
  } else {
    store.records.unshift(next);
  }

  await writeStore(store);
  return next;
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

function normalizeCommissionGrade(value: unknown) {
  const normalized = text(value).toUpperCase();
  if (normalized === "G1" || normalized === "G2" || normalized === "G3") return normalized;
  return "";
}

function resolveOwnerForCommission(source: Partial<BookingDeliveryRecord> | Record<string, unknown> | null | undefined) {
  const raw = (source || {}) as Record<string, unknown>;
  return text(raw.salesOwner || raw.saleName || raw.teamName || "-") || "-";
}

function applyCommissionDefaults(
  record: Partial<BookingDeliveryRecord>,
  source?: Partial<BookingDeliveryRecord> | Record<string, unknown> | null
) {
  const sourceRecord = (source || {}) as Record<string, unknown>;
  return {
    ...record,
    ownerForCommission: text(record.ownerForCommission) || text(sourceRecord.saleName) || "-",
    commissionGrade: record.commissionGrade || normalizeCommissionGrade(sourceRecord.commissionGrade),
    countForCommission: typeof record.countForCommission === "boolean" ? record.countForCommission : true,
    commissionVersion: text(record.commissionVersion) || "2026",
    commissionNote: text(record.commissionNote || "")
  } as BookingDeliveryRecord;
}

function deriveStatus(report: ReportHistoryItem | null, sales: ReportHistoryItem | null, current?: BookingDeliveryRecord): BookingDeliveryStatus {
  if (current?.statusSource === "manual" && text(current.status) === "ยกเลิก") return "ยกเลิก";
  if (report?.status === "send_cancelled" || report?.status === "deleted") return "ยกเลิก";
  return normalizeLifecycleStatus(current?.status);
}

function deriveWorkflowStatus(report: ReportHistoryItem | null, sales: ReportHistoryItem | null, current?: BookingDeliveryRecord): BookingDeliveryStatus | "" {
  if (text(current?.status) === "ยกเลิก") return "ยกเลิก";
  const payment = extractLineValue(String(report?.reportText || sales?.reportText || ""), ["การชำระเงิน"]);
  const source = `${payment} ${report?.reportText || sales?.reportText || ""}`.toLowerCase();
  if (sales?.status === "closed" || sales?.status === "delivered") return "ยอดส่งมอบ";
  if (source.includes("finance") || source.includes("ไฟแนนซ์")) return "รอผลไฟแนนซ์";
  if (source.includes("cash") || source.includes("สด")) return "รอส่งมอบ";
  if (sales) return "รอส่งมอบ";
  return normalizeWorkflowStatus(current?.status, current?.workflowStatus);
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
  status: BookingDeliveryStatus | "",
  report?: ReportHistoryItem | null,
  sales?: ReportHistoryItem | null,
  current?: BookingDeliveryRecord | null
) {
  if (status === "ยกเลิก") return "รายการถูกยกเลิก";
  if (status === "ยอดส่งมอบ") return "ยอดส่งมอบครบแล้ว";
  if (status === "รอผลไฟแนนซ์") {
    const finance = text(current?.financeCaseNote || "");
    return finance ? `รอผลไฟแนนซ์ · ${finance}` : "รอผลไฟแนนซ์";
  }
  if (current) return buildBookingDeliveryAlertSummary({ ...current, status: status || "ยอดจอง" });
  const payment = extractLineValue(String(report?.reportText || ""), ["การชำระเงิน"]);
  if (payment.toLowerCase().includes("finance") || payment.includes("ไฟแนนซ์")) return "รอผลไฟแนนซ์";
  if (sales) return "มีรายงานขายแล้ว";
  return "ยอดจอง";
}

async function readStore(): Promise<BookingDeliveryStore> {
  const start = Date.now();
  const parsed = await readJsonStore<Partial<BookingDeliveryStore>>(storeFile, blankStore());
  const readTiming = getLastJsonStoreTiming();
  const normalizeStart = Date.now();
  const records = Array.isArray(parsed.records) ? parsed.records : [];
  const normalized = {
    records: records.map((record) => ({
      ...record,
      status:
        normalizeWorkflowStatus(record.status, (record as BookingDeliveryRecord).workflowStatus) === "ยอดส่งมอบ" &&
        text((record as BookingDeliveryRecord).deliveryCompletedDate || "")
          ? "ยอดส่งมอบ"
          : normalizeLifecycleStatus(record.status),
      workflowStatus: normalizeWorkflowStatus(record.status, (record as BookingDeliveryRecord).workflowStatus),
    garageOutDate: text((record as BookingDeliveryRecord).garageOutDate || ""),
    garageReturnDate: text((record as BookingDeliveryRecord).garageReturnDate || ""),
    spaFullSystemDone: boolValue((record as BookingDeliveryRecord).spaFullSystemDone),
    oilChangeDone: boolValue((record as BookingDeliveryRecord).oilChangeDone),
    decalRemovalDone: boolValue((record as BookingDeliveryRecord).decalRemovalDone),
      vehicleInspectionDone: boolValue((record as BookingDeliveryRecord).vehicleInspectionDone),
      insuranceDone: boolValue((record as BookingDeliveryRecord).insuranceDone),
      insuranceStatus: text((record as BookingDeliveryRecord).insuranceStatus || ""),
      deliveryCompletedDate: text((record as BookingDeliveryRecord).deliveryCompletedDate || ""),
      deliveryNote: text((record as BookingDeliveryRecord).deliveryNote || ""),
      ownerForCommission: text((record as BookingDeliveryRecord).ownerForCommission || (record as BookingDeliveryRecord).saleName || "-"),
      commissionGrade: normalizeCommissionGrade((record as BookingDeliveryRecord).commissionGrade || ""),
      countForCommission:
        typeof (record as BookingDeliveryRecord).countForCommission === "boolean"
          ? Boolean((record as BookingDeliveryRecord).countForCommission)
          : true,
      commissionVersion: text((record as BookingDeliveryRecord).commissionVersion || "2026"),
      commissionNote: text((record as BookingDeliveryRecord).commissionNote || ""),
    financeCaseSubmitted: boolValue((record as BookingDeliveryRecord).financeCaseSubmitted),
      financeCaseSubmittedAt: text((record as BookingDeliveryRecord).financeCaseSubmittedAt || ""),
      financeCaseNote: text((record as BookingDeliveryRecord).financeCaseNote || ""),
      financeAttachmentIds: stringArrayValue((record as BookingDeliveryRecord).financeAttachmentIds)
    })) as BookingDeliveryRecord[]
  };
  console.info("[booking-delivery-timing] normalize records", {
    ms: Date.now() - normalizeStart,
    count: normalized.records.length
  });
  lastBookingDeliveryTiming = {
    provider: readTiming.provider,
    readMs: readTiming.readMs,
    normalizeMs: Date.now() - normalizeStart,
    count: normalized.records.length
  };
  return normalized;
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
    color: stockPick(raw, ["color", "สี"]),
    commissionGrade: normalizeCommissionGrade(stockPick(raw, ["CAR GROUP", "carGroup", "car_group", "grade", "finalGrade"]))
  };
}

export async function syncBookingDeliveryFromReportHistory() {
  const reports = await listReportHistory("", "all");
  return upsertBookingDeliveryFromReportHistory(reports);
}

export async function upsertBookingDeliveryFromBookingReport(report: BookingReport) {
  const existingStore = await readStore();
  const normalizedPlate = normalizePlate(report.plate);
  const normalizedCustomer = text(report.customerName).toLowerCase();
  const duplicate = existingStore.records.find((record) => {
    if (record.status === "ยกเลิก") return false;
    return normalizePlate(record.plate) === normalizedPlate && text(record.customerName).toLowerCase() === normalizedCustomer;
  });
  if (duplicate) {
    throw new Error("ลูกค้าและทะเบียนนี้มีรายการจองอยู่แล้ว");
  }

  const reportHistoryItem: ReportHistoryItem = {
    id: report.id,
    type: "booking",
    createdAt: report.createdAt || new Date().toISOString(),
    updatedAt: report.updatedAt || report.createdAt || new Date().toISOString(),
    status: report.status === "send_cancelled" ? "send_cancelled" : "draft",
    customerName: report.customerName,
    address: report.address,
    phone: report.phone,
    idCard: report.idCard,
    plate: report.plate,
    brand: report.brand,
    model: report.model,
    year: report.year,
    color: report.color,
    saleName: report.saleName,
    teamName: report.teamName,
    emailSubject: report.emailSubject,
    emailTo: report.emailTo,
    emailCc: report.emailCc,
    emailStatus: "saved",
    lineStatus: "saved",
    ocrStatus: "saved",
    emailDraftId: "",
    driveFolderUrl: "",
    attachments: report.attachments || [],
    reportText: report.reportText
  };

  const existing = existingStore.records.find((record) => record.bookingReportId === report.id || normalizePlate(record.plate) === normalizedPlate) || null;
  const next = buildRecordFromReports(
    reportHistoryItem,
    null,
    existing || undefined,
    existing?.bookingId || nextBookingId([...(existing ? [existing] : [])], report.createdAt || new Date().toISOString())
  );
  if (!existing) {
    const payment = text(report.paymentType || "");
    if (payment.toLowerCase().includes("finance") || payment.includes("ไฟแนนซ์")) {
      next.workflowStatus = "รอผลไฟแนนซ์";
    } else if (payment.toLowerCase().includes("cash") || payment.includes("สด")) {
      next.workflowStatus = "รอส่งมอบ";
    } else {
      next.workflowStatus = "";
    }
    next.status = "ยอดจอง";
    next.alertSummary = buildBookingDeliveryAlertSummary({ ...next, status: getDisplayStatus(next) || "ยอดจอง" });
  }
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
    next.commissionGrade = next.commissionGrade || normalizeCommissionGrade(stockSnapshot.commissionGrade);
    next.ownerForCommission = next.ownerForCommission || resolveOwnerForCommission(next);
    next.countForCommission = typeof next.countForCommission === "boolean" ? next.countForCommission : true;
    next.commissionVersion = text(next.commissionVersion || "2026");
    next.commissionNote = text(next.commissionNote || "");
    next.summary = deriveSummary(getDisplayStatus(next) || "ยอดจอง", reportHistoryItem, null);
    next.alertSummary = deriveAlertSummary(getDisplayStatus(next), reportHistoryItem, null, next);
  }
  return upsertBookingDeliveryRecordByPlate(next);
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
  const workflowStatus = deriveWorkflowStatus(booking, sales, current);
  const summary = deriveSummary(workflowStatus || status, booking, sales, current);
  const alertSummary = deriveAlertSummary(workflowStatus || status, booking, sales, current);
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
    ownerForCommission: text((current as BookingDeliveryRecord | undefined)?.ownerForCommission || booking.saleName || sales?.saleName || booking.teamName || sales?.teamName || "-"),
    commissionGrade: normalizeCommissionGrade((current as BookingDeliveryRecord | undefined)?.commissionGrade || ""),
    countForCommission:
      typeof (current as BookingDeliveryRecord | undefined)?.countForCommission === "boolean"
        ? Boolean((current as BookingDeliveryRecord | undefined)?.countForCommission)
        : true,
    commissionVersion: text((current as BookingDeliveryRecord | undefined)?.commissionVersion || "2026"),
    commissionNote: text((current as BookingDeliveryRecord | undefined)?.commissionNote || ""),
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
    deliveryCompletedDate: text(current?.deliveryCompletedDate || ""),
    deliveryLocation: text(extractLineValue(String(sales?.reportText || ""), ["สาขา"]) || current?.deliveryLocation),
    garageOutDate: text(current?.garageOutDate || ""),
    garageReturnDate: text(current?.garageReturnDate || ""),
    spaFullSystemDone: boolValue(current?.spaFullSystemDone),
    oilChangeDone: boolValue(current?.oilChangeDone),
    decalRemovalDone: boolValue(current?.decalRemovalDone),
    vehicleInspectionDone: boolValue((current as BookingDeliveryRecord | undefined)?.vehicleInspectionDone),
    insuranceDone: boolValue(current?.insuranceDone),
    insuranceStatus: text((current as BookingDeliveryRecord | undefined)?.insuranceStatus || ""),
    deliveryNote: text((current as BookingDeliveryRecord | undefined)?.deliveryNote || ""),
    workflowStatus,
    financeCaseSubmitted: boolValue(current?.financeCaseSubmitted),
    financeCaseSubmittedAt: text(current?.financeCaseSubmittedAt || ""),
    financeCaseNote: text(current?.financeCaseNote || ""),
    financeAttachmentIds: stringArrayValue(current?.financeAttachmentIds),
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
      next.commissionGrade = next.commissionGrade || normalizeCommissionGrade(stockSnapshot.commissionGrade);
      next.ownerForCommission = next.ownerForCommission || resolveOwnerForCommission(next);
      next.countForCommission = typeof next.countForCommission === "boolean" ? next.countForCommission : true;
      next.commissionVersion = text(next.commissionVersion || "2026");
      next.commissionNote = text(next.commissionNote || "");
      next.summary = deriveSummary(getDisplayStatus(next) || "ยอดจอง", booking, salesReport);
      next.alertSummary = deriveAlertSummary(getDisplayStatus(next), booking, salesReport, next);
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
  workflowStatus?: BookingDeliveryStatus | "";
  deliveryDate?: string;
  deliveryCompletedDate?: string;
  deliveryLocation?: string;
  garageOutDate?: string;
  garageReturnDate?: string;
  spaFullSystemDone?: boolean;
  oilChangeDone?: boolean;
  decalRemovalDone?: boolean;
  vehicleInspectionDone?: boolean;
  insuranceDone?: boolean;
  insuranceStatus?: string;
  deliveryNote?: string;
  financeCaseSubmitted?: boolean;
  financeCaseSubmittedAt?: string;
  financeCaseNote?: string;
  financeAttachmentIds?: string[];
  alertSummary?: string;
  cancelReason?: string;
}) {
  const store = await readStore();
  const id = text(input.id);
  const index = store.records.findIndex((record) => record.id === id || record.bookingId === id);
  if (index < 0) throw new Error("ไม่พบ Booking Delivery");

  const current = store.records[index];
  const nextWorkflowStatus = normalizeWorkflowStatus(current.status, input.workflowStatus ?? current.workflowStatus);
  const nextStatus =
    input.status === "ยกเลิก"
      ? "ยกเลิก"
      : input.workflowStatus === "ยอดส่งมอบ" && text(input.deliveryCompletedDate ?? current.deliveryCompletedDate)
        ? "ยอดส่งมอบ"
        : normalizeLifecycleStatus(current.status);
  const next: BookingDeliveryRecord = {
    ...current,
    status: nextStatus,
    statusSource: "manual",
    workflowStatus: nextStatus === "ยกเลิก" ? "ยกเลิก" : nextWorkflowStatus,
    deliveryDate: text(input.deliveryDate ?? current.deliveryDate),
    deliveryCompletedDate: text(input.deliveryCompletedDate ?? current.deliveryCompletedDate),
    deliveryLocation: text(input.deliveryLocation ?? current.deliveryLocation),
    garageOutDate: text(input.garageOutDate ?? current.garageOutDate),
    garageReturnDate: text(input.garageReturnDate ?? current.garageReturnDate),
    spaFullSystemDone: typeof input.spaFullSystemDone === "boolean" ? input.spaFullSystemDone : boolValue(current.spaFullSystemDone),
    oilChangeDone: typeof input.oilChangeDone === "boolean" ? input.oilChangeDone : boolValue(current.oilChangeDone),
    decalRemovalDone: typeof input.decalRemovalDone === "boolean" ? input.decalRemovalDone : boolValue(current.decalRemovalDone),
    vehicleInspectionDone: typeof input.vehicleInspectionDone === "boolean" ? input.vehicleInspectionDone : boolValue((current as BookingDeliveryRecord).vehicleInspectionDone),
    insuranceDone: typeof input.insuranceDone === "boolean" ? input.insuranceDone : boolValue(current.insuranceDone),
    insuranceStatus: text(input.insuranceStatus ?? (current as BookingDeliveryRecord).insuranceStatus),
    deliveryNote: text(input.deliveryNote ?? (current as BookingDeliveryRecord).deliveryNote),
    financeCaseSubmitted: typeof input.financeCaseSubmitted === "boolean" ? input.financeCaseSubmitted : boolValue(current.financeCaseSubmitted),
    financeCaseSubmittedAt: text(input.financeCaseSubmittedAt ?? current.financeCaseSubmittedAt),
    financeCaseNote: text(input.financeCaseNote ?? current.financeCaseNote),
    financeAttachmentIds: Array.isArray(input.financeAttachmentIds)
      ? input.financeAttachmentIds.map((item) => text(item)).filter(Boolean)
      : stringArrayValue(current.financeAttachmentIds),
    countForCommission:
      input.status === "ยกเลิก"
        ? false
        : typeof (current as BookingDeliveryRecord).countForCommission === "boolean"
          ? Boolean((current as BookingDeliveryRecord).countForCommission)
          : true,
    alertSummary: text(input.alertSummary ?? ""),
    cancelReason: text(input.cancelReason ?? current.cancelReason),
    updatedAt: new Date().toISOString(),
    summary: deriveSummary(nextStatus === "ยกเลิก" ? "ยกเลิก" : nextWorkflowStatus || "ยอดจอง", null, null, current)
  };

  next.alertSummary = text(input.alertSummary ?? deriveAlertSummary(nextStatus === "ยกเลิก" ? "ยกเลิก" : next.workflowStatus || "ยอดจอง", null, null, next));

  if (input.status === "ยกเลิก" && !next.cancelReason) {
    next.cancelReason = "ผู้ใช้ยกเลิกรายการ";
  }

  store.records[index] = next;
  await writeStore(store);
  return next;
}

export async function cancelBookingDelivery(id: string, reason = "ผู้ใช้ยกเลิกรายการ") {
  return updateBookingDeliveryRecord({
    id,
    status: "ยกเลิก",
    workflowStatus: "ยกเลิก",
    cancelReason: reason,
    alertSummary: "ยกเลิกรายการ"
  });
}

export async function countBookingDeliveryRecords() {
  return (await readStore()).records.length;
}

export async function countBookingDeliveryByStatus(status: BookingDeliveryStatus) {
  return (await readStore()).records.filter((record) => record.status === status).length;
}
