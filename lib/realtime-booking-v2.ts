import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";

import { lookupStockByPlateDetailed } from "@/lib/apps-script";
import { pushLineText } from "@/lib/line";
import { formatRealtimeBookingV2LineText } from "@/lib/realtime-booking-v2-format";

export type RealtimeBookingV2QueueStatus = "WAITING" | "MATCHED" | "BOOKED" | "CANCELLED";

export type RealtimeBookingV2QueueItem = {
  id: string;
  plate: string;
  normalizedPlate: string;
  customerName: string;
  saleName: string;
  paymentType: "cash" | "finance";
  discount: number;
  remark?: string;
  status: RealtimeBookingV2QueueStatus;
  createdAt: string;
  matchedAt?: string;
  bookedAt?: string;
  bookingConfirmedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  bookingText?: string;
  lineStatus?: "not_sent" | "sent" | "failed";
  lineSentAt?: string;
  lineError?: string;
  lineTargetId?: string;
  matchReason?: string;
  stockFound?: boolean;
  stockSource?: string;
  pricePlate?: string;
  priceReceivedAt?: string;
  rtPrice?: number;
  priceSourceType?: "RT";
  ttlValid?: boolean;
  autoSendAttemptedAt?: string;
  autoSendStatus?: "pending" | "sent" | "failed";
  autoSendError?: string;
};

export type RealtimeBookingV2PriceRow = {
  plate: string;
  normalizedPlate: string;
  receivedAt: string;
  rtPrice: number;
  source?: string;
  sourceType?: "RT";
  mailSubject?: string;
  sheetName?: string;
  parsedAt?: string;
};

