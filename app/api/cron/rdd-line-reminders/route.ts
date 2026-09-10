import { NextResponse } from "next/server";
import { sendRddLinePendingReminder } from "@/lib/rdd-line-tracker";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const configured = String(process.env.CRON_SECRET || "").trim();
  const authorization = request.headers.get("authorization") || "";
  if (!configured || authorization !== `Bearer ${configured}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, result: await sendRddLinePendingReminder() });
  } catch (error) {
    console.error("[rdd-line] reminder failed", error);
    return NextResponse.json({ error: "ส่งสรุปงานค้าง LINE ไม่สำเร็จ" }, { status: 500 });
  }
}
