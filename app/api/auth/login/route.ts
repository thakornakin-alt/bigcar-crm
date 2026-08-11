import { NextResponse } from "next/server";
import { loginSalesUser } from "@/lib/apps-script";
import { recordActivity } from "@/lib/activity-log";
import { assertAuthConfigured, setSalesProfileCookie } from "@/lib/auth-session";
import { mergeStoredSalesProfile, saveSalesProfile } from "@/lib/sales-profile-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertAuthConfigured();
    const body = await request.json();
    const sourceUser = await loginSalesUser({
      email: String(body.email || "").trim(),
      password: String(body.password || "")
    });
    const user = await mergeStoredSalesProfile(sourceUser) || sourceUser;
    await saveSalesProfile(user);
    const response = NextResponse.json({ user });
    setSalesProfileCookie(response, user);
    await recordActivity(user, {
      action: "auth.login",
      targetType: "salesUser",
      targetId: user.id,
      detail: user.email,
      source: "api"
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login ไม่สำเร็จ" },
      { status: 401 }
    );
  }
}
