import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { updateSalesUser } from "@/lib/apps-script";
import { recordActivity } from "@/lib/activity-log";
import { salesProfileCookieName, setSalesProfileCookie, verifySalesProfileToken } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const token = cookies().get(salesProfileCookieName)?.value;
    const currentUser = verifySalesProfileToken(token);
    if (!currentUser) throw new Error("กรุณา Login ก่อน");

    const body = await request.json();
    const nextUser = await updateSalesUser({
      id: currentUser.id,
      phone: String(body.phone ?? currentUser.phone ?? "").trim(),
      lineId: String(body.lineId ?? currentUser.lineId ?? "").trim(),
      lineQrUrl: String(body.lineQrUrl ?? currentUser.lineQrUrl ?? "").trim(),
      avatarUrl: String(body.avatarUrl ?? currentUser.avatarUrl ?? "").trim(),
      position: String(body.position ?? currentUser.position ?? "").trim(),
      branch: String(body.branch ?? currentUser.branch ?? "").trim()
    });

    const response = NextResponse.json({ user: nextUser });
    setSalesProfileCookie(response, nextUser);
    await recordActivity(nextUser, {
      action: "profile.update",
      targetType: "salesUser",
      targetId: nextUser.id,
      detail: "แก้ข้อมูลโปรไฟล์"
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "อัปเดตโปรไฟล์ไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
