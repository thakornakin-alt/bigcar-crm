import type { SalesUser } from "@/lib/types";

export type SessionPayload = { user: SalesUser; iat: number; exp?: number };

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const FALLBACK_AUTH_SECRET = "big-car-crm-local-profile-secret";
export const SALES_PROFILE_COOKIE_NAME = "bigcar_sales_profile";

export function usableAuthSecret(env: Record<string, string | undefined>) {
  const value = String(env.AUTH_SECRET || env.NEXTAUTH_SECRET || "").trim();
  return value && value !== FALLBACK_AUTH_SECRET ? value : "";
}

function decodePayload(encoded: string): SessionPayload | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const text = decodeURIComponent(Array.from(atob(padded), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
    return JSON.parse(text) as SessionPayload;
  } catch {
    return null;
  }
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function verifySessionTokenEdge(token: string | undefined, secret: string, now = Date.now()) {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expected = bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
  if (signature !== expected) return null;
  const parsed = decodePayload(payload);
  if (!parsed?.user?.id || !Number.isFinite(parsed.iat)) return null;
  const expiresAt = parsed.exp || parsed.iat + SESSION_MAX_AGE_SECONDS * 1000;
  if (parsed.iat > now + 60_000 || expiresAt <= now) return null;
  return parsed.user;
}
