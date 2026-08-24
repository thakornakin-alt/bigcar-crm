import { NextResponse } from "next/server";
import { updateSalesUser } from "@/lib/apps-script";
import { recordActivity } from "@/lib/activity-log";
import { setSalesProfileCookie } from "@/lib/auth-session";
import { requireUser } from "@/lib/request-user";
import { getAuthCredentialV2 } from "@/lib/auth-credentials-v2";
import { saveSalesProfile } from "@/lib/sales-profile-store";
import { validateProfileIdentity } from "@/lib/user-profile";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const currentUser = await requireUser();

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
      firstName: identity.firstName,
      lastName: identity.lastName,
      nickname: identity.nickname,
      phone: identity.phone,
      lineId: String(body.lineId ?? currentUser.lineId ?? "").trim(),
      avatarUrl: String(body.avatarUrl ?? currentUser.avatarUrl ?? "").trim()
    });
    const nextUser = { ...sourceUser, ...identity };
    try {
      await saveSalesProfile(nextUser, { throwOnError: true });
    } catch (mirrorError) {
      const response = NextResponse.json(
        {
          user: nextUser,
          partialSuccess: true,
          canonicalSaved: true,
          mirrorSaved: false,
          error: mirrorError instanceof Error ? mirrorError.message : "บันทึกข้อมูลหลักสำเร็จ แต่ซิงก์ข้อมูลโปรไฟล์ไม่สำเร็จ"
        },
        { status: 207 }
      );
      const credential = await getAuthCredentialV2(nextUser.id);
      if (!credential) throw new Error("Credential session unavailable");
      setSalesProfileCookie(response, nextUser, credential.sessionVersion);
      return response;
    }

    const response = NextResponse.json({ user: nextUser });
    const credential = await getAuthCredentialV2(nextUser.id);
    if (!credential) throw new Error("Credential session unavailable");
    setSalesProfileCookie(response, nextUser, credential.sessionVersion);
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
