import { NextResponse } from "next/server";
import { listLineReservationRecords } from "@/lib/line-reservations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Read the reservation store once. Previously this endpoint read the same
    // Supabase JSON twice in parallel (once for active plates and once for records).
    const records = await listLineReservationRecords();
    const activePlates = records.filter((item) => item.active).map((item) => item.plateNormalized);
    return NextResponse.json({ activePlates, records });
  } catch (error) {
    return NextResponse.json(
      { activePlates: [], records: [], error: error instanceof Error ? error.message : "โหลดสถานะจองจาก LINE ไม่สำเร็จ" },
      { status: 200 }
    );
  }
}
