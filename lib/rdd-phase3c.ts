import { parseBusinessDate } from "@/lib/booking-delivery-v2";
import { reminderEligibleForRecord } from "@/lib/rdd-phase3b";
import type { BookingDeliveryRecord } from "@/lib/types";

export const RDD_WASH_STATUSES = ["not_ordered", "ordered_waiting", "completed"] as const;
export const RDD_STICKER_STATUSES = ["not_checked", "no_sticker", "ordered_waiting", "completed"] as const;
export const RDD_OIL_STATUSES = ["no_change", "change_waiting", "changed"] as const;
export const RDD_BATTERY_STATUSES = ["not_checked", "good", "ordered_waiting", "replaced"] as const;
export const RDD_TAX_STATUSES = ["not_checked", "valid", "renewal_ordered"] as const;
export const RDD_INSURANCE_STATUSES = ["not_discussed", "with_us", "customer_self"] as const;

export const RDD_PREP_LABELS = {
  washStatus: { not_ordered: "ยังไม่ได้สั่ง", ordered_waiting: "สั่งแล้ว / รอล้าง", completed: "ล้างเรียบร้อย" },
  stickerStatus: { not_checked: "ยังไม่ตรวจ / ยังไม่สั่ง", no_sticker: "ไม่มีสติ๊กเกอร์", ordered_waiting: "สั่งลอกแล้ว / รอลอก", completed: "ลอกแล้ว" },
  oilStatus: { no_change: "ไม่เปลี่ยน", change_waiting: "เปลี่ยน / รอเปลี่ยน", changed: "เปลี่ยน / เรียบร้อย" },
  batteryStatus: { not_checked: "ยังไม่ตรวจ", good: "สมบูรณ์", ordered_waiting: "สั่งแล้ว / รอเปลี่ยน", replaced: "เปลี่ยนเรียบร้อย" },
  taxStatus: { not_checked: "ยังไม่ตรวจ", valid: "ภาษีไม่ขาด", renewal_ordered: "ภาษีขาด / สั่งต่อแล้ว" },
  insuranceStatus: { not_discussed: "ยังไม่ได้คุย", with_us: "เสนอแล้ว / ทำกับเรา", customer_self: "เสนอแล้ว / ลูกค้าทำเอง" }
} as const;

export type RddPrepArea = "garage" | "wash" | "sticker" | "oil" | "battery" | "tax" | "insurance";
export type RddReminderPriority = "normal" | "high" | "urgent";
export type RddPrepReminderItem = { area: RddPrepArea; label: string; detail: string; priority: RddReminderPriority };

function day(value: unknown) { return parseBusinessDate(value); }
function priorityRank(value: RddReminderPriority) { return value === "urgent" ? 3 : value === "high" ? 2 : 1; }

export function prepStatusForRecord(record: BookingDeliveryRecord) {
  return {
    washStatus: record.washStatus || (record.spaFullSystemDone ? "completed" : "not_ordered"),
    stickerStatus: record.stickerStatus || (record.decalRemovalDone ? "completed" : "not_checked"),
    oilStatus: record.oilStatus || (record.oilChangeDone ? "changed" : "no_change"),
    batteryStatus: record.batteryStatus || "not_checked",
    taxStatus: record.taxStatus || "not_checked",
    insuranceStatus: record.insuranceStatus || (record.insuranceDone ? "with_us" : "not_discussed")
  } as const;
}

export function derivePrepReminder(record: BookingDeliveryRecord, today: string) {
  const eligible = record.qaTestRecord !== true && record.excludeFromMetrics !== true && reminderEligibleForRecord(record);
  const statuses = prepStatusForRecord(record);
  const todayValue = day(today);
  const delivery = day(record.deliveryDate);
  const tomorrow = todayValue === null ? null : todayValue + 86_400_000;
  const deliveryPriority: RddReminderPriority = delivery !== null && todayValue !== null && delivery <= todayValue
    ? "urgent" : delivery !== null && tomorrow !== null && delivery === tomorrow ? "high" : "normal";
  if (!eligible) return { eligible: false, pendingPrepCount: 0, urgentPrepCount: 0, priority: "normal" as const, reminderItems: [] as RddPrepReminderItem[] };

  const items: RddPrepReminderItem[] = [];
  const expected = day(record.garageExpectedReturnDate || record.garageReturnDate);
  const garageRequired = record.garageRequired === true || (record.garageRequired === undefined && Boolean(record.garageName || record.garageSentAt || record.garageOutDate || expected));
  if (garageRequired && record.garageReturned !== true) {
    const garagePriority: RddReminderPriority = expected !== null && todayValue !== null && expected < todayValue ? "urgent" : expected !== null && todayValue !== null && expected === todayValue ? "high" : "normal";
    items.push({ area: "garage", label: "อู่ / รถกลับ", detail: expected ? `คาดรถกลับ ${record.garageExpectedReturnDate || record.garageReturnDate}` : "รถยังไม่กลับจากอู่", priority: garagePriority });
  }
  const pending: Array<[RddPrepArea, string, boolean, string]> = [
    ["wash", "ล้างรถ", statuses.washStatus !== "completed", RDD_PREP_LABELS.washStatus[statuses.washStatus]],
    ["sticker", "ลอกสติ๊กเกอร์", statuses.stickerStatus === "not_checked" || statuses.stickerStatus === "ordered_waiting", RDD_PREP_LABELS.stickerStatus[statuses.stickerStatus]],
    ["oil", "น้ำมันเครื่อง", statuses.oilStatus === "change_waiting", RDD_PREP_LABELS.oilStatus[statuses.oilStatus]],
    ["battery", "แบตเตอรี่", statuses.batteryStatus === "not_checked" || statuses.batteryStatus === "ordered_waiting", RDD_PREP_LABELS.batteryStatus[statuses.batteryStatus]],
    ["tax", "ภาษี", statuses.taxStatus === "not_checked", RDD_PREP_LABELS.taxStatus[statuses.taxStatus]],
    ["insurance", "ประกัน", statuses.insuranceStatus === "not_discussed", RDD_PREP_LABELS.insuranceStatus[statuses.insuranceStatus]]
  ];
  for (const [area, label, isPending, detail] of pending) if (isPending) items.push({ area, label, detail, priority: deliveryPriority });
  const priority = items.reduce<RddReminderPriority>((best, item) => priorityRank(item.priority) > priorityRank(best) ? item.priority : best, "normal");
  return { eligible: true, pendingPrepCount: items.length, urgentPrepCount: items.filter((item) => item.priority === "urgent").length, priority, reminderItems: items };
}

export function isPrepEnum(field: string, value: unknown) {
  const values: Record<string, readonly string[]> = { washStatus: RDD_WASH_STATUSES, stickerStatus: RDD_STICKER_STATUSES, oilStatus: RDD_OIL_STATUSES, batteryStatus: RDD_BATTERY_STATUSES, taxStatus: RDD_TAX_STATUSES, insuranceStatus: RDD_INSURANCE_STATUSES };
  return Boolean(values[field]?.includes(String(value)));
}
