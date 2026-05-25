import { NextResponse } from "next/server";
import { listCalendarVehicleOptions } from "@/lib/vehicle-prep-cases";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const vehicles = await listCalendarVehicleOptions();
    return NextResponse.json({ vehicles });
  } catch (error) {
    return NextResponse.json(
      { vehicles: [], error: error instanceof Error ? error.message : "โหลดทะเบียนรอส่งมอบไม่สำเร็จ" },
      { status: 200 }
    );
  }
}
