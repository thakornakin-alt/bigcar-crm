import { NextResponse } from "next/server";
import { registerSalesUser } from "@/lib/apps-script";
import { recordActivity } from "@/lib/activity-log";
import { preservePhoneInput } from "@/lib/phone";
import { saveSalesProfile } from "@/lib/sales-profile-store";
import { RequestAuthError, requireAdmin } from "@/lib/request-user";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = requireAdmin();
    const body = await request.json();
    const user = await registerSalesUser({
      email: String(body.email || "").trim(),
      password: String(body.password || ""),
      firstName: String(body.firstName || "").trim(),
      lastName: String(body.lastName || "").trim(),
      nickname: String(body.nickname || "").trim(),
      phone: preservePhoneInput(body.phone),
      lineId: String(body.lineId || "").trim(),
      lineQrUrl: String(body.lineQrUrl || "").trim(),
      avatarUrl: String(body.avatarUrl || "").trim(),
      position: String(body.position || "Sales").trim(),
      branch: String(body.branch || "").trim()
    });
    await saveSalesProfile(user);
    const response = NextResponse.json({ user });
    await recordActivity(actor, {
      action: "auth.register",
      targetType: "salesUser",
      targetId: user.id,
      detail: user.email,
      source: "api",
      after: { role: user.role, locked: user.locked }
    });
    return response;
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Register ไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
