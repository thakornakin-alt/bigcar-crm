import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { clearSalesProfileCookie } from "@/lib/auth-session";
import { RequestAuthError, requireUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";

export async function POST() {
  let user;
  try {
    user = requireUser();
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
  await recordActivity(user, {
    action: "auth.logout",
    targetType: "salesUser",
    targetId: user?.id || "",
    detail: "Logout",
    source: "api"
  });
  const response = NextResponse.json({ ok: true });
  clearSalesProfileCookie(response);
  return response;
}
