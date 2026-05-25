import { NextResponse } from "next/server";
import { getRequestSalesUser } from "@/lib/request-user";
import { writeJsonStore } from "@/lib/json-store";

export const dynamic = "force-dynamic";

const restoreStores = new Set([
  "calendar-events.json",
  "sales-leads.json",
  "vehicle-prep.json",
  "sales-profiles.json"
]);

function assertAdmin() {
  const user = getRequestSalesUser();
  if (user?.role !== "super_admin" && user?.role !== "admin") {
    throw new Error("ไม่มีสิทธิ์ Restore Backup");
  }
  return user;
}

function extractBackupData(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const data = record.data && typeof record.data === "object"
    ? record.data as Record<string, unknown>
    : record;
  return data && typeof data === "object" ? data : null;
}

export async function POST(request: Request) {
  try {
    assertAdmin();

    const payload = await request.json();
    const data = extractBackupData(payload);
    if (!data) throw new Error("ไฟล์ Backup ไม่ถูกต้อง");

    const restoredKeys: string[] = [];
    for (const key of restoreStores) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      await writeJsonStore(key, data[key]);
      restoredKeys.push(key);
    }

    if (!restoredKeys.length) throw new Error("ไม่พบข้อมูลที่ Restore ได้ในไฟล์นี้");

    return NextResponse.json({
      ok: true,
      restoredKeys,
      restoredAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Restore Backup ไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
