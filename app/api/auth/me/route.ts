import { NextResponse } from "next/server";
import { getRequestSalesUser } from "@/lib/request-user";
import { mergeStoredSalesProfile } from "@/lib/sales-profile-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestSalesUser();
  return NextResponse.json({ user: await mergeStoredSalesProfile(user) });
}
