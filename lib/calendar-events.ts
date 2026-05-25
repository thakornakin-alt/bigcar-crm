import { readJsonStore, writeJsonStore } from "@/lib/json-store";

export type CalendarEventType = "delivery" | "garage_return" | "customer_appointment" | "other";

export type CalendarEventInput = {
  title: string;
  date: string;
  time?: string;
  type: CalendarEventType;
  plate?: string;
  customerName?: string;
  detail?: string;
};

export type CalendarEvent = CalendarEventInput & {
  id: string;
  time: string;
  plate: string;
  customerName: string;
  detail: string;
  createdAt: string;
  updatedAt: string;
};

type CalendarStore = {
  events: CalendarEvent[];
};

const eventTypes: CalendarEventType[] = ["delivery", "garage_return", "customer_appointment", "other"];
const storeFile = "calendar-events.json";

async function readStore(): Promise<CalendarStore> {
  const parsed = await readJsonStore<Partial<CalendarStore>>(storeFile, { events: [] });
  return { events: Array.isArray(parsed.events) ? parsed.events : [] };
}

async function writeStore(store: CalendarStore) {
  await writeJsonStore(storeFile, store);
}

export function isCalendarEventType(value: string): value is CalendarEventType {
  return eventTypes.includes(value as CalendarEventType);
}

function cleanDate(value: string) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("วันที่ไม่ถูกต้อง");
  return date;
}

function cleanTime(value?: string) {
  const time = String(value || "").trim();
  if (!time) return "";
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error("เวลาไม่ถูกต้อง");
  return time;
}

export async function listCalendarEvents(input: { from?: string; to?: string } = {}) {
  const store = await readStore();
  const from = input.from ? cleanDate(input.from) : "";
  const to = input.to ? cleanDate(input.to) : "";

  return store.events
    .filter((event) => (!from || event.date >= from) && (!to || event.date <= to))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

export async function createCalendarEvent(input: CalendarEventInput) {
  const title = String(input.title || "").trim();
  const type = String(input.type || "").trim();

  if (!title) throw new Error("กรุณากรอกชื่องาน");
  if (!isCalendarEventType(type)) throw new Error("ประเภทงานไม่ถูกต้อง");

  const now = new Date().toISOString();
  const event: CalendarEvent = {
    id: `CE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    date: cleanDate(input.date),
    time: cleanTime(input.time),
    type,
    plate: String(input.plate || "").trim(),
    customerName: String(input.customerName || "").trim(),
    detail: String(input.detail || "").trim(),
    createdAt: now,
    updatedAt: now
  };

  const store = await readStore();
  store.events.push(event);
  await writeStore(store);
  return event;
}

export async function deleteCalendarEvent(id: string) {
  const safeId = String(id || "").trim();
  if (!safeId) throw new Error("ไม่พบรหัสงาน");

  const store = await readStore();
  const nextEvents = store.events.filter((event) => event.id !== safeId);
  if (nextEvents.length === store.events.length) throw new Error("ไม่พบงานนี้");

  await writeStore({ events: nextEvents });
  return { ok: true };
}
