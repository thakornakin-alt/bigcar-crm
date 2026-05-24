import { pushLineText } from "@/lib/line";

export type RealtimePaymentType = "cash" | "finance";

export type RealtimeQueueStatus = "WAITING" | "MATCHED" | "BOOKED" | "FAILED" | "DUPLICATED" | "CANCELLED";

export type WaitingQueueInput = {
  plate: string;
  customerName: string;
  discount: number;
  paymentType: RealtimePaymentType;
  saleName: string;
  userId?: string;
};

export type WaitingQueueItem = WaitingQueueInput & {
  id: string;
  normalizedPlate: string;
  waitingOrder: number;
  status: RealtimeQueueStatus;
  createdAt: string;
  matchedAt?: string;
  bookedAt?: string;
  cancelledAt?: string;
  rtPrice?: number;
  finalPrice?: number;
  bookingText?: string;
  note?: string;
  cancelReason?: string;
  lineStatus?: "not_sent" | "sent" | "failed";
  lineSentAt?: string;
  lineTargetId?: string;
  lineError?: string;
};

export type ParsedVehiclePrice = {
  plate: string;
  normalizedPlate: string;
  rtPrice: number;
  source: string;
  mailSubject: string;
  receivedAt: string;
  parsedAt: string;
};

export type MailLog = {
  id: string;
  subject: string;
  sender: string;
  recipient: string;
  receivedAt: string;
  status: "IGNORED" | "PARSED" | "FAILED";
  vehicleCount: number;
  matchedCount: number;
  durationMs: number;
  error?: string;
};

type RealtimeBookingStore = {
  sequence: number;
  waiting: WaitingQueueItem[];
  prices: ParsedVehiclePrice[];
  mailLogs: MailLog[];
  lastSyncAt: string;
};

const STORE_KEY = "__BIG_CAR_REALTIME_BOOKING_STORE__";

function getStore(): RealtimeBookingStore {
  const globalStore = globalThis as typeof globalThis & {
    [STORE_KEY]?: RealtimeBookingStore;
  };

  if (!globalStore[STORE_KEY]) {
    globalStore[STORE_KEY] = {
      sequence: 0,
      waiting: [],
      prices: seedPrices(),
      mailLogs: [],
      lastSyncAt: new Date().toISOString()
    };
  }

  return globalStore[STORE_KEY];
}

function seedPrices(): ParsedVehiclePrice[] {
  return [];
}

export function normalizePlate(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
}

function getPriceMaxAgeMs() {
  const minutes = Number(process.env.REALTIME_BOOKING_PRICE_TTL_MINUTES || 30);
  return Math.max(minutes, 1) * 60 * 1000;
}

