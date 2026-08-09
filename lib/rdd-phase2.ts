import { getBangkokMonthRange, parseBusinessDate } from "@/lib/booking-delivery-v2";
import { filterByOwnership, type OwnershipScope } from "@/lib/rdd-ownership";
import type { BookingDeliveryRecord, BookingDeliveryStatus } from "@/lib/types";

export type RddPurchaseType = "เงินสด" | "ไฟแนนซ์" | "ไม่ระบุ";
export type RddDisplayStatus =
  | "ยอดจองทั้งหมด"
  | "รอผลไฟแนนซ์"
  | "รอส่งมอบ"
  | "ส่งมอบแล้ว"
  | "ยกเลิก"
  | "ไม่ระบุ";

export type RddReminderKind = "delivery_today" | "delivery_tomorrow" | "delivery_overdue" | "garage_return_due";

export type RddReminder = {
  kind: RddReminderKind;
  label: string;
  count: number;
  filterValue: string;
};

export type RddHomeKpis = {
  newBookings: number;
  waitingFinanceResult: number;
  waitingDelivery: number;
  delivered: number;
  unknownBookingDate: number;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeRddSearch(value: unknown) {
  return text(value).toLocaleLowerCase("th-TH").replace(/[\s.-]+/g, "");
}

export function purchaseTypeForRecord(record: BookingDeliveryRecord): RddPurchaseType {
  const value = text(record.paymentType).toLocaleLowerCase("th-TH");
  if (/เงินสด|cash/.test(value)) return "เงินสด";
  if (/ไฟแนนซ์|finance|จัด/.test(value)) return "ไฟแนนซ์";
  return "ไม่ระบุ";
}

export function legacyStatusForRecord(record: BookingDeliveryRecord): RddDisplayStatus {
  const status = text(record.status) as BookingDeliveryStatus;
  const workflow = text(record.workflowStatus) as BookingDeliveryStatus;
  const value = status === "ยกเลิก" ? status : workflow || status;
  if (value === "ยอดจอง") return "ยอดจองทั้งหมด";
  if (value === "รอผลไฟแนนซ์") return "รอผลไฟแนนซ์";
  if (value === "รอส่งมอบ") return "รอส่งมอบ";
  if (value === "ยอดส่งมอบ") return "ส่งมอบแล้ว";
  if (value === "ยกเลิก") return "ยกเลิก";
  return "ไม่ระบุ";
}

export function recordMatchesRddSearch(record: BookingDeliveryRecord, query: string) {
  const needle = normalizeRddSearch(query);
  if (!needle) return true;
  const plate = normalizeRddSearch(record.plate);
  if (plate.includes(needle)) return true;
  return normalizeRddSearch(record.customerName).includes(needle);
}

export function recordInRddMonth(record: BookingDeliveryRecord, year: number, month: number) {
  const range = getBangkokMonthRange(year, month);
  const booking = parseBusinessDate(record.bookingDate);
  if (booking === null) return true;
  if (booking >= range.nextMonthStart) return false;

  const displayStatus = legacyStatusForRecord(record);
  const terminal = displayStatus === "ส่งมอบแล้ว"
    ? parseBusinessDate(record.deliveredAt || record.deliveryDate)
    : displayStatus === "ยกเลิก"
      ? parseBusinessDate(record.cancelledAt)
      : null;
  return terminal === null || terminal >= range.monthStart;
}

export function filterRddWorkspaceRecords(
  records: BookingDeliveryRecord[],
  input: {
    year: number;
    month: number;
    query?: string;
    scope?: OwnershipScope;
    userId?: string;
    purchaseType?: "all" | RddPurchaseType;
    status?: "all" | RddDisplayStatus;
    pending?: "all" | RddReminderKind;
    today?: string;
  }
) {
  const owned = filterByOwnership(records, input.scope || "all", input.userId || "");
  return owned.filter((record) => {
    if (!recordInRddMonth(record, input.year, input.month)) return false;
    if (!recordMatchesRddSearch(record, input.query || "")) return false;
    if (input.purchaseType && input.purchaseType !== "all" && purchaseTypeForRecord(record) !== input.purchaseType) return false;
    if (input.status && input.status !== "all" && legacyStatusForRecord(record) !== input.status) return false;
    if (input.pending && input.pending !== "all" && !recordMatchesReminder(record, input.pending, input.today || bangkokDateKey())) return false;
    return true;
  });
}

export function deriveRddHomeKpis(records: BookingDeliveryRecord[], year: number, month: number): RddHomeKpis {
  const range = getBangkokMonthRange(year, month);
  const relevant = records.filter((record) => recordInRddMonth(record, year, month));
  return {
    newBookings: records.filter((record) => {
      const value = parseBusinessDate(record.bookingDate);
      return value !== null && value >= range.monthStart && value < range.nextMonthStart;
    }).length,
    waitingFinanceResult: relevant.filter((record) => legacyStatusForRecord(record) === "รอผลไฟแนนซ์").length,
    waitingDelivery: relevant.filter((record) => legacyStatusForRecord(record) === "รอส่งมอบ").length,
    delivered: records.filter((record) => {
      if (legacyStatusForRecord(record) !== "ส่งมอบแล้ว") return false;
      const value = parseBusinessDate(record.deliveredAt || record.deliveryDate);
      return value !== null && value >= range.monthStart && value < range.nextMonthStart;
    }).length,
    unknownBookingDate: records.filter((record) => parseBusinessDate(record.bookingDate) === null).length
  };
}

export function bangkokDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dayStart(value: string) {
  return parseBusinessDate(value);
}

export function recordMatchesReminder(record: BookingDeliveryRecord, kind: RddReminderKind, today: string) {
  const status = legacyStatusForRecord(record);
  if (status === "ส่งมอบแล้ว" || status === "ยกเลิก") return false;
  const todayValue = dayStart(today);
  if (todayValue === null) return false;
  const delivery = dayStart(record.deliveryDate);
  const garageReturn = dayStart(record.garageReturnDate);
  const tomorrow = todayValue + 86_400_000;
  if (kind === "delivery_today") return delivery === todayValue;
  if (kind === "delivery_tomorrow") return delivery === tomorrow;
  if (kind === "delivery_overdue") return delivery !== null && delivery < todayValue;
  return garageReturn !== null && garageReturn <= todayValue;
}

export function deriveRddReminders(records: BookingDeliveryRecord[], today = bangkokDateKey()): RddReminder[] {
  const definitions: Array<Omit<RddReminder, "count">> = [
    { kind: "delivery_today", label: "ส่งมอบวันนี้", filterValue: "delivery_today" },
    { kind: "delivery_tomorrow", label: "ส่งมอบพรุ่งนี้", filterValue: "delivery_tomorrow" },
    { kind: "delivery_overdue", label: "เลยกำหนดส่งมอบ", filterValue: "delivery_overdue" },
    { kind: "garage_return_due", label: "รถถึงกำหนดกลับจากอู่", filterValue: "garage_return_due" }
  ];
  return definitions.map((definition) => ({
    ...definition,
    count: records.filter((record) => recordMatchesReminder(record, definition.kind, today)).length
  }));
}

export function upcomingRddDeliveries(records: BookingDeliveryRecord[], today = bangkokDateKey(), limit = 8) {
  const todayValue = dayStart(today) ?? 0;
  return records
    .map((record) => ({ record, date: dayStart(record.deliveryDate) }))
    .filter(({ record, date }) => date !== null && date >= todayValue && !["ส่งมอบแล้ว", "ยกเลิก"].includes(legacyStatusForRecord(record)))
    .sort((a, b) => Number(a.date) - Number(b.date))
    .slice(0, limit)
    .map(({ record }) => record);
}

export const RDD_REMINDER_CAPABILITIES = [
  { capability: "ส่งมอบวันนี้ / พรุ่งนี้ / เลยกำหนด", phase: "supported" as const, source: "deliveryDate" },
  { capability: "รถถึงกำหนดกลับจากอู่", phase: "supported" as const, source: "garageReturnDate" },
  { capability: "งานเตรียมรถค้างแบบ workflow", phase: "phase3" as const, source: "ต้องมีสถานะงานและผู้รับผิดชอบที่ชัดเจน" },
  { capability: "รอจัดไฟแนนซ์ / ลูกค้าชะลอ", phase: "phase3" as const, source: "ต้องมี detailed status ที่ยืนยันได้" }
];
