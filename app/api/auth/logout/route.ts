import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { clearSalesProfileCookie } from "@/lib/auth-session";
import { getRequestSalesUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = getRequestSalesUser();
  await recordActivity(user, {
    action: "auth.logout",
    targetType: "salesUser",
    targetId: user?.id || "",
    detail: "Logout"
  });
  const response = NextResponse.json({ ok: true });
  clearSalesProfileCookie(response);
  return response;
}
