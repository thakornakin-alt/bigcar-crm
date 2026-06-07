import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import { lookupStockByPlate } from "@/lib/apps-script";
import { pushLineText } from "@/lib/line";

export type RealtimePaymentType = "cash" | "finance";

export type RealtimeQueueStatus = "WAITING" | "MATCHED" | "BOOKED" | "FAILED" | "DUPLICATED" | "CANCELLED";

export type WaitingQueueInput = {
  plate: string;
  customerName: string;
  discount: number;
  paymentType: RealtimePaymentType;
  saleName: string;
  note?: string;
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
  lineSendError?: string;
  autoSendAttemptedAt?: string;
  autoSendStatus?: "pending" | "sent" | "failed" | "skipped";
  matchDebug?: MatchDebugLog;
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

export type MatchDebugLog = {
  id: string;
  at: string;
  queuePlate: string;
  queueNormalizedPlate: string;
  pricePlate: string;
  priceNormalizedPlate: string;
  plateMatched: boolean;
  receivedAt: string;
  createdAt: string;
  receivedAfterCreated: boolean;
  ttlValid: boolean;
  stockFound: boolean;
  stockSource: string;
  stockRecord?: unknown;
  finalMatchResult: "MATCHED" | "WAITING" | "DUPLICATED" | "BOOKED" | "CANCELLED";
  reason: string;
};

export type MatchDebugSnapshot = {
  plate: string;
  normalizedPlate: string;
  stockFound: boolean;
  stockSource: string;
  stockRecord: unknown;
  priceFound: boolean;
  matchedPricePlate: string;
  normalizedMatchedPricePlate: string;
  ttlValid: boolean;
  waitingFound: boolean;
  waitingItem: WaitingQueueItem | null;
  finalMatchResult: boolean;
  reason: string;
};

type AutoSendStatus = "pending" | "sent" | "failed" | "skipped";

type RealtimeBookingStore = {
  sequence: number;
  waiting: WaitingQueueItem[];
  prices: ParsedVehiclePrice[];
  mailLogs: MailLog[];
  auditLogs: MatchDebugLog[];
  lastSyncAt: string;
  lastSyncStatus?: string;
  lastSyncResult?: string;
  lastHistoryId?: string;
  lastWatchRegisteredAt?: string;
  lastWatchRenewedAt?: string;
  lastWatchError?: string;
  lastWatchTopic?: string;
  watchStatus?: string;
  watchExpiration?: string;
  lastWebhookAt?: string;
  lastProcessingMs?: number;
};

const STORE_KEY = "__BIG_CAR_REALTIME_BOOKING_STORE__";
const STORE_FILE_NAME = "realtime-booking.json";

function getDataDir() {
  return process.env.BIG_CAR_DATA_DIR
    ? path.resolve(process.env.BIG_CAR_DATA_DIR)
    : path.join(process.cwd(), ".data");
}

function getStorePath() {
  return path.join(getDataDir(), STORE_FILE_NAME);
}

function createDefaultStore(): RealtimeBookingStore {
  return {
    sequence: 0,
    waiting: [],
    prices: seedPrices(),
    mailLogs: [],
    auditLogs: [],
    lastSyncAt: new Date().toISOString(),
    watchStatus: "missing"
  };
}

function normalizeStore(store: Partial<RealtimeBookingStore> | undefined | null): RealtimeBookingStore {
  const fallback = createDefaultStore();
  if (!store) return fallback;

  return {
    sequence: Number(store.sequence || 0),
    waiting: Array.isArray(store.waiting) ? store.waiting : fallback.waiting,
    prices: Array.isArray(store.prices) ? store.prices : fallback.prices,
    mailLogs: Array.isArray(store.mailLogs) ? store.mailLogs : fallback.mailLogs,
    auditLogs: Array.isArray(store.auditLogs) ? store.auditLogs : fallback.auditLogs,
    lastSyncAt: String(store.lastSyncAt || fallback.lastSyncAt),
    lastSyncStatus: store.lastSyncStatus,
    lastSyncResult: store.lastSyncResult,
    lastHistoryId: store.lastHistoryId,
    lastWatchRegisteredAt: store.lastWatchRegisteredAt,
    lastWatchRenewedAt: store.lastWatchRenewedAt,
    lastWatchError: store.lastWatchError,
    lastWatchTopic: store.lastWatchTopic,
    watchStatus: store.watchStatus,
    watchExpiration: store.watchExpiration,
    lastWebhookAt: store.lastWebhookAt,
    lastProcessingMs: store.lastProcessingMs
  };
}

function readStoreFromDisk(): RealtimeBookingStore {
  try {
    const raw = readFileSync(getStorePath(), "utf8");
    return normalizeStore(JSON.parse(raw) as Partial<RealtimeBookingStore>);
  } catch {
    return createDefaultStore();
  }
}

function writeStoreToDisk(store: RealtimeBookingStore) {
  mkdirSync(getDataDir(), { recursive: true });
  writeFileSync(getStorePath(), JSON.stringify(store, null, 2), "utf8");
}

function saveStore(store: RealtimeBookingStore) {
  const globalStore = globalThis as typeof globalThis & {
    [STORE_KEY]?: RealtimeBookingStore;
  };
  globalStore[STORE_KEY] = store;
  writeStoreToDisk(store);
  return store;
}

function getStore(): RealtimeBookingStore {
  const globalStore = globalThis as typeof globalThis & {
    [STORE_KEY]?: RealtimeBookingStore;
  };

  if (!globalStore[STORE_KEY]) {
    globalStore[STORE_KEY] = readStoreFromDisk();
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

export function getRealtimeBookingPriceTtlMinutes() {
  const minutes = Number(process.env.REALTIME_BOOKING_PRICE_TTL_MINUTES || 30);
  return Math.max(minutes, 1);
}

function getPriceMaxAgeMs() {
  return getRealtimeBookingPriceTtlMinutes() * 60 * 1000;
}

function resolveMatchedPriceForPlate(normalizedPlate: string) {
  const samePlatePrices = getStore().prices.filter((vehicle) => vehicle.normalizedPlate === normalizedPlate);
  const now = Date.now();
  const validPrices = samePlatePrices.filter((vehicle) => now - new Date(vehicle.receivedAt).getTime() <= getPriceMaxAgeMs());
  const latestValidPrice = [...validPrices].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0] || null;
  const newestPrice = [...samePlatePrices].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0] || null;
  return latestValidPrice || newestPrice || null;
}

export function getRealtimeBookingSubjectPatterns() {
  const raw = process.env.REALTIME_BOOKING_GMAIL_SUBJECT;
  const value = raw === undefined ? "Pricing and Status Update|Status Update|RT|ราคา" : raw;
  return value
    .split(/[,\n|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getRealtimeBookingSenderPatterns() {
  const raw = process.env.REALTIME_BOOKING_GMAIL_SENDER || process.env.REALTIME_BOOKING_GMAIL_SENDER_DOMAIN;
  const value = raw === undefined ? "sitinada.p@tgh.co.th|tgh.co.th|segroup.co.th" : raw;
  return value
    .split(/[,\n|]/)
    .map((item) => item.trim().toLowerCase())
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

export function isRealtimeBookingSenderAllowed(sender: string) {
  const patterns = getRealtimeBookingSenderPatterns();
  if (!patterns.length) return true;
  const normalizedSender = String(sender || "").toLowerCase();
  return patterns.some((pattern) => normalizedSender.includes(pattern));
}

export function listRealtimeQueue() {
  return [...getStore().waiting].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getRealtimeQueueItemById(id: string) {
  return getStore().waiting.find((item) => item.id === id) || null;
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
    mailLogs: store.mailLogs.slice(0, 20),
    auditLogs: store.auditLogs.slice(0, 20),
    watchStatus: store.watchStatus || "missing",
    watchExpiration: store.watchExpiration || "",
    lastHistoryId: store.lastHistoryId || "",
    lastWatchRegisteredAt: store.lastWatchRegisteredAt || "",
    lastWatchRenewedAt: store.lastWatchRenewedAt || "",
    lastWebhookAt: store.lastWebhookAt || "",
    lastProcessingMs: store.lastProcessingMs || 0,
    priceTtlMinutes: getRealtimeBookingPriceTtlMinutes()
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
    note: activeSamePlate ? `ทะเบียนนี้มีรายการก่อนแล้ว: ${activeSamePlate.saleName}` : input.note?.trim() || undefined,
    lineStatus: "not_sent"
  };

  store.waiting.unshift(item);

  if (!activeSamePlate) {
    void matchWaitingItem(item);
  }

  saveStore(store);
  return item;
}

export function retryWaitingQueueMatch(id: string) {
  const item = getRealtimeQueueItemById(id);
  if (!item) throw new Error("ไม่พบรายการนี้");
  if (item.status !== "WAITING") throw new Error("ลอง Match ใหม่ได้เฉพาะรายการ WAITING");

  return matchWaitingItem(item);
}

export function clearDuplicateQueuesByPlate(id: string) {
  const store = getStore();
  const item = store.waiting.find((queueItem) => queueItem.id === id);
  if (!item) throw new Error("ไม่พบรายการนี้");

  const normalizedPlate = item.normalizedPlate;
  const before = store.waiting.length;
  store.waiting = store.waiting.filter(
    (queueItem) => !(queueItem.normalizedPlate === normalizedPlate && queueItem.status === "DUPLICATED")
  );
  const removed = before - store.waiting.length;
  saveStore(store);
  return {
    plate: item.plate,
    normalizedPlate,
    removed
  };
}

export function markBooked(id: string) {
  const store = getStore();
  const item = store.waiting.find((queueItem) => queueItem.id === id);
  if (!item) throw new Error("ไม่พบรายการนี้");
  if (item.status !== "MATCHED") throw new Error("ต้องมีราคา RT ก่อนจึงจะปิดรายการได้");

  item.status = "BOOKED";
  item.bookedAt = new Date().toISOString();
  saveStore(store);
  return item;
}

export async function sendQueueLine(id: string, targetId: string) {
  const store = getStore();
  const item = store.waiting.find((queueItem) => queueItem.id === id);
  if (!item) throw new Error("ไม่พบรายการนี้");
  if (!targetId.trim()) throw new Error("ยังไม่ได้ตั้งค่ากลุ่ม LINE");
  if (!item.bookingText) throw new Error("ต้องมีราคา RT ก่อนจึงจะส่ง LINE ได้");
  if (item.lineStatus === "sent") throw new Error("รายการนี้ส่ง LINE แล้ว");

  const text = item.bookingText;

  try {
    await pushLineText(targetId, text);
    item.lineStatus = "sent";
    item.lineSentAt = new Date().toISOString();
    item.lineTargetId = targetId;
    item.lineError = "";
    item.lineSendError = "";
    item.autoSendStatus = item.autoSendStatus || "sent";
    saveStore(store);
    return item;
  } catch (error) {
    item.lineStatus = "failed";
    item.lineError = error instanceof Error ? error.message : "LINE send failed";
    item.lineSendError = item.lineError;
    saveStore(store);
    throw error;
  }
}

export function cancelQueue(id: string, reason = "") {
  const store = getStore();
  const item = store.waiting.find((queueItem) => queueItem.id === id);
  if (!item) throw new Error("ไม่พบรายการนี้");
  if (item.status === "BOOKED") throw new Error("รายการนี้ถูกปิดแล้ว ต้องให้ Admin ยกเลิก");
  if (item.status === "CANCELLED") return item;

  item.status = "CANCELLED";
  item.cancelledAt = new Date().toISOString();
  item.cancelReason = reason.trim() || "ยกเลิกโดยเซลส์";
  item.note = item.cancelReason;
  saveStore(store);
  return item;
}

function pushAuditLog(store: RealtimeBookingStore, debug: MatchDebugLog) {
  store.auditLogs.unshift(debug);
  store.auditLogs = store.auditLogs.slice(0, 200);
}

async function evaluateMatch(item: WaitingQueueItem) {
  const queuePlate = item.plate;
  const queueNormalizedPlate = item.normalizedPlate;
  const now = Date.now();
  const waitingAt = new Date(item.createdAt).getTime();
  const stockVehicle = await lookupStockByPlate(item.plate).catch(() => null);
  const stockFound = Boolean(stockVehicle);
  const stockSource = String(stockVehicle?.source || stockVehicle?.program || stockVehicle?.status || "");

  const matchedPrice = resolveMatchedPriceForPlate(queueNormalizedPlate);
  const pricePlate = matchedPrice?.plate || "";
  const priceNormalizedPlate = matchedPrice?.normalizedPlate || "";
  const receivedAt = matchedPrice?.receivedAt || "";
  const receivedAfterCreated = matchedPrice ? new Date(matchedPrice.receivedAt).getTime() >= waitingAt : false;
  const ttlValid = matchedPrice ? now - new Date(matchedPrice.receivedAt).getTime() <= getPriceMaxAgeMs() : false;
  const plateMatched = Boolean(matchedPrice && matchedPrice.normalizedPlate === queueNormalizedPlate);

  let reason = "no matching price row";
  let finalMatchResult: MatchDebugLog["finalMatchResult"] = "WAITING";
  if (!matchedPrice) {
    reason = "no price row for plate";
  } else if (!stockFound) {
    reason = "ไม่พบทะเบียนนี้ในสต็อกปัจจุบัน";
  } else if (!ttlValid) {
    reason = "price expired by TTL";
  } else if (!plateMatched) {
    reason = "normalized plate mismatch";
  } else if (receivedAfterCreated) {
    reason = "matched_by_latest_valid_price";
    finalMatchResult = "MATCHED";
  } else {
    reason = "matched_by_latest_valid_price_before_queue";
    finalMatchResult = "MATCHED";
  }

  if (!matchedPrice) {
    finalMatchResult = "WAITING";
  } else if (!stockFound) {
    finalMatchResult = "WAITING";
  } else if (!ttlValid) {
    finalMatchResult = "WAITING";
  } else if (!plateMatched) {
    finalMatchResult = "WAITING";
  } else {
    finalMatchResult = "MATCHED";
  }

  const debug: MatchDebugLog = {
    id: `MD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    queuePlate,
    queueNormalizedPlate,
    pricePlate,
    priceNormalizedPlate,
    plateMatched,
    receivedAt,
    createdAt: item.createdAt,
    receivedAfterCreated,
    ttlValid,
    stockFound,
    stockSource,
    stockRecord: stockVehicle ? {
      plate: stockVehicle.plate,
      source: stockVehicle.source,
      program: stockVehicle.program,
      status: stockVehicle.status,
      salePrice: stockVehicle.salePrice
    } : null,
    finalMatchResult,
    reason
  };

  return { price: matchedPrice, debug };
}

export async function inspectRealtimeBookingMatch(plate: string): Promise<MatchDebugSnapshot> {
  const normalizedPlate = normalizePlate(plate);
  const stockVehicle = await lookupStockByPlate(plate).catch(() => null);
  const stockFound = Boolean(stockVehicle);
  const stockSource = String(stockVehicle?.source || stockVehicle?.program || stockVehicle?.status || "");
  const stockRecord = stockVehicle ? {
    plate: stockVehicle.plate,
    source: stockVehicle.source,
    program: stockVehicle.program,
    status: stockVehicle.status,
    salePrice: stockVehicle.salePrice
  } : null;

  const matchedPrice = resolveMatchedPriceForPlate(normalizedPlate);
  const priceFound = Boolean(matchedPrice);
  const matchedPricePlate = matchedPrice?.plate || "";
  const normalizedMatchedPricePlate = matchedPrice?.normalizedPlate || "";
  const ttlValid = matchedPrice ? Date.now() - new Date(matchedPrice.receivedAt).getTime() <= getPriceMaxAgeMs() : false;
  const waitingItem = getStore().waiting.find((item) => item.normalizedPlate === normalizedPlate && item.status === "WAITING") || null;
  const waitingFound = Boolean(waitingItem);
  const finalMatchResult = Boolean(waitingItem && stockFound && priceFound && ttlValid && normalizedMatchedPricePlate === normalizedPlate);
  const reason = !stockFound
    ? "ไม่พบทะเบียนนี้ในสต็อกปัจจุบัน"
    : !priceFound
      ? "no price row for plate"
      : !ttlValid
        ? "price expired by TTL"
        : !waitingFound
          ? "ไม่มี WAITING queue สำหรับทะเบียนนี้"
          : finalMatchResult
            ? "matched_by_latest_valid_price"
            : "normalized plate mismatch";

  return {
    plate,
    normalizedPlate,
    stockFound,
    stockSource,
    stockRecord,
    priceFound,
    matchedPricePlate,
    normalizedMatchedPricePlate,
    ttlValid,
    waitingFound,
    waitingItem,
    finalMatchResult,
    reason
  };
}

export async function ingestVehiclePrices(input: {
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

  const validSubject = isRealtimeBookingSubjectAllowed(input.subject) || isRealtimeBookingSenderAllowed(input.sender);

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
    saveStore(store);
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
    if (item.status === "WAITING" && (await matchWaitingItem(item))) {
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
  store.lastSyncStatus = "parsed";
  store.lastSyncResult = `matched=${matchedCount};checked=${incoming.length}`;
  saveStore(store);
  return parsed;
}

async function matchWaitingItem(item: WaitingQueueItem) {
  const store = getStore();
  const { price, debug } = await evaluateMatch(item);

  item.matchDebug = debug;
  pushAuditLog(store, debug);
  console.log("MATCH_DECISION", {
    queuePlate: debug.queuePlate,
    normalizedQueuePlate: debug.queueNormalizedPlate,
    matchedPricePlate: debug.pricePlate,
    stockFound: debug.stockFound,
    stockSource: debug.stockSource,
    stockRecord: debug.stockRecord,
    ttlValid: debug.ttlValid,
    finalMatchResult: debug.finalMatchResult,
    reason: debug.reason
  });

  if (!price) return false;
  if (!debug.stockFound || !debug.plateMatched || !debug.ttlValid) return false;

  item.status = "MATCHED";
  item.matchedAt = new Date().toISOString();
  item.rtPrice = price.rtPrice;
  item.finalPrice = Math.max(price.rtPrice - Number(item.discount || 0), 0);
  item.bookingText = generateBookingText(item);
  saveStore(store);
  return true;
}

export function generateBookingText(item: WaitingQueueItem) {
  const rtPrice = Number(item.rtPrice || 0);
  const finalPrice = Number(item.finalPrice || Math.max(rtPrice - Number(item.discount || 0), 0));
  const paymentText = item.paymentType === "finance" ? "ไฟแนนซ์" : "เงินสด";
  const discount = Number(item.discount || 0);
  const lines = [
    `ชื่อ-นามสกุล : ${item.customerName}`,
    `ทะเบียนรถ : ${item.plate}`,
    `ราคามาตรฐาน : ${formatMoney(rtPrice)}`,
    `ราคาตั้งขาย : ${formatMoney(finalPrice)}`
  ];

  if (item.note?.trim()) {
    lines.push(`หมายเหตุ : ${item.note.trim()}`);
  }

  if (discount > 0) {
    lines.push(`ลด ${formatMoney(discount)} (จากส่วนกลาง)`);
  }

  lines.push("", `ช่องทางชำระเงิน : ${paymentText}`, `เซลส์เจ้าของเคส : ${item.saleName}`);
  return lines.join("\n");
}
