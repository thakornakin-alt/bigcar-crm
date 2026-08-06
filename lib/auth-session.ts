import { createHmac, timingSafeEqual } from "crypto";
import type { NextResponse } from "next/server";
import type { SalesUser } from "@/lib/types";
import { FALLBACK_AUTH_SECRET, SALES_PROFILE_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, usableAuthSecret } from "./edge-session";

export const salesProfileCookieName = SALES_PROFILE_COOKIE_NAME;

const maxAge = SESSION_MAX_AGE_SECONDS;

function secret() {
  const configured = usableAuthSecret(process.env);
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET or NEXTAUTH_SECRET must be configured securely in production");
  }
  return FALLBACK_AUTH_SECRET;
}

export function assertAuthConfigured() {
  return secret();
}

function base64Url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSalesProfileToken(user: SalesUser) {
  const iat = Date.now();
  const payload = base64Url(JSON.stringify({ user, iat, exp: iat + maxAge * 1000 }));
  return `${payload}.${sign(payload)}`;
}

export function verifySalesProfileToken(token?: string) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const expected = sign(payload);
  const valid =
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { user?: SalesUser; iat?: number; exp?: number };
    const issuedAt = Number(parsed.iat || 0);
    const expiresAt = Number(parsed.exp || issuedAt + maxAge * 1000);
    if (!parsed.user?.id || !issuedAt || issuedAt > Date.now() + 60_000 || expiresAt <= Date.now()) return null;
    return parsed.user;
  } catch {
    return null;
  }
}

export function setSalesProfileCookie(response: NextResponse, user: SalesUser) {
  response.cookies.set(salesProfileCookieName, createSalesProfileToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/"
  });
}

export function clearSalesProfileCookie(response: NextResponse) {
  response.cookies.set(salesProfileCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/"
  });
}
