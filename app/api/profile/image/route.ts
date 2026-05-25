import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { updateSalesUser, uploadProfileImage } from "@/lib/apps-script";
import { recordActivity } from "@/lib/activity-log";
import { salesProfileCookieName, setSalesProfileCookie, verifySalesProfileToken } from "@/lib/auth-session";
import { saveSalesProfile } from "@/lib/sales-profile-store";
import type { ProfileImageKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const allowedKinds: ProfileImageKind[] = ["avatar", "lineQr"];
const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageBytes = 4 * 1024 * 1024;

function cleanBase64(value: string) {
  return value.includes(",") ? value.split(",").pop() || "" : value;
}

export async function POST(request: Request) {
  try {
    const token = cookies().get(salesProfileCookieName)?.value;
    const currentUser = verifySalesProfileToken(token);
    if (!currentUser) throw new Error("กรุณา Login ก่อนอัปโหลดรูป");

    const body = await request.json();
    const kind = String(body.kind || "") as ProfileImageKind;
    if (!allowedKinds.includes(kind)) throw new Error("ชนิดรูปไม่ถูกต้อง");

    const file = {
      clientId: `${kind}-${Date.now()}`,
      category: kind,
      label: kind === "avatar" ? "รูปโปรไฟล์เซลล์" : "QR LINE",
      name: String(body.name || `${kind}.png`).trim(),
      type: String(body.type || "image/png").trim(),
      size: Number(body.size || 0),
      base64: cleanBase64(String(body.base64 || ""))
    };

    if (!allowedTypes.includes(file.type)) throw new Error("รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP");
    if (!file.base64) throw new Error("ไม่พบข้อมูลรูป");
    if (file.size > maxImageBytes) throw new Error("รูปใหญ่เกินไป กรุณาใช้รูปไม่เกิน 4MB");

    const uploaded = await uploadProfileImage({
      userId: currentUser.id,
      kind,
      file
    });
    const imageUrl = `/api/drive/line-image/${encodeURIComponent(uploaded.fileId)}`;

    const nextUser = await updateSalesUser({
      id: currentUser.id,
      avatarUrl: kind === "avatar" ? imageUrl : currentUser.avatarUrl,
      lineQrUrl: kind === "lineQr" ? imageUrl : currentUser.lineQrUrl
    });
    await saveSalesProfile(nextUser);

    const response = NextResponse.json({ image: { ...uploaded, url: imageUrl }, user: nextUser }, { status: 201 });
    setSalesProfileCookie(response, nextUser);
    await recordActivity(nextUser, {
      action: kind === "avatar" ? "profile.avatar.upload" : "profile.lineQr.upload",
      targetType: "salesUser",
      targetId: nextUser.id,
      detail: uploaded.name
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
