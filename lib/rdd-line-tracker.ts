import { listBookingDeliveryRecordsWithRevision } from "@/lib/booking-delivery";
import { pushLineText } from "@/lib/line";
import { appendRddActivity } from "@/lib/rdd-activity";
import { bangkokDateKey } from "@/lib/rdd-phase2";
import { RDD_PREP_LABELS, derivePrepReminder, prepStatusForRecord } from "@/lib/rdd-phase3c";
import { getRddLineSettings } from "@/lib/rdd-line-settings";
import { RddWorkspaceWriteError, updateRddWorkspaceRecord } from "@/lib/rdd-workspace-write";
import type { RddWorkspaceChanges, RddWorkspaceEditableField } from "@/lib/rdd-workspace-fields";
import type { BookingDeliveryRecord } from "@/lib/types";
import { readJsonStore, writeJsonStore } from "@/lib/json-store";

type TaskKey = "wash" | "sticker" | "oil" | "battery" | "tax" | "insurance" | "garage";
type TaskState = "pending" | "done" | "blocked";
type PendingChoice = { groupId: string; userId: string; caseIds: string[]; createdAt: string };

const taskMatchers: Array<[TaskKey, RegExp]> = [
  ["wash", /(?:ล้างรถ|ล้าง|สปา)/i], ["sticker", /(?:ลอกสติ๊กเกอร์|ลอกสติกเกอร์|สติ๊กเกอร์|สติกเกอร์|ลอกลาย)/i],
  ["oil", /(?:น้ำมันเครื่อง|เปลี่ยนน้ำมัน)/i], ["battery", /(?:แบตเตอรี่|แบต)/i], ["tax", /(?:ต่อภาษี|ภาษี)/i],
  ["insurance", /(?:ประกันภัย|ประกัน)/i], ["garage", /(?:รถกลับ|ส่งอู่|เข้าอู่|อู่)/i]
];
const taskLabels: Record<TaskKey, string> = { wash: "ล้างรถ", sticker: "ลอกสติ๊กเกอร์", oil: "น้ำมันเครื่อง", battery: "แบตเตอรี่", tax: "ภาษี", insurance: "ประกัน", garage: "อู่ / รถกลับ" };
const webhookStoreFile = "rdd-line-webhook-events.json";
const choiceStoreFile = "rdd-line-case-choices.json";

export async function wasRddLineWebhookProcessed(eventId: string) { if (!eventId) return false; const store = await readJsonStore<{ ids?: string[] }>(webhookStoreFile, { ids: [] }); return Array.isArray(store.ids) && store.ids.includes(eventId); }
export async function rememberRddLineWebhook(eventId: string) { if (!eventId) return; const store = await readJsonStore<{ ids?: string[] }>(webhookStoreFile, { ids: [] }); const ids = Array.isArray(store.ids) ? store.ids : []; if (!ids.includes(eventId)) await writeJsonStore(webhookStoreFile, { ids: [eventId, ...ids].slice(0, 1000) }); }

const fieldLabels: Partial<Record<RddWorkspaceEditableField, string>> = {
  purchaseType: "ประเภทซื้อ", caseStatus: "สถานะเคส", deliveryDate: "วันส่งมอบ", deliveryTime: "เวลาส่งมอบ", deliveryLocation: "สถานที่ส่งมอบ", deliveryLocationNote: "รายละเอียดส่งมอบ", financeCaseNote: "หมายเหตุ", garageRequired: "ส่งอู่", garageName: "ชื่ออู่", garageSentAt: "วันที่ส่งอู่", garageExpectedReturnDate: "วันที่คาดว่ารถกลับ", garageReturned: "รถกลับ", washStatus: "ล้างรถ", stickerStatus: "ลอกสติ๊กเกอร์", oilStatus: "น้ำมันเครื่อง", batteryStatus: "แบตเตอรี่", taxStatus: "ภาษี", insuranceStatus: "ประกัน"
};
function normalizePlate(value: unknown) { return String(value || "").normalize("NFKC").toUpperCase().replace(/[^0-9A-Zก-๙]/g, ""); }
function normalizeText(value: unknown) { return String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "").trim(); }
function statusSymbol(value: unknown) { if (value === "blocked") return "❌"; if (["completed", "changed", "replaced", "valid", "with_us", "customer_self", "no_change", "good", "no_sticker"].includes(String(value))) return "✅"; return ""; }
function prepLine(label: string, value: string | undefined, labels: Record<string, string>) { const symbol = statusSymbol(value); return `${label}: ${labels[value || ""] || "ยังไม่ระบุ"}${symbol ? ` ${symbol}` : ""}`; }

