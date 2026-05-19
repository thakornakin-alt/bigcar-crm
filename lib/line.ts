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
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getLineToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text } satisfies LinePushMessage]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LINE push failed: ${detail || response.status}`);
  }

  return true;
}
