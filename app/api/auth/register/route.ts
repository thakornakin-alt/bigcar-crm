import { NextResponse } from "next/server";
import { registerSalesUser, updateSalesUser, uploadProfileImage } from "@/lib/apps-script";
import { recordActivity } from "@/lib/activity-log";
import { saveSalesProfile } from "@/lib/sales-profile-store";
import { RequestAuthError, requireAdmin } from "@/lib/request-user";
import { validateProfileIdentity } from "@/lib/user-profile";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = requireAdmin();
    const body = await request.json();
    for (const forbidden of ["role", "locked", "active", "ownerUserId", "admin"]) {
      if (Object.prototype.hasOwnProperty.call(body, forbidden)) throw new Error("ผู้สมัครไม่สามารถกำหนดสิทธิ์ของตนเองได้");
    }
    if (String(body.password || "").length < 8) throw new Error("Password อย่างน้อย 8 ตัว");
    const identity = validateProfileIdentity(body);
    let user = await registerSalesUser({
      email: identity.email || "",
      password: String(body.password || ""),
      firstName: identity.firstName,
      lastName: identity.lastName,
      nickname: identity.nickname,
      phone: identity.phone,
      lineId: String(body.lineId || "").trim(),
      lineQrUrl: String(body.lineQrUrl || "").trim(),
      avatarUrl: "",
      position: "Sales",
      branch: actor.branch || "ไม่ระบุ"
    });
    let avatarWarning = "";
    if (body.avatar) {
      const avatar = body.avatar as { name?: unknown; type?: unknown; size?: unknown; base64?: unknown };
      const type = String(avatar.type || "");
      const size = Number(avatar.size || 0);
      const base64 = String(avatar.base64 || "").split(",").pop() || "";
      const decodedBytes = Buffer.byteLength(base64, "base64");
      if (!["image/jpeg", "image/png", "image/webp"].includes(type) || !base64 || size <= 0 || size > 4 * 1024 * 1024 || decodedBytes > 4 * 1024 * 1024) {
        throw new Error("รูปโปรไฟล์ไม่ถูกต้องหรือใหญ่เกิน 4MB");
      }
      try {
        const uploaded = await uploadProfileImage({
          userId: user.id,
          kind: "avatar",
          file: { clientId: `avatar-${Date.now()}`, category: "avatar", label: "รูปโปรไฟล์เซลล์", name: String(avatar.name || "avatar.png"), type, size, base64 }
        });
        user = await updateSalesUser({ id: user.id, avatarUrl: `/api/drive/line-image/${encodeURIComponent(uploaded.fileId)}` });
      } catch {
        avatarWarning = "สร้างบัญชีแล้ว แต่อัปโหลดรูปโปรไฟล์ไม่สำเร็จ สามารถเพิ่มภายหลังได้";
      }
    }
    await saveSalesProfile(user);
    const response = NextResponse.json({ user, warning: avatarWarning || undefined });
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
