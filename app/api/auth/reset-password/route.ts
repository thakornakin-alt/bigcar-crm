import { NextResponse } from "next/server";
import { completePasswordReset } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    await completePasswordReset(String(body.token || ""), String(body.password || ""));
    return NextResponse.json({ ok: true, message: "ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบ" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ลิงก์ตั้งรหัสผ่านหมดอายุหรือถูกใช้งานแล้ว";
    const validation = message.includes("10 ตัวอักษร") ? message : "ลิงก์ตั้งรหัสผ่านหมดอายุหรือถูกใช้งานแล้ว";
    console.info("password_reset_token_invalid", { reason: validation });
    return NextResponse.json({ error: validation }, { status: 400 });
  }
}
