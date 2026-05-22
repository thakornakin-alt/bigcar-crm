import * as XLSX from "xlsx";
import { ingestVehiclePrices } from "@/lib/realtime-booking";

type GmailMessageList = {
  messages?: Array<{ id: string; threadId: string }>;
};

type GmailMessagePart = {
  filename?: string;
  mimeType?: string;
  body?: {
    data?: string;
    attachmentId?: string;
  };
  parts?: GmailMessagePart[];
};

type GmailMessage = {
  id: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    parts?: GmailMessagePart[];
  };
};

type ParsedAttachment = {
  filename: string;
  rowCount: number;
  rows: Array<{ plate: string; rtPrice: number }>;
};

const plateAliases = ["ทะเบียน", "ทะเบียนรถ", "plate", "licenseplate", "regno", "เลขทะเบียน"];
const priceAliases = ["ราคาrt", "ราคาเสนอขายrt", "ราคามาตรฐาน", "rtprice", "price", "ราคาขาย", "ราคา"];

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

function headerValue(message: GmailMessage, name: string) {
  return String(message.payload?.headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value || "");
}

function collectParts(parts: GmailMessagePart[] = [], out: GmailMessagePart[] = []) {
  for (const part of parts) {
    if (part.filename && (part.body?.attachmentId || part.body?.data)) out.push(part);
    if (part.parts?.length) collectParts(part.parts, out);
  }
  return out;
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

function isAllowedMessage(message: GmailMessage) {
  const subject = headerValue(message, "Subject");
  const from = headerValue(message, "From");
  const to = [headerValue(message, "To"), headerValue(message, "Cc")].join(" ");
  const subjectPattern = process.env.REALTIME_BOOKING_GMAIL_SUBJECT || "Pricing and Status Update";
  const senderDomain = process.env.REALTIME_BOOKING_GMAIL_SENDER_DOMAIN || "";
  const recipientContains = process.env.REALTIME_BOOKING_GMAIL_RECIPIENT_CONTAINS || "";

  if (!subject.toLowerCase().includes(subjectPattern.toLowerCase())) return false;
  if (senderDomain && !from.toLowerCase().includes(senderDomain.toLowerCase())) return false;
  if (recipientContains && !to.toLowerCase().includes(recipientContains.toLowerCase())) return false;
  return true;
}

function parseWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const bestRows: Array<{ plate: string; rtPrice: number }> = [];

  for (const sheetName of workbook.SheetNames) {
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
          rtPrice: money(row[priceHeader])
        }))
        .filter((row) => row.plate && row.rtPrice > 0);

      if (parsed.length > bestRows.length) {
        bestRows.splice(0, bestRows.length, ...parsed);
      }
    }
  }

  return bestRows;
}

async function downloadAttachment(token: string, messageId: string, part: GmailMessagePart) {
  if (part.body?.data) return decodeBase64Url(part.body.data);

  const attachmentId = part.body?.attachmentId;
  if (!attachmentId) return Buffer.from("");

  const attachment = await gmailFetch<{ data?: string }>(
    `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    token
  );
  return attachment.data ? decodeBase64Url(attachment.data) : Buffer.from("");
}

export async function syncRealtimeBookingFromGmail(input: { query?: string; maxResults?: number } = {}) {
  const token = await getAccessToken();
  const query =
    input.query ||
    `subject:"${process.env.REALTIME_BOOKING_GMAIL_SUBJECT || "Pricing and Status Update"}" newer_than:1d has:attachment`;
  const maxResults = Math.min(Math.max(input.maxResults || 5, 1), 20);
  const list = await gmailFetch<GmailMessageList>(`/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`, token);
  const messageIds = list.messages || [];

  const processed = [];

  for (const summary of messageIds) {
    const message = await gmailFetch<GmailMessage>(`/messages/${encodeURIComponent(summary.id)}?format=full`, token);
    if (!isAllowedMessage(message)) continue;

    const subject = headerValue(message, "Subject");
    const sender = headerValue(message, "From");
    const recipient = [headerValue(message, "To"), headerValue(message, "Cc")].filter(Boolean).join(", ");
    const receivedAt = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : new Date().toISOString();
    const attachments: ParsedAttachment[] = [];

    for (const part of collectParts(message.payload?.parts || [])) {
      const filename = String(part.filename || "");
      if (!/\.(xlsx|xls|csv)$/i.test(filename)) continue;

      const buffer = await downloadAttachment(token, message.id, part);
      const rows = parseWorkbook(buffer);
      attachments.push({ filename, rowCount: rows.length, rows });

      if (rows.length) {
        const log = ingestVehiclePrices({
          subject,
          sender,
          recipient,
          receivedAt,
          rows
        });
        processed.push({ messageId: message.id, subject, sender, receivedAt, filename, rowCount: rows.length, log });
      }
    }

    if (!attachments.length) {
      processed.push({ messageId: message.id, subject, sender, receivedAt, filename: "", rowCount: 0, skipped: "No Excel/CSV attachment" });
    }
  }

  return {
    ok: true,
    query,
    checked: messageIds.length,
    processed
  };
}
