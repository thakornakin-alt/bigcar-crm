import { getBangkokMonthRange, parseBusinessDate } from "@/lib/booking-delivery-v2";
import { filterByOwnership, type OwnershipScope } from "@/lib/rdd-ownership";
import type { BookingDeliveryRecord, BookingDeliveryStatus } from "@/lib/types";
import { canonicalCaseStatus, canonicalPurchaseType, RDD_CASE_STATUS_LABELS, RDD_PURCHASE_TYPE_LABELS, reminderEligibleForRecord } from "@/lib/rdd-phase3b";
import { derivePrepReminder, type RddPrepArea, type RddReminderPriority } from "@/lib/rdd-phase3c";

export type RddPurchaseType = "ซื้อสด" | "ไฟแนนซ์" | "ไม่ระบุ";
export type RddDisplayStatus =
  | "ยอดจองทั้งหมด"
  | "รอจัดไฟแนนซ์"
  | "รอผลไฟแนนซ์"
  | "รอส่งมอบ"
  | "อนุมัติ / รอส่งมอบ"
  | "ตัดยอดแล้ว / รอส่งมอบ"
  | "ลูกค้าชะลอการดำเนินการ"
  | "ส่งมอบแล้ว"
  | "ยกเลิก"
  | "ไม่ระบุ";

export type RddReminderKind = "delivery_today" | "delivery_tomorrow" | "delivery_overdue" | "garage_return_due" | "prep_pending" | "prep_none" | RddPrepArea;

export type RddReminder = {
  kind: RddReminderKind;
  label: string;
  count: number;
  filterValue: string;
};

export type RddFollowUpKind = "delivery" | "garage" | "prep";
export type RddFollowUpItem = {
  kind: RddFollowUpKind;
  label: string;
  detail: string;
  priority: RddReminderPriority;
  actionableAt: number | null;
};
export type RddFollowUpCard = {
  record: BookingDeliveryRecord;
  priority: RddReminderPriority;
  actionableAt: number | null;
  items: RddFollowUpItem[];
};

export function followUpCardPreviewItems(card: RddFollowUpCard, limit = 2) {
  const items = card.items.slice(0, limit);
  return { items, remaining: Math.max(0, card.items.length - items.length) };
}

export function rddCaseHref(caseId: string, scope: OwnershipScope = "all") {
  return `/booking-delivery-workspace?caseId=${encodeURIComponent(caseId)}&scope=${scope}`;
}