export function formatRddLineCase(record: BookingDeliveryRecord) {
  const prep = prepStatusForRecord(record);
  const garage = record.garageRequired === true || Boolean(record.garageName || record.garageSentAt || record.garageOutDate) ? record.garageReturned ? "รถกลับแล้ว ✅" : `ส่งอู่ / รถยังไม่กลับ${record.garageExpectedReturnDate || record.garageReturnDate ? ` (คาด ${record.garageExpectedReturnDate || record.garageReturnDate})` : ""}` : "ไม่ส่งอู่";
  return [`ติดตาม ${record.plate || "-"} · ${record.customerName || "-"}`, `สถานะ: ${record.workflowStatus || record.status || "ไม่ระบุ"}`, `ส่งมอบ: ${[record.deliveryDate, record.deliveryTime, record.deliveryLocation].filter(Boolean).join(" · ") || "ยังไม่ระบุ"}`, `อู่: ${garage}`, prepLine("ล้างรถ", prep.washStatus, RDD_PREP_LABELS.washStatus), prepLine("ลอกสติ๊กเกอร์", prep.stickerStatus, RDD_PREP_LABELS.stickerStatus), prepLine("น้ำมันเครื่อง", prep.oilStatus, RDD_PREP_LABELS.oilStatus), prepLine("แบตเตอรี่", prep.batteryStatus, RDD_PREP_LABELS.batteryStatus), prepLine("ภาษี", prep.taxStatus, RDD_PREP_LABELS.taxStatus), prepLine("ประกัน", prep.insuranceStatus, RDD_PREP_LABELS.insuranceStatus), record.financeCaseNote ? `หมายเหตุ: ${record.financeCaseNote}` : ""].filter(Boolean).join("\n");
}

function findRecords(records: BookingDeliveryRecord[], queryText: string) {
  const parts = String(queryText || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  let plateQuery = parts[0];
  if (parts.length >= 2 && /[ก-๙A-Z]/i.test(parts[0]) && /\d/.test(parts[1])) plateQuery = `${parts[0]}${parts[1]}`;
  let matches = (() => { const query = normalizePlate(plateQuery); if (!query) return []; const exact = records.filter(r => normalizePlate(r.plate) === query); return exact.length ? exact : records.filter(r => normalizePlate(r.plate).includes(query)); })();
  const consumed = plateQuery === parts[0] ? 1 : 2;
  const nameQuery = normalizeText(parts.slice(consumed).join(" "));
  if (nameQuery) matches = matches.filter(r => normalizeText(r.customerName).includes(nameQuery));
  return matches;
}
function choiceKey(groupId: string, userId?: string) { return `${groupId}:${userId || "group"}`; }
async function saveChoices(groupId: string, userId: string | undefined, matches: BookingDeliveryRecord[]) {
  const store = await readJsonStore<Record<string, PendingChoice>>(choiceStoreFile, {}); const key = choiceKey(groupId, userId);
  store[key] = { groupId, userId: userId || "", caseIds: matches.slice(0, 8).map(r => String(r.id)), createdAt: new Date().toISOString() };
  await writeJsonStore(choiceStoreFile, store);
}
async function takeChoice(groupId: string, userId: string | undefined, number: number, records: BookingDeliveryRecord[]) {
  const store = await readJsonStore<Record<string, PendingChoice>>(choiceStoreFile, {}); const key = choiceKey(groupId, userId); const pending = store[key];
  if (!pending || Date.now() - Date.parse(pending.createdAt) > 10 * 60 * 1000) { if (pending) { delete store[key]; await writeJsonStore(choiceStoreFile, store); } return null; }
  const id = pending.caseIds[number - 1]; if (!id) return null; delete store[key]; await writeJsonStore(choiceStoreFile, store); return records.find(r => String(r.id) === id) || null;
}
function duplicatePrompt(matches: BookingDeliveryRecord[]) { return `พบ ${matches.length} เคส เลือกเคสที่ต้องการ:\n${matches.slice(0, 8).map((r, i) => `${i + 1}. ${r.plate} · ${r.customerName || "-"} · ${r.workflowStatus || r.status || "ไม่ระบุ"}`).join("\n")}\n\nตอบเฉพาะเลข 1-${Math.min(matches.length, 8)} ภายใน 10 นาที\nหรือพิมพ์: ติดตาม 2737 ชื่อลูกค้า`; }
function parseTaskState(text: string): TaskState { if (text.includes("❌")) return "blocked"; if (text.includes("✅")) return "done"; return "pending"; }
function taskChanges(task: TaskKey, state: TaskState, taskText = ""): RddWorkspaceChanges {
  if (task === "garage") { if (state === "blocked") throw new Error("งานอู่ยังไม่รองรับ ❌ กรุณาใส่เหตุผลไว้ในหมายเหตุของเคส"); const date = taskText.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1]; if (state === "done") return { garageRequired: true, garageReturned: true }; if (/ส่งอู่|เข้าอู่/.test(taskText) && date) return { garageRequired: true, garageSentAt: date, garageReturned: false }; if (/รถกลับ/.test(taskText) && date) return { garageRequired: true, garageExpectedReturnDate: date, garageReturned: false }; return { garageRequired: true, garageReturned: false }; }
  const values: Record<Exclude<TaskKey, "garage">, Record<TaskState, string>> = { wash: { pending: "ordered_waiting", done: "completed", blocked: "blocked" }, sticker: { pending: "ordered_waiting", done: "completed", blocked: "blocked" }, oil: { pending: "change_waiting", done: "changed", blocked: "blocked" }, battery: { pending: "ordered_waiting", done: "replaced", blocked: "blocked" }, tax: { pending: "not_checked", done: "valid", blocked: "blocked" }, insurance: { pending: "not_discussed", done: "with_us", blocked: "blocked" } };
  const fields: Record<Exclude<TaskKey, "garage">, keyof RddWorkspaceChanges> = { wash: "washStatus", sticker: "stickerStatus", oil: "oilStatus", battery: "batteryStatus", tax: "taxStatus", insurance: "insuranceStatus" };
  return { [fields[task]]: values[task][state] } as RddWorkspaceChanges;
}

