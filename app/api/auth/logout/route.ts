import { NextResponse } from "next/server";
import { clearSalesProfileCookie } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearSalesProfileCookie(response);
  return response;
}
