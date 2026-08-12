import { NextResponse } from "next/server";
import { getRddFeatureFlags } from "@/lib/feature-flags";
import { RequestAuthError, requireWritableUser } from "@/lib/request-user";

export async function POST() {
  try {
    requireWritableUser();
    if (!getRddFeatureFlags().commissionRealWrites) return NextResponse.json({ error: "ยังไม่เปิดใช้งานการบันทึกค่าคอมจริง" }, { status: 403 });
    return NextResponse.json({ error: "Real Commission persistence ยังไม่เปิดใช้ใน Phase 2A" }, { status: 501 });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Commission write rejected" }, { status: 500 });
  }
}