export type RealtimeBookingV2MailLog = {
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

export type RealtimeBookingV2Store = {
  sequence: number;
  queue: RealtimeBookingV2QueueItem[];
  prices: RealtimeBookingV2PriceRow[];
  mailLogs: RealtimeBookingV2MailLog[];
  lastUpdatedAt: string;
};

export type RealtimeBookingV2Dashboard = {
  queue: RealtimeBookingV2QueueItem[];
  waiting: number;
  matched: number;
  booked: number;
  prices: RealtimeBookingV2PriceRow[];
  lastUpdatedAt: string;
  ttlMinutes: number;
};

const STORE_FILE_NAME = "realtime-booking-v2.json";
const STORE_KEY = "__BIG_CAR_REALTIME_BOOKING_V2_STORE__";
const plateAliases = ["ทะเบียน", "ทะเบียนรถ", "plate", "licenseplate", "regno", "เลขทะเบียน"];
const priceAliases = ["ราคาrt", "ราคาเสนอขายrt", "ราคามาตรฐาน", "rtprice", "price", "ราคาขาย", "ราคา"];

function dataDir() {
  return process.env.BIG_CAR_DATA_DIR
    ? path.resolve(process.env.BIG_CAR_DATA_DIR)
    : path.join(process.cwd(), ".data");
}

function storePath() {
  return path.join(dataDir(), STORE_FILE_NAME);
}

function normalizePlate(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function ttlMinutes() {
  const minutes = Number(process.env.REALTIME_BOOKING_PRICE_TTL_MINUTES || 180);
  return Math.max(minutes || 180, 1);
}

function ttlMs() {
  return ttlMinutes() * 60 * 1000;
}

function ignoreTtlInDev() {
  return process.env.NODE_ENV !== "production" && String(process.env.REALTIME_BOOKING_V2_IGNORE_TTL_IN_DEV || "").toLowerCase() === "true";
}

function gmailUser() {
  return process.env.GMAIL_USER_EMAIL || "me";
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function normalizeHeader(value: string) {
  return String(value || "").toLowerCase().replace(/\s+/g, "").replace(/[()/_\-.]/g, "");
}

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function money(value: unknown) {
  const n = Number(cell(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function decodeBase64Url(data: string) {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function headerValue(message: { payload?: { headers?: Array<{ name: string; value: string }> } }, name: string) {
  return String(message.payload?.headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value || "");
}

function collectParts(parts: Array<any> = [], out: Array<any> = []) {
  for (const part of parts) {
    if (part.filename && (part.body?.attachmentId || part.body?.data)) out.push(part);
    if (part.parts?.length) collectParts(part.parts, out);
  }
  return out;
}

function isRealtimeBookingSubjectAllowed(subject: string) {
  const patterns = String(process.env.REALTIME_BOOKING_GMAIL_SUBJECT || "Pricing and Status Update|Status Update|RT|ราคา")
    .split(/[,\n|]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const normalized = subject.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern.toLowerCase()));
}

function isDelayPriceSubject(subject: string) {
  const normalized = subject.toLowerCase();
  return [
    "delay 7 days",
    "rt price delay",
    "pricing delay",
    "delay7days",
    "delay"
  ].some((pattern) => normalized.includes(pattern.toLowerCase()));
}

function isDelayPriceRecord(input: { mailSubject?: string; subject?: string; sheetName?: string; sourceType?: string }) {
  const values = [input.mailSubject, input.subject, input.sheetName]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return (
    input.sourceType !== undefined && input.sourceType !== "RT"
  ) || isDelayPriceSubject(values);
}

function isRealtimeBookingSenderAllowed(sender: string) {
  const patterns = String(
    process.env.REALTIME_BOOKING_V2_GMAIL_SENDER_WHITELIST ||
      process.env.REALTIME_BOOKING_GMAIL_SENDER ||
      process.env.REALTIME_BOOKING_GMAIL_SENDER_DOMAIN ||
      "Sirinada.p@tgh.co.th"
  )
    .split(/[,\n|]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const normalized = sender.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern));
}

async function getAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GMAIL_CLIENT_ID"),
      client_secret: requiredEnv("GMAIL_CLIENT_SECRET"),
      refresh_token: requiredEnv("GMAIL_REFRESH_TOKEN"),
      grant_type: "refresh_token"
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Gmail token refresh failed: ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Gmail token response missing access_token");
  return data.access_token;
}

async function gmailFetch<T>(path: string, token: string) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(gmailUser())}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Gmail API failed: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

function parseWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const bestRows: Array<{ plate: string; rtPrice: number; sheetName: string }> = [];

  for (const sheetName of workbook.SheetNames) {
    if (isDelayPriceSubject(sheetName)) continue;
    const sheet = workbook.Sheets[sheetName];
    for (let headerRow = 0; headerRow < 10; headerRow += 1) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        range: headerRow
      });
      if (!rows.length) continue;

      const headers = Object.keys(rows[0] || {});
      const plateHeader = headers.find((header) => plateAliases.some((alias) => normalizeHeader(header) === normalizeHeader(alias)));
      const priceHeader = headers.find((header) => priceAliases.some((alias) => normalizeHeader(header) === normalizeHeader(alias)));
      if (!plateHeader || !priceHeader) continue;

      const parsed = rows
        .map((row) => ({
          plate: cell(row[plateHeader]),
          rtPrice: money(row[priceHeader]),
          sheetName
        }))
        .filter((row) => row.plate && row.rtPrice > 0);

      if (parsed.length > bestRows.length) {
        bestRows.splice(0, bestRows.length, ...parsed);
      }
    }
  }

  return bestRows;
}

