import { NextResponse } from "next/server";
import { siteConfig } from "@/lib/site/config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = String(body.password || "");

    if (!password || password !== siteConfig.siteAdminPassword) {
      return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "เข้าสู่ระบบไม่สำเร็จ" }, { status: 500 });
  }
}
