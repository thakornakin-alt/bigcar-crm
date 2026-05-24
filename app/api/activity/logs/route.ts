import { NextResponse } from "next/server";
import { listActivityLogs } from "@/lib/apps-script";
import { canReadAllCustomers, getRequestSalesUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const currentUser = getRequestSalesUser();
    if (!canReadAllCustomers(currentUser)) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 100), 1), 300);
    const logs = await listActivityLogs(limit);
    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "โหลด Activity Log ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
