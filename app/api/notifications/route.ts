import { NextResponse } from "next/server";
import { listCrmNotifications } from "@/lib/notifications";

export async function GET() {
  try {
    const notifications = await listCrmNotifications();
    return NextResponse.json({ notifications });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "โหลดแจ้งเตือนไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
