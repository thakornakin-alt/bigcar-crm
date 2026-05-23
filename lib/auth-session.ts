import { createHmac, timingSafeEqual } from "crypto";
import type { NextResponse } from "next/server";
import type { SalesUser } from "@/lib/types";

export const salesProfileCookieName = "bigcar_sales_profile";

const maxAge = 60 * 60 * 24 * 30;

function secret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "big-car-crm-local-profile-secret";
}

function base64Url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSalesProfileToken(user: SalesUser) {
  const payload = base64Url(JSON.stringify({ user, iat: Date.now() }));
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
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { user?: SalesUser };
    return parsed.user || null;
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
