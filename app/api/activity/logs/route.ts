import { NextResponse } from "next/server";
import { listActivityLogs } from "@/lib/apps-script";
import { RequestAuthError, requireAdmin } from "@/lib/request-user";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 100), 1), 300);
    const logs = await listActivityLogs(limit);
    return NextResponse.json({ logs });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "โหลด Activity Log ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