export type RddHomeKpis = {
  newBookings: number;
  waitingFinanceSubmission: number;
  waitingFinanceResult: number;
  waitingDelivery: number;
  delivered: number;
  customerPaused: number;
  unknownBookingDate: number;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeRddSearch(value: unknown) {
  return text(value).toLocaleLowerCase("th-TH").replace(/[\s.-]+/g, "");
}

export function purchaseTypeForRecord(record: BookingDeliveryRecord): RddPurchaseType {
  const value = canonicalPurchaseType(record);
  if (value) return RDD_PURCHASE_TYPE_LABELS[value] as RddPurchaseType;
  return "ไม่ระบุ";
}

export function legacyStatusForRecord(record: BookingDeliveryRecord): RddDisplayStatus {
  const canonical = canonicalCaseStatus(record);
  if (canonical) return RDD_CASE_STATUS_LABELS[canonical] as RddDisplayStatus;
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

export function operationalRddRecords(records: readonly BookingDeliveryRecord[], includeQa = false) {
  if (includeQa) return [...records];
  return records.filter((record) => record.qaTestRecord !== true && record.excludeFromMetrics !== true);
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
    includeQa?: boolean;
  }
) {
  const owned = filterByOwnership(operationalRddRecords(records, input.includeQa === true), input.scope || "all", input.userId || "");
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
  const metricRecords = records.filter((record) => record.excludeFromMetrics !== true);
  const range = getBangkokMonthRange(year, month);
  const relevant = metricRecords.filter((record) => recordInRddMonth(record, year, month));
  return {
    newBookings: metricRecords.filter((record) => {
      const value = parseBusinessDate(record.bookingDate);
      return value !== null && value >= range.monthStart && value < range.nextMonthStart;
    }).length,
    waitingFinanceSubmission: relevant.filter((record) => legacyStatusForRecord(record) === "รอจัดไฟแนนซ์").length,
    waitingFinanceResult: relevant.filter((record) => legacyStatusForRecord(record) === "รอผลไฟแนนซ์").length,
    waitingDelivery: relevant.filter((record) => ["รอส่งมอบ", "อนุมัติ / รอส่งมอบ", "ตัดยอดแล้ว / รอส่งมอบ"].includes(legacyStatusForRecord(record))).length,
    delivered: metricRecords.filter((record) => {
      if (legacyStatusForRecord(record) !== "ส่งมอบแล้ว") return false;
      const value = parseBusinessDate(record.deliveredAt || record.deliveryDate);
      return value !== null && value >= range.monthStart && value < range.nextMonthStart;
    }).length,
    customerPaused: relevant.filter((record) => legacyStatusForRecord(record) === "ลูกค้าชะลอการดำเนินการ").length,
    unknownBookingDate: metricRecords.filter((record) => parseBusinessDate(record.bookingDate) === null).length
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

function reminderPriorityRank(value: RddReminderPriority) {
  return value === "urgent" ? 0 : value === "high" ? 1 : 2;
}

export function deriveDeliveryReminder(record: BookingDeliveryRecord, today: string) {
  const todayValue = dayStart(today);
  const delivery = dayStart(record.deliveryDate);
  if (todayValue === null || delivery === null) return null;
  if (delivery < todayValue) return { kind: "delivery_overdue" as const, label: "เลยกำหนดส่งมอบ", priority: "urgent" as const, actionableAt: delivery };
  if (delivery === todayValue) return { kind: "delivery_today" as const, label: "ส่งมอบวันนี้", priority: "urgent" as const, actionableAt: delivery };
  if (delivery === todayValue + 86_400_000) return { kind: "delivery_tomorrow" as const, label: "ส่งมอบพรุ่งนี้", priority: "high" as const, actionableAt: delivery };
  return null;
}

/** Case-level Home presentation composed from the canonical Phase 3B/3C reminder selectors. */
export function deriveRddFollowUpCards(records: BookingDeliveryRecord[], today = bangkokDateKey()): RddFollowUpCard[] {
  const todayValue = dayStart(today);
  if (todayValue === null) return [];
  return records
    .filter((record) => record.qaTestRecord !== true && record.excludeFromMetrics !== true && reminderEligibleForRecord(record))
    .map((record) => {
      const delivery = dayStart(record.deliveryDate);
      const prep = derivePrepReminder(record, today);
      const items: RddFollowUpItem[] = [];
      const deliveryReminder = deriveDeliveryReminder(record, today);
      if (deliveryReminder) items.push({ kind: "delivery", label: deliveryReminder.label, detail: deliveryReminder.kind === "delivery_overdue" ? record.deliveryDate || "" : record.deliveryTime || "ตรวจสอบเวลานัด", priority: deliveryReminder.priority, actionableAt: deliveryReminder.actionableAt });
      for (const item of prep.reminderItems) {
        const actionableAt = item.area === "garage" ? dayStart(record.garageExpectedReturnDate || record.garageReturnDate) : delivery;
        items.push({ kind: item.area === "garage" ? "garage" : "prep", label: item.label, detail: item.detail, priority: item.priority, actionableAt });
      }
      const priority = items.reduce<RddReminderPriority>((best, item) => reminderPriorityRank(item.priority) < reminderPriorityRank(best) ? item.priority : best, "normal");
      const actionableAt = items.reduce<number | null>((nearest, item) => item.actionableAt === null ? nearest : nearest === null || item.actionableAt < nearest ? item.actionableAt : nearest, null);
      return { record, priority, actionableAt, items };
    })
    .filter((card) => card.items.length > 0)
    .sort((a, b) => reminderPriorityRank(a.priority) - reminderPriorityRank(b.priority)
      || (a.actionableAt ?? Number.MAX_SAFE_INTEGER) - (b.actionableAt ?? Number.MAX_SAFE_INTEGER)
      || String(a.record.id).localeCompare(String(b.record.id), "th"));
}

export function recordMatchesReminder(record: BookingDeliveryRecord, kind: RddReminderKind, today: string) {
  if (!reminderEligibleForRecord(record)) return false;
  const todayValue = dayStart(today);
  if (todayValue === null) return false;
  const deliveryReminder = deriveDeliveryReminder(record, today);
  const garageReturn = dayStart(record.garageExpectedReturnDate || record.garageReturnDate);
  if (kind === "delivery_today" || kind === "delivery_tomorrow" || kind === "delivery_overdue") return deliveryReminder?.kind === kind;
  if (kind === "garage_return_due") return record.garageReturned !== true && garageReturn !== null && garageReturn <= todayValue;
  const prep = derivePrepReminder(record, today);
  if (kind === "prep_pending") return prep.pendingPrepCount > 0;
  if (kind === "prep_none") return prep.pendingPrepCount === 0;
  return prep.reminderItems.some((item) => item.area === kind);
}

export function deriveRddReminders(records: BookingDeliveryRecord[], today = bangkokDateKey()): RddReminder[] {
  const metricRecords = records.filter((record) => record.excludeFromMetrics !== true);
  const definitions: Array<Omit<RddReminder, "count">> = [
    { kind: "delivery_today", label: "ส่งมอบวันนี้", filterValue: "delivery_today" },
    { kind: "delivery_tomorrow", label: "ส่งมอบพรุ่งนี้", filterValue: "delivery_tomorrow" },
    { kind: "delivery_overdue", label: "เลยกำหนดส่งมอบ", filterValue: "delivery_overdue" },
    { kind: "garage_return_due", label: "รถถึงกำหนดกลับจากอู่", filterValue: "garage_return_due" }
    ,{ kind: "prep_pending", label: "งานเตรียมรถค้าง", filterValue: "prep_pending" }
  ];
  return definitions.map((definition) => ({
    ...definition,
    count: metricRecords.filter((record) => recordMatchesReminder(record, definition.kind, today)).length
  }));
}

export function upcomingRddDeliveries(records: BookingDeliveryRecord[], today = bangkokDateKey(), limit = 8) {
  const todayValue = dayStart(today) ?? 0;
  return records
    .filter((record) => record.excludeFromMetrics !== true)
    .map((record) => ({ record, date: dayStart(record.deliveryDate) }))
    .filter(({ record, date }) => date !== null && date >= todayValue && reminderEligibleForRecord(record))
    .sort((a, b) => Number(a.date) - Number(b.date))
    .slice(0, limit)
    .map(({ record }) => record);
}

export const RDD_REMINDER_CAPABILITIES = [
  { capability: "ส่งมอบวันนี้ / พรุ่งนี้ / เลยกำหนด", phase: "supported" as const, source: "deliveryDate" },
  { capability: "รถถึงกำหนดกลับจากอู่", phase: "supported" as const, source: "garageExpectedReturnDate (legacy: garageReturnDate) + garageReturned" },
  { capability: "งานเตรียมรถค้างแบบ workflow", phase: "supported" as const, source: "Phase 3C canonical preparation statuses" },
  { capability: "รอจัดไฟแนนซ์ / ลูกค้าชะลอ", phase: "supported" as const, source: "purchaseType + caseStatus" }
];
