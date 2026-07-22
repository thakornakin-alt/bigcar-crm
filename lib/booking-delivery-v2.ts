import type { BookingDeliveryRecord, BookingDeliveryStatus } from "./types";

export type BookingDeliveryDateFilter = "selected_month" | "unknown" | "all_related";
export type BookingDeliveryCountFilter = "all" | "counted" | "not_counted";

export type BookingDeliveryV2Filters = {
  query?: string;
  status?: "all" | BookingDeliveryStatus;
  saleName?: string;
  count?: BookingDeliveryCountFilter;
  date?: BookingDeliveryDateFilter;
};

export type MonthlySummary = {
  carryIn: number;
  newBookings: number;
  totalTracking: number;
  delivered: number;
  cancelled: number;
  carryOut: number;
  unknownDate: number;
};

export type MonthRange = {
  year: number;
  month: number;
  monthStart: number;
  nextMonthStart: number;
  key: string;
};

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function bangkokEpoch(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  const normalizedYear = year > 2400 ? year - 543 : year;
  if (normalizedYear < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const utc = Date.UTC(normalizedYear, month - 1, day, hour, minute, second) - BANGKOK_OFFSET_MS;
  const check = new Date(utc + BANGKOK_OFFSET_MS);
  if (
    check.getUTCFullYear() !== normalizedYear ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute ||
    check.getUTCSeconds() !== second
  ) return null;
  return utc;
}

export function parseBusinessDate(value: unknown) {
  const raw = text(value);
  if (!raw) return null;

  const isoDateTime = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (isoDateTime) {
    return bangkokEpoch(
      Number(isoDateTime[1]), Number(isoDateTime[2]), Number(isoDateTime[3]),
      Number(isoDateTime[4]), Number(isoDateTime[5]), Number(isoDateTime[6] || 0)
    );
  }

  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) return bangkokEpoch(Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3]));

  const thaiDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (thaiDate) return bangkokEpoch(Number(thaiDate[3]), Number(thaiDate[2]), Number(thaiDate[1]));

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function getBangkokMonthRange(year: number, month: number): MonthRange {
  const safeMonth = Math.min(12, Math.max(1, Math.trunc(month)));
  const safeYear = Math.trunc(year);
  const monthStart = bangkokEpoch(safeYear, safeMonth, 1);
  const nextYear = safeMonth === 12 ? safeYear + 1 : safeYear;
  const nextMonth = safeMonth === 12 ? 1 : safeMonth + 1;
  const nextMonthStart = bangkokEpoch(nextYear, nextMonth, 1);
  if (monthStart === null || nextMonthStart === null) throw new Error("Invalid month range");
  return {
    year: safeYear,
    month: safeMonth,
    monthStart,
    nextMonthStart,
    key: `${safeYear}-${String(safeMonth).padStart(2, "0")}`
  };
}

export function currentBangkokMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month) };
}

export function getBookingDisplayStatus(record: BookingDeliveryRecord): BookingDeliveryStatus {
  if (record.status === "ยกเลิก") return "ยกเลิก";
  return record.workflowStatus || "ยอดจอง";
}

export function isCountedRecord(record: BookingDeliveryRecord) {
  return record.isCounted !== false;
}

export function hasUnknownBookingDate(record: BookingDeliveryRecord) {
  return parseBusinessDate(record.bookingDate) === null;
}

export function hasUnknownHistory(record: BookingDeliveryRecord) {
  const status = getBookingDisplayStatus(record);
  return (status === "ยอดส่งมอบ" && parseBusinessDate(record.deliveredAt) === null) ||
    (status === "ยกเลิก" && parseBusinessDate(record.cancelledAt) === null);
}

function before(value: number | null, boundary: number) {
  return value !== null && value < boundary;
}

function within(value: number | null, range: MonthRange) {
  return value !== null && value >= range.monthStart && value < range.nextMonthStart;
}

function isOpenAt(record: BookingDeliveryRecord, boundary: number) {
  const deliveredAt = parseBusinessDate(record.deliveredAt);
  const cancelledAt = parseBusinessDate(record.cancelledAt);
  return !before(deliveredAt, boundary) && !before(cancelledAt, boundary);
}

function isActiveLegacy(record: BookingDeliveryRecord) {
  const status = getBookingDisplayStatus(record);
  return status !== "ยอดส่งมอบ" && status !== "ยกเลิก";
}

export function isRelatedToMonth(record: BookingDeliveryRecord, range: MonthRange) {
  const bookingDate = parseBusinessDate(record.bookingDate);
  if (bookingDate === null) return true;
  return bookingDate < range.nextMonthStart && isOpenAt(record, range.monthStart);
}

