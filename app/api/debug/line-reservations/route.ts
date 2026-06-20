import { NextResponse } from "next/server";
import { jsonStoreInfo } from "@/lib/json-store";
import { listActiveReservedPlateKeys, listLineReservationRecords } from "@/lib/line-reservations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [activePlates, records] = await Promise.all([
      listActiveReservedPlateKeys(),
      listLineReservationRecords()
    ]);

    const providerInfo = jsonStoreInfo();
    const lastRecord = records[0]
      ? {
          plate: records[0].plate,
          active: records[0].active,
          updatedAt: records[0].updatedAt
        }
      : null;

    return NextResponse.json({
      provider: providerInfo.provider,
      storeKey: "line-reservations.json",
      recordsCount: records.length,
      activeCount: activePlates.length,
      activePlates,
      updatedAt: records[0]?.updatedAt || null,
      lastRecord
    });
  } catch (error) {
    return NextResponse.json(
      {
        provider: "unknown",
        storeKey: "line-reservations.json",
        recordsCount: 0,
        activeCount: 0,
        activePlates: [],
        updatedAt: null,
        lastRecord: null,
        error: error instanceof Error ? error.message : "Unable to load line reservation debug summary"
      },
      { status: 200 }
    );
  }
}
