import { NextResponse } from "next/server";
import { listActiveReservedPlateKeys, listLineReservationRecords } from "@/lib/line-reservations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [activePlates, records] = await Promise.all([
      listActiveReservedPlateKeys(),
      listLineReservationRecords()
    ]);
    return NextResponse.json({ activePlates, records });
  } catch (error) {
    return NextResponse.json(
      { activePlates: [], records: [], error: error instanceof Error ? error.message : "โหลดสถานะจองจาก LINE ไม่สำเร็จ" },
      { status: 200 }
    );
  }
}

