import { NextResponse } from "next/server";
import { listLineGroups } from "@/lib/apps-script";
import { getRddLineSettings, saveRddLineSettings } from "@/lib/rdd-line-settings";
import { RequestAuthError, requireAdmin } from "@/lib/request-user";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ settings: await getRddLineSettings() });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "โหลดการตั้งค่าติดตามงาน LINE ไม่สำเร็จ" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json() as Record<string, unknown>;
    const groupId = String(body.groupId || "").trim();
    if (groupId && !(await listLineGroups()).some((group) => group.groupId === groupId)) {
      return NextResponse.json({ error: "ไม่พบกลุ่ม LINE ที่เลือก" }, { status: 400 });
    }
    const settings = await saveRddLineSettings({
      groupId,
      enabled: body.enabled === true && Boolean(groupId),
      reminderEnabled: body.reminderEnabled === true && Boolean(groupId),
      reminderHourBangkok: Number(body.reminderHourBangkok ?? 8)
    });
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "บันทึกการตั้งค่าติดตามงาน LINE ไม่สำเร็จ" }, { status: 500 });
  }
}
