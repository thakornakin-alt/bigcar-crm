import { NextResponse } from "next/server";
import { getRequestSalesUser } from "@/lib/request-user";
import { resetUserData } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

function assertAdmin() {
  const user = getRequestSalesUser();
  if (user?.role !== "super_admin" && user?.role !== "admin") {
    throw new Error("ไม่มีสิทธิ์ Reset ข้อมูล");
  }
  return user;
}

export async function POST(request: Request) {
  try {
    assertAdmin();
    const payload = await request.json().catch(() => ({}));
    const keepMonth = typeof payload?.keepMonth === "string" ? payload.keepMonth : undefined;
    const result = await resetUserData(keepMonth ? { keepMonth } : {});

    return NextResponse.json({
      ok: true,
      result
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reset ข้อมูลไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
