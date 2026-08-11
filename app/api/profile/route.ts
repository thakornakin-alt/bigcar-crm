import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { updateSalesUser } from "@/lib/apps-script";
import { recordActivity } from "@/lib/activity-log";
import { salesProfileCookieName, setSalesProfileCookie, verifySalesProfileToken } from "@/lib/auth-session";
import { saveSalesProfile } from "@/lib/sales-profile-store";
import { validateProfileIdentity } from "@/lib/user-profile";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const token = cookies().get(salesProfileCookieName)?.value;
    const currentUser = verifySalesProfileToken(token);
    if (!currentUser) throw new Error("กรุณา Login ก่อน");

    const body = await request.json();
    const allowed = new Set(["firstName", "lastName", "nickname", "phone", "lineId", "avatarUrl"]);
    for (const key of Object.keys(body)) {
      if (!allowed.has(key)) throw new Error("ไม่รองรับข้อมูลที่ส่งมา");
    }
    for (const forbidden of ["role", "branch", "position", "locked", "active", "email"]) {
      if (Object.prototype.hasOwnProperty.call(body, forbidden)) throw new Error("ไม่มีสิทธิ์แก้ไขข้อมูลที่ Admin ดูแล");
    }
    const identity = validateProfileIdentity({
      firstName: body.firstName ?? currentUser.firstName,
      lastName: body.lastName ?? currentUser.lastName,
      nickname: body.nickname ?? currentUser.nickname,
      phone: body.phone ?? currentUser.phone
    });
    const sourceUser = await updateSalesUser({
      id: currentUser.id,
      phone: identity.phone,
      lineId: String(body.lineId ?? currentUser.lineId ?? "").trim(),
      avatarUrl: String(body.avatarUrl ?? currentUser.avatarUrl ?? "").trim()
    });
    const nextUser = { ...sourceUser, ...identity };
    await saveSalesProfile(nextUser);

    const response = NextResponse.json({ user: nextUser });
    setSalesProfileCookie(response, nextUser);
    await recordActivity(nextUser, {
      action: "profile.update",
      targetType: "salesUser",
      targetId: nextUser.id,
      detail: "แก้ข้อมูลโปรไฟล์",
      metadata: { changedFields: ["firstName", "lastName", "nickname", "phone", "lineId", "avatarUrl"].filter((field) => currentUser[field as keyof typeof currentUser] !== nextUser[field as keyof typeof nextUser]) }
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "อัปเดตโปรไฟล์ไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