export function calculateMonthlySummary(records: BookingDeliveryRecord[], range: MonthRange): MonthlySummary {
  const summary: MonthlySummary = {
    carryIn: 0,
    newBookings: 0,
    totalTracking: 0,
    delivered: 0,
    cancelled: 0,
    carryOut: 0,
    unknownDate: 0
  };

  for (const record of records) {
    const bookingDate = parseBusinessDate(record.bookingDate);
    const deliveredAt = parseBusinessDate(record.deliveredAt);
    const cancelledAt = parseBusinessDate(record.cancelledAt);

    if (bookingDate === null) {
      summary.unknownDate += 1;
      if (isCountedRecord(record) && isActiveLegacy(record)) summary.totalTracking += 1;
      continue;
    }

    if (!isCountedRecord(record)) continue;

    if (bookingDate < range.monthStart && isOpenAt(record, range.monthStart)) summary.carryIn += 1;
    if (within(bookingDate, range)) summary.newBookings += 1;
    if (within(deliveredAt, range)) summary.delivered += 1;
    if (within(cancelledAt, range)) summary.cancelled += 1;
    if (bookingDate < range.nextMonthStart && isOpenAt(record, range.nextMonthStart)) summary.carryOut += 1;
    if (bookingDate < range.nextMonthStart && isOpenAt(record, range.monthStart)) summary.totalTracking += 1;
  }

  return summary;
}

function matchesSearch(record: BookingDeliveryRecord, query: string) {
  const normalized = query.trim().toLocaleLowerCase("th-TH");
  if (!normalized) return true;
  return [
    record.customerName,
    record.plate,
    record.brand,
    record.model,
    record.year,
    record.saleName,
    record.teamName,
    record.bookingId
  ].join(" ").toLocaleLowerCase("th-TH").includes(normalized);
}

export function filterBookingDeliveryRecords(
  records: BookingDeliveryRecord[],
  range: MonthRange,
  filters: BookingDeliveryV2Filters = {}
) {
  const status = filters.status || "all";
  const saleName = text(filters.saleName);
  const count = filters.count || "all";
  const date = filters.date || "all_related";

  return records.filter((record) => {
    if (!matchesSearch(record, filters.query || "")) return false;
    if (status !== "all" && getBookingDisplayStatus(record) !== status) return false;
    if (saleName && record.saleName !== saleName) return false;
    if (count === "counted" && !isCountedRecord(record)) return false;
    if (count === "not_counted" && isCountedRecord(record)) return false;

    const unknown = hasUnknownBookingDate(record);
    if (date === "unknown") return unknown;
    if (date === "selected_month") return !unknown && isRelatedToMonth(record, range);
    return isRelatedToMonth(record, range);
  });
}

export function buildBookingDeliveryView(
  records: BookingDeliveryRecord[],
  range: MonthRange,
  filters: BookingDeliveryV2Filters = {}
) {
  const filteredRecords = filterBookingDeliveryRecords(records, range, filters);
  return {
    records: filteredRecords,
    summary: calculateMonthlySummary(filteredRecords, range)
  };
}

function exportRows(records: BookingDeliveryRecord[]) {
  return records.map((record) => [
    record.bookingDate || "ไม่ทราบวันที่จอง",
    getBookingDisplayStatus(record),
    record.customerName,
    record.plate,
    [record.brand, record.model, record.year, record.color].filter(Boolean).join(" "),
    record.finalPrice || record.salePrice,
    record.saleName,
    record.teamName,
    record.deliveryDate || record.deliveredAt || "",
    record.isCounted === false ? "ไม่นับยอด" : "นับยอด",
    record.bookingId
  ]);
}

const exportHeaders = ["วันที่จอง", "สถานะ", "ลูกค้า", "ทะเบียน", "รถ", "ราคาขาย", "เซลล์", "ทีม", "วันส่งมอบ", "การนับยอด", "Booking ID"];

function csvCell(value: unknown) {
  const raw = text(value);
  return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

export function bookingDeliveryRecordsToCsv(records: BookingDeliveryRecord[]) {
  return `\uFEFF${[exportHeaders, ...exportRows(records)].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

function tsvCell(value: unknown) {
  return text(value).replace(/[\t\r\n]+/g, " ");
}

export function bookingDeliveryRecordsToTsv(records: BookingDeliveryRecord[]) {
  return [exportHeaders, ...exportRows(records)].map((row) => row.map(tsvCell).join("\t")).join("\n");
}
