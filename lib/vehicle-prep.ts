import { createCalendarEvent, deleteCalendarEvent } from "@/lib/calendar-events";
import { readJsonStore, writeJsonStore } from "@/lib/json-store";
import type { DriveAttachment } from "@/lib/types";

export type PrepChecklistKey = "decal" | "spa" | "oil" | "wash";

export type VehiclePrepRecord = {
  bookingId: string;
  plate: string;
  customerName: string;
  garageOutDate: string;
  garageReturnDate: string;
  deliveryDate: string;
  checklist: Record<PrepChecklistKey, boolean>;
  extraNote: string;
  poFolderUrl: string;
  poAttachments: DriveAttachment[];
  financeApprovedAt: string;
  calendarEventIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type VehiclePrepInput = {
  bookingId: string;
  plate?: string;
  customerName?: string;
  garageOutDate?: string;
  garageReturnDate?: string;
  deliveryDate?: string;
  checklist?: Partial<Record<PrepChecklistKey, boolean>>;
  extraNote?: string;
};

type VehiclePrepStore = {
  records: VehiclePrepRecord[];
};

const storeFile = "vehicle-prep.json";
const checklistKeys: PrepChecklistKey[] = ["decal", "spa", "oil", "wash"];

function blankChecklist(): Record<PrepChecklistKey, boolean> {
  return { decal: false, spa: false, oil: false, wash: false };
}

async function readStore(): Promise<VehiclePrepStore> {
  const parsed = await readJsonStore<Partial<VehiclePrepStore>>(storeFile, { records: [] });
  return { records: Array.isArray(parsed.records) ? parsed.records : [] };
}

async function writeStore(store: VehiclePrepStore) {
  await writeJsonStore(storeFile, store);
}

function cleanDate(value?: string) {
  const date = String(value || "").trim();
  if (!date) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("วันที่ไม่ถูกต้อง");
  return date;
}

function normalizeChecklist(value?: Partial<Record<PrepChecklistKey, boolean>>) {
  const next = blankChecklist();
  for (const key of checklistKeys) next[key] = Boolean(value?.[key]);
  return next;
}

function mergeRecord(current: VehiclePrepRecord | null, input: VehiclePrepInput): VehiclePrepRecord {
  const now = new Date().toISOString();
  const bookingId = String(input.bookingId || "").trim();
  if (!bookingId) throw new Error("ไม่พบรหัสรายงานจอง");

  return {
    bookingId,
    plate: String(input.plate ?? current?.plate ?? "").trim(),
    customerName: String(input.customerName ?? current?.customerName ?? "").trim(),
    garageOutDate: cleanDate(input.garageOutDate ?? current?.garageOutDate),
    garageReturnDate: cleanDate(input.garageReturnDate ?? current?.garageReturnDate),
    deliveryDate: cleanDate(input.deliveryDate ?? current?.deliveryDate),
    checklist: normalizeChecklist({ ...(current?.checklist || blankChecklist()), ...(input.checklist || {}) }),
    extraNote: String(input.extraNote ?? current?.extraNote ?? "").trim(),
    poFolderUrl: current?.poFolderUrl || "",
    poAttachments: current?.poAttachments || [],
    financeApprovedAt: current?.financeApprovedAt || "",
    calendarEventIds: current?.calendarEventIds || [],
    createdAt: current?.createdAt || now,
    updatedAt: now
  };
}

export async function listVehiclePrepRecords() {
  return (await readStore()).records;
}

export async function getVehiclePrepRecord(bookingId: string) {
  const safeId = String(bookingId || "").trim();
  return (await readStore()).records.find((record) => record.bookingId === safeId) || null;
}

export async function saveVehiclePrepRecord(input: VehiclePrepInput) {
  const store = await readStore();
  const index = store.records.findIndex((record) => record.bookingId === String(input.bookingId || "").trim());
  const current = index >= 0 ? store.records[index] : null;
  const next = mergeRecord(current, input);
  next.calendarEventIds = await syncVehiclePrepCalendar(next);

  if (index >= 0) store.records[index] = next;
  else store.records.push(next);

  await writeStore(store);
  return next;
}

export async function markPrepFinanceApproved(input: {
  bookingId: string;
  plate?: string;
  customerName?: string;
  folderUrl?: string;
  attachments?: DriveAttachment[];
}) {
  const store = await readStore();
  const bookingId = String(input.bookingId || "").trim();
  if (!bookingId) throw new Error("ไม่พบรหัสรายงานจอง");

  const index = store.records.findIndex((record) => record.bookingId === bookingId);
  const current = index >= 0 ? store.records[index] : null;
  const next = mergeRecord(current, {
    bookingId,
    plate: input.plate,
    customerName: input.customerName
  });
  next.poFolderUrl = String(input.folderUrl || current?.poFolderUrl || "").trim();
  next.poAttachments = [...(current?.poAttachments || []), ...(input.attachments || [])];
  next.financeApprovedAt = new Date().toISOString();

  if (index >= 0) store.records[index] = next;
  else store.records.push(next);

  await writeStore(store);
  return next;
}

async function syncVehiclePrepCalendar(record: VehiclePrepRecord) {
  for (const id of record.calendarEventIds || []) {
    await deleteCalendarEvent(id).catch(() => null);
  }

  const createdIds: string[] = [];
  const titlePrefix = record.plate ? `${record.plate} ` : "";
  const detail = [record.customerName, record.extraNote].filter(Boolean).join("\n");

  if (record.garageOutDate) {
    const event = await createCalendarEvent({
      title: `${titlePrefix}ส่งอู่`,
      date: record.garageOutDate,
      type: "other",
      plate: record.plate,
      customerName: record.customerName,
      detail
    });
    createdIds.push(event.id);
  }

  if (record.garageReturnDate) {
    const event = await createCalendarEvent({
      title: `${titlePrefix}รถกลับอู่`,
      date: record.garageReturnDate,
      type: "garage_return",
      plate: record.plate,
      customerName: record.customerName,
      detail
    });
    createdIds.push(event.id);
  }

  if (record.deliveryDate) {
    const event = await createCalendarEvent({
      title: `${titlePrefix}นัดส่งมอบ`,
      date: record.deliveryDate,
      type: "delivery",
      plate: record.plate,
      customerName: record.customerName,
      detail
    });
    createdIds.push(event.id);
  }

  return createdIds;
}
