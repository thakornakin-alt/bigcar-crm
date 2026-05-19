import { createHmac, timingSafeEqual } from "crypto";

export type LineWebhookEvent = {
  type: string;
  source?: {
    type?: string;
    groupId?: string;
    roomId?: string;
    userId?: string;
  };
};

type LinePushMessage = {
  type: "text";
  text: string;
} | {
  type: "image";
  originalContentUrl: string;
  previewImageUrl: string;
};

export type LineReportAttachment = {
  name: string;
  type: string;
  url?: string;
  fileId?: string;
};

function getLineSecret() {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) throw new Error("Missing environment variable: LINE_CHANNEL_SECRET");
  return secret;
}

function getLineToken() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("Missing environment variable: LINE_CHANNEL_ACCESS_TOKEN");
  return token;
}

export function verifyLineSignature(body: string, signature: string | null) {
  if (!signature) return false;
  const expected = createHmac("sha256", getLineSecret()).update(body).digest("base64");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function getLineConfigStatus() {
  return {
    hasChannelId: Boolean(process.env.LINE_CHANNEL_ID),
    hasChannelSecret: Boolean(process.env.LINE_CHANNEL_SECRET),
    hasChannelAccessToken: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
    webhookUrl: "https://bigcar-crm.vercel.app/api/line/webhook"
  };
}

export async function getLineGroupName(groupId: string) {
  try {
    const response = await fetch(`https://api.line.me/v2/bot/group/${encodeURIComponent(groupId)}/summary`, {
      headers: { Authorization: `Bearer ${getLineToken()}` },
      cache: "no-store"
    });
    if (!response.ok) return "";
    const data = (await response.json()) as { groupName?: string };
    return String(data.groupName || "");
  } catch {
    return "";
  }
}

export async function pushLineText(to: string, text: string) {
  await pushLineMessages(to, [{ type: "text", text }]);
  return true;
}

export async function pushLineReport(to: string, text: string, attachments: LineReportAttachment[] = []) {
  const imageAttachments = attachments
    .filter((attachment) => attachment.fileId && attachment.type.startsWith("image/"))
    .map((attachment) => {
      const imageUrl = buildDriveLineImageUrl(attachment.fileId || "");
      return {
        attachment,
        message: {
          type: "image",
          originalContentUrl: imageUrl,
          previewImageUrl: imageUrl
        } satisfies LinePushMessage
      };
    });

  const fileLinks = attachments
    .filter((attachment) => !attachment.type.startsWith("image/") && attachment.url)
    .map((attachment) => `${attachment.name}: ${attachment.url}`);

  const firstText = fileLinks.length ? `${text}\n\nไฟล์แนบอื่น:\n${fileLinks.join("\n")}` : text;
  await pushLineMessages(to, [{ type: "text", text: firstText }]);

  let imageCount = 0;
  const failedImageLinks: string[] = [];

  for (const image of imageAttachments) {
    try {
      await pushLineMessages(to, [image.message]);
      imageCount += 1;
    } catch {
      if (image.attachment.url) {
        failedImageLinks.push(`${image.attachment.name}: ${image.attachment.url}`);
      }
    }
  }

  if (failedImageLinks.length) {
    await pushLineMessagesInChunks(
      to,
      chunkTextLines("LINE ส่งรูปบางไฟล์ไม่สำเร็จ เปิดดูจากลิงก์นี้แทน:\n", failedImageLinks)
        .map((lineText) => ({ type: "text", text: lineText }))
    );
  }

  return {
    imageCount,
    failedImageCount: failedImageLinks.length,
    linkCount: fileLinks.length + failedImageLinks.length,
    messageCount: 1 + imageCount + failedImageLinks.length
  };
}

function buildDriveLineImageUrl(fileId: string) {
  return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=s1600`;
}

function chunkTextLines(prefix: string, lines: string[]) {
  const chunks: string[] = [];
  let current = prefix;

  for (const line of lines) {
    const next = `${current}${current.endsWith("\n") ? "" : "\n"}${line}`;
    if (next.length > 4500) {
      chunks.push(current);
      current = `${prefix}${line}`;
    } else {
      current = next;
    }
  }

  if (current.trim()) chunks.push(current);
  return chunks;
}

async function pushLineMessagesInChunks(to: string, messages: LinePushMessage[]) {
  let sent = 0;
  for (let index = 0; index < messages.length; index += 5) {
    const chunk = messages.slice(index, index + 5);
    await pushLineMessages(to, chunk);
    sent += chunk.length;
  }
  return sent;
}

async function pushLineMessages(to: string, messages: LinePushMessage[]) {
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getLineToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to,
      messages
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LINE push failed: ${detail || response.status}`);
  }

  return true;
}
