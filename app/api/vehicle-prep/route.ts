import { NextResponse } from "next/server";
import { listVehiclePrepRecords, saveVehiclePrepRecord } from "@/lib/vehicle-prep";

export async function GET() {
  try {
    const records = await listVehiclePrepRecords();
    return NextResponse.json({ records });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "โหลดข้อมูลงานส่งมอบไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const record = await saveVehiclePrepRecord(await request.json());
    return NextResponse.json({ record });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "บันทึกงานส่งมอบไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
