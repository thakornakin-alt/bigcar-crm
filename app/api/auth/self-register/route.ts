import { NextResponse } from "next/server";
import { listSalesUsers, registerSalesUser, updateSalesUser, uploadProfileImage } from "@/lib/apps-script";
import { createAuthCredentialV2IfMissing } from "@/lib/auth-credentials-v2";
import { saveSalesProfile } from "@/lib/sales-profile-store";
import { registerSelfSalesUser, SelfRegisterError } from "@/lib/self-register-service";

export const dynamic = "force-dynamic";

type AvatarInput = { name?: unknown; type?: unknown; size?: unknown; base64?: unknown };

function parseAvatar(value: unknown) {
  if (!value) return null;
  const avatar = value as AvatarInput;
  const type = String(avatar.type || "");
  const size = Number(avatar.size || 0);
  const base64 = String(avatar.base64 || "").split(",").pop() || "";
  const decodedBytes = Buffer.byteLength(base64, "base64");
  if (!["image/jpeg", "image/png", "image/webp"].includes(type) || !base64 || size <= 0 || size > 4 * 1024 * 1024 || decodedBytes > 4 * 1024 * 1024) {
    throw new Error("รูปโปรไฟล์ไม่ถูกต้องหรือใหญ่เกิน 4MB");
  }
  return { name: String(avatar.name || "avatar.png"), type, size, base64 };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const avatar = parseAvatar(body.avatar);
    let user = await registerSelfSalesUser(body, {
      listUsers: listSalesUsers,
      registerUser: registerSalesUser,
      createCredential: createAuthCredentialV2IfMissing,
      saveProfile: saveSalesProfile
    });

    let warning: string | undefined;
    if (avatar) {
      try {
        const uploaded = await uploadProfileImage({
          userId: user.id,
          kind: "avatar",
          file: { clientId: `avatar-${Date.now()}`, category: "avatar", label: "รูปโปรไฟล์เซลล์", ...avatar }
        });
        user = await updateSalesUser({ id: user.id, avatarUrl: `/api/drive/line-image/${encodeURIComponent(uploaded.fileId)}` });
        await saveSalesProfile(user, { throwOnError: true });
      } catch {
        warning = "สมัครสมาชิกสำเร็จ แต่อัปโหลดรูปโปรไฟล์ไม่สำเร็จ สามารถเพิ่มภายหลังได้";
      }
    }

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, role: "sales", locked: false },
      warning
    }, { status: 201 });
  } catch (error) {
    if (error instanceof SelfRegisterError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "สมัครสมาชิกไม่สำเร็จ";
    if (/Email.*ผู้ใช้งานแล้ว|อีเมล.*บัญชี/i.test(message)) {
      return NextResponse.json({ error: "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
