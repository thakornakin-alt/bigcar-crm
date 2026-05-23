import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { salesProfileCookieName, verifySalesProfileToken } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = cookies().get(salesProfileCookieName)?.value;
  return NextResponse.json({ user: verifySalesProfileToken(token) });
}