export function isRddLineTrackerCommand(text: string) { return /^\s*(?:(?:ติดตาม|งาน)\s+|[1-8]\s*$)/i.test(String(text || "")); }
function parseUpdateCommand(text: string) { const remainder = text.replace(/^งาน\s+/i, ""); const matches = taskMatchers.map(([task, pattern]) => ({ task, match: pattern.exec(remainder) })).filter((item): item is { task: TaskKey; match: RegExpExecArray } => Boolean(item.match)).sort((a, b) => a.match.index - b.match.index); const first = matches[0]; if (!first || first.match.index === 0) return null; return { plate: remainder.slice(0, first.match.index).trim(), task: first.task, taskText: remainder.slice(first.match.index).trim() }; }

export async function handleRddLineTrackerMessage(input: { text: string; sourceGroupId: string; sourceUserId?: string }) {
  const text = String(input.text || "").trim(); if (!isRddLineTrackerCommand(text)) return null;
  const settings = await getRddLineSettings(); if (!settings.enabled || !settings.groupId || settings.groupId !== input.sourceGroupId) return null;
  const snapshot = await listBookingDeliveryRecordsWithRevision();
  if (/^[1-8]$/.test(text)) { const chosen = await takeChoice(input.sourceGroupId, input.sourceUserId, Number(text), snapshot.records); return chosen ? formatRddLineCase(chosen) : null; }
  const query = text.match(/^ติดตาม\s+(.+)$/i);
  if (query) { const matches = findRecords(snapshot.records, query[1]); if (!matches.length) return "ไม่พบรถตามทะเบียน/ชื่อลูกค้าที่ค้นหา"; if (matches.length > 1) { await saveChoices(input.sourceGroupId, input.sourceUserId, matches); return duplicatePrompt(matches); } return formatRddLineCase(matches[0]); }
  const update = parseUpdateCommand(text); if (!update) return `รูปแบบคำสั่ง: งาน 3405 ล้างรถ ✅\nรองรับ: ${Object.values(taskLabels).join(", ")}`;
  const task = update.task; const state = parseTaskState(update.taskText);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = attempt === 0 ? snapshot : await listBookingDeliveryRecordsWithRevision(); const matches = findRecords(current.records, update.plate);
    if (!matches.length) return "ไม่พบรถตามทะเบียน/ชื่อลูกค้าที่ค้นหา";
    if (matches.length > 1) { await saveChoices(input.sourceGroupId, input.sourceUserId, matches); return `${duplicatePrompt(matches)}\n\nเพื่ออัปเดตทันที ใช้: งาน 2737 ชื่อลูกค้า ${update.taskText}`; }
    try {
      const changes = taskChanges(task, state, update.taskText); const result = await updateRddWorkspaceRecord({ id: matches[0].id, expectedRevision: current.revision, changes, actor: { id: `line:${input.sourceUserId || input.sourceGroupId}`, role: "sales" } });
      await appendRddActivity(null, { action: "booking_delivery_updated", targetType: "booking_delivery", targetId: result.record.id, source: "line", before: result.before, after: result.after, metadata: { changedFields: result.changedFields, lineUserId: input.sourceUserId || "", lineGroupId: input.sourceGroupId } }).catch(() => undefined);
      const symbol = state === "done" ? "✅" : state === "blocked" ? "❌" : ""; return `อัปเดต ${result.record.plate} · ${result.record.customerName || "-"} แล้ว\n${taskLabels[task]}: ${state === "done" ? "เสร็จ" : state === "blocked" ? "ทำไม่ได้" : "งานค้าง"}${symbol ? ` ${symbol}` : ""}`;
    } catch (error) { if (error instanceof RddWorkspaceWriteError && error.status === 409 && attempt < 2) continue; if (error instanceof RddWorkspaceWriteError && error.message === "ไม่มีข้อมูลที่เปลี่ยนแปลง") return `${matches[0].plate} · ${matches[0].customerName || "-"} · ${taskLabels[task]} เป็นสถานะนี้อยู่แล้ว`; throw error; }
  }
  return "ข้อมูลมีการเปลี่ยนพร้อมกัน กรุณาลองใหม่";
}

