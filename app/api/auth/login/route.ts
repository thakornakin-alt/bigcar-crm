import { NextResponse } from "next/server";
import { loginSalesUser } from "@/lib/apps-script";
import { recordActivity } from "@/lib/activity-log";
import { setSalesProfileCookie } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const user = await loginSalesUser({
      email: String(body.email || "").trim(),
      password: String(body.password || "")
    });
    const response = NextResponse.json({ user });
    setSalesProfileCookie(response, user);
    await recordActivity(user, {
      action: "auth.login",
      targetType: "salesUser",
      targetId: user.id,
      detail: user.email
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login ไม่สำเร็จ" },
      { status: 401 }
    );
  }
}