async function downloadAttachment(token: string, messageId: string, part: any) {
  if (part.body?.data) return decodeBase64Url(part.body.data);

  const attachmentId = part.body?.attachmentId;
  if (!attachmentId) return Buffer.from("");

  const attachment = await gmailFetch<{ data?: string }>(
    `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    token
  );
  return attachment.data ? decodeBase64Url(attachment.data) : Buffer.from("");
}

function createDefaultStore(): RealtimeBookingV2Store {
  return {
    sequence: 0,
    queue: [],
    prices: [],
    mailLogs: [],
    lastUpdatedAt: new Date().toISOString()
  };
}

function normalizeStore(store: Partial<RealtimeBookingV2Store> | null | undefined): RealtimeBookingV2Store {
  const fallback = createDefaultStore();
  if (!store) return fallback;
  const queue = Array.isArray(store.queue) ? store.queue : fallback.queue;
  const prices = Array.isArray(store.prices)
    ? store.prices
        .filter((row) => !isDelayPriceRecord(row))
        .map((row) => ({ ...row, sourceType: "RT" as const }))
    : fallback.prices;
  const mailLogs = Array.isArray((store as RealtimeBookingV2Store).mailLogs)
    ? (store as RealtimeBookingV2Store).mailLogs.filter((log) => !isDelayPriceRecord(log))
    : fallback.mailLogs;

  return {
    sequence: Number(store.sequence || 0),
    queue,
    prices,
    mailLogs,
    lastUpdatedAt: String(store.lastUpdatedAt || fallback.lastUpdatedAt)
  };
}

function readStore(): RealtimeBookingV2Store {
  try {
    const raw = readFileSync(storePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<RealtimeBookingV2Store>;
    const normalized = normalizeStore(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      writeStore(normalized);
    }
    return normalized;
  } catch {
    return createDefaultStore();
  }
}

function writeStore(store: RealtimeBookingV2Store) {
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(storePath(), JSON.stringify(store, null, 2), "utf8");
  (globalThis as typeof globalThis & { [STORE_KEY]?: RealtimeBookingV2Store })[STORE_KEY] = store;
  return store;
}

function getStore() {
  const globalStore = globalThis as typeof globalThis & { [STORE_KEY]?: RealtimeBookingV2Store };
  if (!globalStore[STORE_KEY]) {
    globalStore[STORE_KEY] = readStore();
  }
  return globalStore[STORE_KEY];
}

function saveStore(store: RealtimeBookingV2Store) {
  store.lastUpdatedAt = new Date().toISOString();
  return writeStore(store);
}

function latestPriceForPlate(normalizedPlate: string) {
  const store = getStore();
  const samePlate = store.prices.filter((row) => row.normalizedPlate === normalizedPlate);
  if (!samePlate.length) return null;
  return [...samePlate].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0] || null;
}

async function ingestV2Prices(input: {
  subject: string;
  sender: string;
  recipient: string;
  receivedAt?: string;
  rows: Array<{ plate: string; rtPrice: number; sheetName?: string; sourceType?: "RT" }>;
}) {
  const start = Date.now();
  const store = getStore();
  const receivedAt = input.receivedAt || new Date().toISOString();
  const parsedAt = new Date().toISOString();

  const incoming = input.rows
    .map((row) => ({
      plate: String(row.plate || "").trim(),
      normalizedPlate: normalizePlate(row.plate),
      rtPrice: Number(row.rtPrice || 0),
      source: "gmail",
      sourceType: "RT" as const,
      mailSubject: input.subject,
      sheetName: String(row.sheetName || "").trim() || undefined,
      receivedAt,
      parsedAt
    }))
    .filter((row) => row.normalizedPlate && row.rtPrice > 0 && row.sourceType === "RT");

  for (const row of incoming) {
    const existingIndex = store.prices.findIndex((item) => item.normalizedPlate === row.normalizedPlate);
    if (existingIndex >= 0) {
      store.prices[existingIndex] = row;
    } else {
      store.prices.unshift(row);
    }
  }

  let matchedCount = 0;
  for (const item of store.queue) {
    if (item.status === "WAITING") {
      const result = await matchQueueItem(item);
      if (result.finalMatchResult) matchedCount += 1;
    }
  }

  const log: RealtimeBookingV2MailLog = {
    id: `ML-${Date.now()}`,
    subject: input.subject,
    sender: input.sender,
    recipient: input.recipient,
    receivedAt,
    status: incoming.length ? "PARSED" : "IGNORED",
    vehicleCount: incoming.length,
    matchedCount,
    durationMs: Date.now() - start
  };

  store.mailLogs.unshift(log);
  saveStore(store);
  return log;
}

async function matchQueueItem(item: RealtimeBookingV2QueueItem) {
  const stock = await lookupStockByPlateDetailed(item.plate).catch(() => null);
  const stockFound = Boolean(stock?.vehicle);
  const stockSource = String(stock?.debug?.endpointUsed || stock?.vehicle?.source || stock?.vehicle?.program || stock?.vehicle?.status || "");
  const price = latestPriceForPlate(item.normalizedPlate);
  const ttlValid = ignoreTtlInDev() ? Boolean(price) : Boolean(price) && Date.now() - new Date(price!.receivedAt).getTime() <= ttlMs();
  const finalMatchResult = Boolean(stockFound && price && ttlValid);
  const reason = !stockFound
    ? "ไม่พบทะเบียนนี้ในสต็อกปัจจุบัน"
    : !price
      ? "ไม่มีราคา RT ของทะเบียนนี้"
      : !ttlValid
        ? "ราคา RT หมดอายุ กรุณา Sync Gmail ใหม่"
        : "matched";

  item.stockFound = stockFound;
  item.stockSource = stockSource;
  item.pricePlate = price?.plate || "";
  item.priceReceivedAt = price?.receivedAt || "";
  item.rtPrice = price?.rtPrice;
  item.priceSourceType = price?.sourceType || "RT";
  item.ttlValid = ttlValid;
  item.matchReason = reason;

  if (finalMatchResult) {
    item.status = "MATCHED";
    item.matchedAt = new Date().toISOString();
  }

  return { finalMatchResult, reason, stockFound, stockSource, price, ttlValid };
}

async function tryMatchAllWaiting() {
  const store = getStore();
  let matchedCount = 0;
  for (const item of store.queue) {
    if (item.status === "WAITING") {
      const result = await matchQueueItem(item);
      if (result.finalMatchResult) matchedCount += 1;
    }
  }
  saveStore(store);
  return matchedCount;
}

export async function syncRealtimeBookingV2FromGmail(input: { query?: string; maxResults?: number } = {}) {
  const token = await getAccessToken();
  const query = input.query || "newer_than:14d has:attachment";
  const maxResults = Math.min(Math.max(input.maxResults || 20, 1), 20);
  const list = await gmailFetch<{ messages?: Array<{ id: string; threadId: string }> }>(`/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`, token);
  const messageIds = list.messages || [];
  const processed: Array<Record<string, unknown>> = [];
  const skipped: Array<Record<string, unknown>> = [];
  let skippedDelayCount = 0;
  let skippedSenderCount = 0;
  let attachmentsFound = 0;
  let parsedRows = 0;
  let ingestedPrices = 0;
  let matchedCount = 0;

  for (const summary of messageIds) {
    const message = await gmailFetch<{ id: string; internalDate?: string; payload?: { headers?: Array<{ name: string; value: string }>; parts?: Array<any> } }>(`/messages/${encodeURIComponent(summary.id)}?format=full`, token);
    const subject = headerValue(message, "Subject");
    const sender = headerValue(message, "From");
    const recipient = [headerValue(message, "To"), headerValue(message, "Cc")].join(" ");
    const recipientContains = process.env.REALTIME_BOOKING_GMAIL_RECIPIENT_CONTAINS || "";
    const delaySubject = isDelayPriceSubject(subject);
    const subjectAllowed = isRealtimeBookingSubjectAllowed(subject);
    const senderAllowed = isRealtimeBookingSenderAllowed(sender);

    if (delaySubject) {
      skippedDelayCount += 1;
      skipped.push({ messageId: message.id, subject, sender, reason: "excluded delay price email" });
      continue;
    }

    if (!senderAllowed) {
      skippedSenderCount += 1;
      skipped.push({ messageId: message.id, subject, sender, reason: "sender not allowed" });
      continue;
    }

    if (!subjectAllowed || (recipientContains && !recipient.toLowerCase().includes(recipientContains.toLowerCase()))) {
      skipped.push({ messageId: message.id, subject, sender, reason: "subject/sender/recipient not allowed" });
      continue;
    }

    const receivedAt = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : new Date().toISOString();
    let sawAttachment = false;

    for (const part of collectParts(message.payload?.parts || [])) {
      const filename = String(part.filename || "");
      if (!/\.(xlsx|xls|csv)$/i.test(filename)) continue;
      sawAttachment = true;
      attachmentsFound += 1;

      const buffer = await downloadAttachment(token, message.id, part);
      const rows = parseWorkbook(buffer);
      if (!rows.length) continue;
      parsedRows += rows.length;

      const log = await ingestV2Prices({
        subject,
        sender,
        recipient,
        receivedAt,
        rows
      });
      ingestedPrices += rows.length;
      matchedCount += log.matchedCount;
      processed.push({ messageId: message.id, subject, sender, receivedAt, filename, rowCount: rows.length, log });
    }

    if (!sawAttachment) {
      processed.push({ messageId: message.id, subject, sender, receivedAt, filename: "", rowCount: 0, skipped: "No Excel/CSV attachment" });
    }
  }

  return {
    ok: true,
    query,
    checked: messageIds.length,
    processed,
    skipped,
    skippedSenderCount,
    skippedDelayCount,
    attachmentsFound,
    parsedRows,
    ingestedPrices,
    matchedCount
  };
}

export function getRealtimeBookingV2Dashboard(): RealtimeBookingV2Dashboard {
  const store = getStore();
  return {
    queue: [...store.queue].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    waiting: store.queue.filter((item) => item.status === "WAITING").length,
    matched: store.queue.filter((item) => item.status === "MATCHED").length,
    booked: store.queue.filter((item) => item.status === "BOOKED").length,
    prices: [...store.prices].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
    lastUpdatedAt: store.lastUpdatedAt,
    ttlMinutes: ttlMinutes()
  };
}

export function createRealtimeBookingV2Queue(input: { plate: string; customerName: string; paymentType?: "cash" | "finance"; saleName?: string; remark?: string; discount?: number }) {
  const plate = String(input.plate || "").trim();
  const customerName = String(input.customerName || "").trim();
  if (!plate) throw new Error("กรุณากรอกทะเบียนรถ");
  if (!customerName) throw new Error("กรุณากรอกชื่อลูกค้า");

  const store = getStore();
  store.sequence += 1;
  const item: RealtimeBookingV2QueueItem = {
    id: `RB2-${Date.now()}-${store.sequence}`,
    plate,
    normalizedPlate: normalizePlate(plate),
    customerName,
    saleName: String(input.saleName || "บิ๊ก").trim() || "บิ๊ก",
    paymentType: input.paymentType === "cash" ? "cash" : "finance",
    discount: Number(input.discount || 0) > 0 ? Math.round(Number(input.discount || 0)) : 0,
    remark: String(input.remark || "").trim(),
    status: "WAITING",
    createdAt: new Date().toISOString(),
    lineStatus: "not_sent"
  };

  store.queue.unshift(item);
  saveStore(store);
  void matchQueueItem(item).then(() => saveStore(store));
  return item;
}

export async function simulateRealtimeBookingV2Price(input: { plate?: string; rtPrice: number; ignoreTtl?: boolean }) {
  const store = getStore();
  const waitingPlate = [...store.queue].find((item) => item.status === "WAITING")?.plate || String(input.plate || "").trim();
  const normalizedPlate = normalizePlate(waitingPlate);
  if (!normalizedPlate) throw new Error("กรุณากรอกทะเบียนรถ");

  const row: RealtimeBookingV2PriceRow = {
    plate: waitingPlate,
    normalizedPlate,
    receivedAt: new Date().toISOString(),
    rtPrice: Number(input.rtPrice || 0),
    sourceType: "RT"
  };

  if (!row.rtPrice || row.rtPrice <= 0) throw new Error("กรุณากรอกราคา RT");

  const previousIgnoreTtl = process.env.REALTIME_BOOKING_V2_IGNORE_TTL_IN_DEV;
  if (input.ignoreTtl && process.env.NODE_ENV !== "production") {
    process.env.REALTIME_BOOKING_V2_IGNORE_TTL_IN_DEV = "true";
  }

  const existingIndex = store.prices.findIndex((item) => item.normalizedPlate === row.normalizedPlate);
  if (existingIndex >= 0) {
    store.prices[existingIndex] = row;
  } else {
    store.prices.unshift(row);
  }

  const matchedCount = await tryMatchAllWaiting();
  if (input.ignoreTtl && process.env.NODE_ENV !== "production") {
    if (previousIgnoreTtl === undefined) {
      delete process.env.REALTIME_BOOKING_V2_IGNORE_TTL_IN_DEV;
    } else {
      process.env.REALTIME_BOOKING_V2_IGNORE_TTL_IN_DEV = previousIgnoreTtl;
    }
  }
  saveStore(store);

  const matchedItem = store.queue.find((item) => item.normalizedPlate === normalizedPlate && item.status === "MATCHED") || null;
  return {
    price: row,
    matchedCount,
    matchedItem
  };
}

export function updateRealtimeBookingV2Item(id: string, input: Partial<Pick<RealtimeBookingV2QueueItem, "paymentType" | "saleName" | "remark" | "discount">>) {
  const store = getStore();
  const item = store.queue.find((queueItem) => queueItem.id === id);
  if (!item) throw new Error("ไม่พบรายการนี้");
  if (typeof input.paymentType === "string") {
    item.paymentType = input.paymentType === "cash" ? "cash" : "finance";
  }
  if (typeof input.saleName === "string") {
    item.saleName = String(input.saleName || "").trim() || "บิ๊ก";
  }
  if (typeof input.remark === "string") {
    item.remark = String(input.remark || "").trim();
  }
  if (typeof input.discount === "number") {
    item.discount = Number.isFinite(input.discount) && input.discount > 0 ? Math.round(input.discount) : 0;
  }
  item.bookingText = formatRealtimeBookingV2LineText(item);
  saveStore(store);
  return item;
}

export async function sendRealtimeBookingV2Line(
  id: string,
  targetId: string,
  input: Partial<Pick<RealtimeBookingV2QueueItem, "paymentType" | "saleName" | "remark" | "discount">> & { autoSend?: boolean } = {}
) {
  const store = getStore();
  const item = store.queue.find((queueItem) => queueItem.id === id);
  if (!item) throw new Error("ไม่พบรายการนี้");
  if (!targetId.trim()) throw new Error("กรุณาระบุ target LINE");
  if (item.status !== "MATCHED") throw new Error("ต้องเป็นรายการ MATCHED ก่อน");
  if (item.lineStatus === "sent") throw new Error("รายการนี้ถูกส่งแล้ว");
  if (input.autoSend && item.autoSendAttemptedAt && item.autoSendStatus === "pending") {
    throw new Error("กำลังส่ง LINE อัตโนมัติอยู่");
  }
  if (input.autoSend && item.autoSendStatus === "sent") {
    throw new Error("รายการนี้ส่ง LINE อัตโนมัติแล้ว");
  }

  if (input.autoSend) {
    item.autoSendAttemptedAt = new Date().toISOString();
    item.autoSendStatus = "pending";
    item.autoSendError = "";
    saveStore(store);
  }

  updateRealtimeBookingV2Item(id, input);
  item.bookingText = formatRealtimeBookingV2LineText(item);

  try {
    await pushLineText(targetId, item.bookingText);
    item.lineStatus = "sent";
    item.lineSentAt = new Date().toISOString();
    item.lineTargetId = targetId;
    item.status = "BOOKED";
    item.bookedAt = new Date().toISOString();
    if (input.autoSend) {
      item.autoSendStatus = "sent";
    }
    saveStore(store);
    return item;
  } catch (error) {
    item.lineStatus = "failed";
    item.lineError = error instanceof Error ? error.message : "LINE send failed";
    if (input.autoSend) {
      item.autoSendStatus = "failed";
      item.autoSendError = item.lineError;
    }
    saveStore(store);
    throw error;
  }
}

export function confirmRealtimeBookingV2Booking(id: string) {
  const store = getStore();
  const item = store.queue.find((queueItem) => queueItem.id === id);
  if (!item) throw new Error("ไม่พบรายการนี้");
  if (item.status !== "BOOKED" || item.lineStatus !== "sent") {
    throw new Error("ต้องเป็นรายการที่ส่ง LINE สำเร็จก่อน");
  }
  item.bookingConfirmedAt = new Date().toISOString();
  saveStore(store);
  return item;
}

export function cancelRealtimeBookingV2Queue(id: string, reason?: string) {
  const store = getStore();
  const item = store.queue.find((queueItem) => queueItem.id === id);
  if (!item) throw new Error("ไม่พบรายการนี้");
  if (item.status === "BOOKED" && item.lineStatus === "sent" && !item.bookingConfirmedAt) {
    throw new Error("ส่ง LINE แล้ว กรุณากดส่งจองสำเร็จก่อน");
  }
  if (item.status === "CANCELLED") return item;
  item.status = "CANCELLED";
  item.cancelledAt = new Date().toISOString();
  item.cancelReason = String(reason || "ยกเลิกโดยผู้ใช้").trim();
  saveStore(store);
  return item;
}

export function getRealtimeBookingV2StockHint() {
  return {
    ttlMinutes: ttlMinutes(),
    storeFile: STORE_FILE_NAME
  };
}