function displayChangedValue(field: RddWorkspaceEditableField, value: unknown) { if (["washStatus", "stickerStatus", "oilStatus", "batteryStatus", "taxStatus", "insuranceStatus"].includes(field)) return RDD_PREP_LABELS[field as keyof typeof RDD_PREP_LABELS][String(value) as never] || String(value || "—"); if (typeof value === "boolean") return value ? "ใช่" : "ไม่"; return String(value || "—"); }
export async function notifyRddLineWebUpdate(record: BookingDeliveryRecord, changedFields: RddWorkspaceEditableField[], after: Record<string, unknown>, actorName: string) { const settings = await getRddLineSettings(); if (!settings.enabled || !settings.groupId) return { sent: false, reason: "disabled" as const }; const lines = changedFields.map(field => `• ${fieldLabels[field] || field}: ${displayChangedValue(field, after[field])}`); await pushLineText(settings.groupId, [`อัปเดตจากแอป · ${record.plate}`, record.customerName, ...lines, actorName ? `โดย ${actorName}` : ""].filter(Boolean).join("\n")); return { sent: true }; }
export async function sendRddLinePendingReminder() { const settings = await getRddLineSettings(); if (!settings.enabled || !settings.reminderEnabled || !settings.groupId) return { sent: false, count: 0 }; const { records } = await listBookingDeliveryRecordsWithRevision(); const today = bangkokDateKey(); const pending = records.map(record => ({ record, reminder: derivePrepReminder(record, today) })).filter(item => item.reminder.eligible && item.reminder.pendingPrepCount > 0).sort((a, b) => b.reminder.urgentPrepCount - a.reminder.urgentPrepCount || b.reminder.pendingPrepCount - a.reminder.pendingPrepCount); if (!pending.length) { await pushLineText(settings.groupId, `สรุปงานค้าง ${today}\nไม่มีงานเตรียมรถค้าง ✅`); return { sent: true, count: 0 }; } const rows = pending.slice(0, 40).map(({ record, reminder }) => `• ${record.plate} · ${reminder.reminderItems.map(item => item.label).join(", ")}${reminder.urgentPrepCount ? " ⚠️" : ""}`); const suffix = pending.length > rows.length ? `\nและอีก ${pending.length - rows.length} คัน` : ""; await pushLineText(settings.groupId, `สรุปงานค้าง ${today} · ${pending.length} คัน\n${rows.join("\n")}${suffix}\n\nพิมพ์: ติดตาม <ทะเบียน>`); return { sent: true, count: pending.length }; }
