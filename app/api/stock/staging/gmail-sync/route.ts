import { NextResponse } from "next/server";
import { createStockStagingItem } from "@/lib/stock-staging";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GmailMessageList = { messages?: Array<{ id: string }> };
type GmailMessagePart = { filename?: string; body?: { data?: string; attachmentId?: string }; parts?: GmailMessagePart[] };
type GmailMessage = {
  id: string;
  internalDate?: string;
  payload?: { headers?: Array<{ name: string; value: string }>; parts?: GmailMessagePart[] };
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function gmailUser() {
  return process.env.GMAIL_USER_EMAIL || "me";
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

  if (!response.ok) throw new Error(`Gmail token refresh failed: ${await response.text()}`);
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error("Gmail token response missing access_token");
  return data.access_token;
}

async function gmailFetch<T>(path: string, token: string) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(gmailUser())}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Gmail API failed: ${await response.text()}`);
  return await response.json() as T;
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

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = await getAccessToken();
    const query = String(body.query || 'newer_than:2d has:attachment (Pricing OR Pricig OR "Status Update" OR "New Format")');
    const maxResults = Math.min(Math.max(Number(body.maxResults || 10), 1), 20);
    const list = await gmailFetch<GmailMessageList>(`/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`, token);
    const created = [];
    const skipped = [];

    for (const summary of list.messages || []) {
      const message = await gmailFetch<GmailMessage>(`/messages/${encodeURIComponent(summary.id)}?format=full`, token);
      const subject = headerValue(message, "Subject");
      const sender = headerValue(message, "From");
      const emailTime = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : new Date().toISOString();
      let attachmentCount = 0;

      for (const part of collectParts(message.payload?.parts || [])) {
        const fileName = String(part.filename || "");
        if (!/\.(xlsx|xls|csv)$/i.test(fileName)) continue;
        attachmentCount += 1;
        const item = await createStockStagingItem({
          bytes: await downloadAttachment(token, message.id, part),
          fileName,
          subject,
          sender,
          emailTime,
          source: "gmail"
        });
        created.push({ id: item.id, fileName: item.fileName, status: item.status, totalCars: item.totalCars, subject, sender });
      }

      if (!attachmentCount) skipped.push({ messageId: message.id, subject, sender, reason: "No Excel/CSV attachment" });
    }

    return NextResponse.json({ ok: true, checked: (list.messages || []).length, created, skipped });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Gmail stock sync failed" },
      { status: 500 }
    );
  }
}