export function getRealtimeBookingSubjectPatterns() {
  const raw = process.env.REALTIME_BOOKING_GMAIL_SUBJECT;
  const value = raw === undefined ? "Pricing and Status Update" : raw;
  return value
    .split(/[,\n|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function realtimeBookingSubjectDescription() {
  const patterns = getRealtimeBookingSubjectPatterns();
  return patterns.length ? patterns.join(" / ") : "any subject";
}

export function isRealtimeBookingSubjectAllowed(subject: string) {
  const patterns = getRealtimeBookingSubjectPatterns();
  if (!patterns.length) return true;
  const normalizedSubject = String(subject || "").toLowerCase();
  return patterns.some((pattern) => normalizedSubject.includes(pattern.toLowerCase()));
}

export function listRealtimeQueue() {
  return [...getStore().waiting].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listVehiclePrices(query = "") {
  const term = normalizePlate(query);
  const prices = [...getStore().prices].sort((a, b) => b.parsedAt.localeCompare(a.parsedAt));

  if (!term) return prices.slice(0, 80);

  return prices.filter((item) => item.normalizedPlate.includes(term)).slice(0, 80);
}

export function getRealtimeDashboard() {
  const store = getStore();
  const waiting = store.waiting.filter((item) => item.status === "WAITING").length;
  const matched = store.waiting.filter((item) => item.status === "MATCHED").length;
  const booked = store.waiting.filter((item) => item.status === "BOOKED").length;
  const duplicated = store.waiting.filter((item) => item.status === "DUPLICATED").length;
  const cancelled = store.waiting.filter((item) => item.status === "CANCELLED").length;
  const latestMail = store.mailLogs[0] || null;

  return {
    vehicleCount: store.prices.length,
    waiting,
    matched,
    booked,
    duplicated,
    cancelled,
    onlineUsers: 1,
    lastSyncAt: store.lastSyncAt,
    latestMail,
    queue: listRealtimeQueue().slice(0, 30),
    mailLogs: store.mailLogs.slice(0, 20)
  };
}

export function addWaitingQueue(input: WaitingQueueInput) {
  const store = getStore();
  const normalizedPlate = normalizePlate(input.plate);

  if (!normalizedPlate) throw new Error("กรุณากรอกทะเบียนรถ");
  if (!input.customerName.trim()) throw new Error("กรุณากรอกชื่อลูกค้า");
  if (!input.saleName.trim()) throw new Error("กรุณากรอกเซลส์เจ้าของเคส");

  const activeSamePlate = store.waiting.find(
    (item) =>
      item.normalizedPlate === normalizedPlate &&
      (item.status === "WAITING" || item.status === "MATCHED" || item.status === "BOOKED")
  );

  store.sequence += 1;

  const item: WaitingQueueItem = {
    id: `WQ-${Date.now()}-${store.sequence}`,
    plate: input.plate.trim(),
    normalizedPlate,
    customerName: input.customerName.trim(),
    discount: Number(input.discount || 0),
    paymentType: input.paymentType,
    saleName: input.saleName.trim(),
    userId: input.userId || "local-user",
    waitingOrder: store.sequence,
    status: activeSamePlate ? "DUPLICATED" : "WAITING",
    createdAt: new Date().toISOString(),
    note: activeSamePlate ? `ทะเบียนนี้มีรายการก่อนแล้ว: ${activeSamePlate.saleName}` : undefined,
    lineStatus: "not_sent"
  };

  store.waiting.unshift(item);

  if (!activeSamePlate) {
    matchWaitingItem(item);
  }

  return item;
}

export function markBooked(id: string) {
  const item = getStore().waiting.find((queueItem) => queueItem.id === id);
  if (!item) throw new Error("ไม่พบรายการนี้");
  if (item.status !== "MATCHED") throw new Error("ต้องมีราคา RT ก่อนจึงจะปิดรายการได้");

  item.status = "BOOKED";
  item.bookedAt = new Date().toISOString();
  return item;
}

export async function sendQueueLine(id: string, targetId: string) {
  const item = getStore().waiting.find((queueItem) => queueItem.id === id);
  if (!item) throw new Error("ไม่พบรายการนี้");
  if (!targetId.trim()) throw new Error("กรุณาเลือก LINE group หรือ user");
  if (!item.bookingText) throw new Error("ต้องมีราคา RT ก่อนจึงจะส่ง LINE ได้");

  const text = [
    "ข้อมูลรถสำหรับส่งต่อ",
    `สถานะ: ${item.status}`,
    "",
    item.bookingText,
    "",
    `Timestamp: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`
  ].join("\n");

  try {
    await pushLineText(targetId, text);
    item.lineStatus = "sent";
    item.lineSentAt = new Date().toISOString();
    item.lineTargetId = targetId;
    item.lineError = "";
    return item;
  } catch (error) {
    item.lineStatus = "failed";
    item.lineError = error instanceof Error ? error.message : "LINE send failed";
    throw error;
  }
}

export function cancelQueue(id: string, reason = "") {
  const item = getStore().waiting.find((queueItem) => queueItem.id === id);
  if (!item) throw new Error("ไม่พบรายการนี้");
  if (item.status === "BOOKED") throw new Error("รายการนี้ถูกปิดแล้ว ต้องให้ Admin ยกเลิก");
  if (item.status === "CANCELLED") return item;

  item.status = "CANCELLED";
  item.cancelledAt = new Date().toISOString();
  item.cancelReason = reason.trim() || "ยกเลิกโดยเซลส์";
  item.note = item.cancelReason;
  return item;
}

export function ingestVehiclePrices(input: {
  subject: string;
  sender: string;
  recipient: string;
  receivedAt?: string;
  rows: Array<{ plate: string; rtPrice: number }>;
}) {
  const start = Date.now();
  const store = getStore();
  const receivedAt = input.receivedAt || new Date().toISOString();
  const parsedAt = new Date().toISOString();

  const validSubject = isRealtimeBookingSubjectAllowed(input.subject);

  if (!validSubject) {
    const ignored: MailLog = {
      id: `ML-${Date.now()}`,
      subject: input.subject,
      sender: input.sender,
      recipient: input.recipient,
      receivedAt,
      status: "IGNORED",
      vehicleCount: 0,
      matchedCount: 0,
      durationMs: Date.now() - start,
      error: `Subject does not match ${realtimeBookingSubjectDescription()}`
    };
    store.mailLogs.unshift(ignored);
    return ignored;
  }

  const incoming = input.rows
    .map((row) => ({
      plate: String(row.plate || "").trim(),
      normalizedPlate: normalizePlate(row.plate),
      rtPrice: Number(row.rtPrice || 0),
      source: "gmail-push",
      mailSubject: input.subject,
      receivedAt,
      parsedAt
    }))
    .filter((row) => row.normalizedPlate && row.rtPrice > 0);

  for (const row of incoming) {
    const existingIndex = store.prices.findIndex((item) => item.normalizedPlate === row.normalizedPlate);
    if (existingIndex >= 0) {
      store.prices[existingIndex] = row;
    } else {
      store.prices.unshift(row);
    }
  }

  let matchedCount = 0;
  for (const item of store.waiting) {
    if (item.status === "WAITING" && matchWaitingItem(item)) {
      matchedCount += 1;
    }
  }

  store.lastSyncAt = parsedAt;

  const parsed: MailLog = {
    id: `ML-${Date.now()}`,
    subject: input.subject,
    sender: input.sender,
    recipient: input.recipient,
    receivedAt,
    status: "PARSED",
    vehicleCount: incoming.length,
    matchedCount,
    durationMs: Date.now() - start
  };

  store.mailLogs.unshift(parsed);
  return parsed;
}

function matchWaitingItem(item: WaitingQueueItem) {
  const price = getStore().prices.find((vehicle) => {
    if (vehicle.normalizedPlate !== item.normalizedPlate) return false;

    const mailReceivedAt = new Date(vehicle.receivedAt).getTime();
    const waitingAt = new Date(item.createdAt).getTime();
    const now = Date.now();

    return mailReceivedAt >= waitingAt && now - mailReceivedAt <= getPriceMaxAgeMs();
  });
  if (!price) return false;

  item.status = "MATCHED";
  item.matchedAt = new Date().toISOString();
  item.rtPrice = price.rtPrice;
  item.finalPrice = Math.max(price.rtPrice - Number(item.discount || 0), 0);
  item.bookingText = generateBookingText(item);
  return true;
}

export function generateBookingText(item: WaitingQueueItem) {
  const rtPrice = Number(item.rtPrice || 0);
  const finalPrice = Number(item.finalPrice || Math.max(rtPrice - Number(item.discount || 0), 0));
  const paymentText = item.paymentType === "finance" ? "ไฟแนนซ์" : "เงินสด";

  return [
    "ช่องทางขาย : Retail ทีมบางนา",
    `ชื่อ-นามสกุล : ${item.customerName}`,
    `ทะเบียนรถ : ${item.plate}`,
    `ราคามาตรฐาน : ${formatMoney(rtPrice)}`,
    `ราคาตั้งขาย : ${formatMoney(finalPrice)}`,
    `ลด ${formatMoney(Number(item.discount || 0))} (จากส่วนกลาง)`,
    `ช่องทางชำระเงิน : ${paymentText}`,
    `เซลส์เจ้าของเคส : ${item.saleName}`
  ].join("\n");
}
