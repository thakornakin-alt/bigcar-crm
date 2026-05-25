import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { salesProfileCookieName, verifySalesProfileToken } from "@/lib/auth-session";
import { mergeStoredSalesProfile } from "@/lib/sales-profile-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = cookies().get(salesProfileCookieName)?.value;
  const user = verifySalesProfileToken(token);
  return NextResponse.json({ user: await mergeStoredSalesProfile(user) });
}
