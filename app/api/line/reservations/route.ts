import { NextResponse } from "next/server";
import { listLineReservationRecords } from "@/lib/line-reservations";

export const dynamic = "force-dynamic";

const TRANSIENT_STORE_RETRY_DELAY_MS = 150;

function isTransientStoreError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /(?:timed out|timeout|\b502\b|\b503\b|\b504\b|gateway)/i.test(message);
}

async function readReservationRecordsReliably() {
  try {
    return await listLineReservationRecords();
  } catch (error) {
    if (!isTransientStoreError(error)) throw error;
    console.warn("[line-reservations] transient store read failed; retrying once", {
      error: error instanceof Error ? error.message : String(error)
    });
    await new Promise((resolve) => setTimeout(resolve, TRANSIENT_STORE_RETRY_DELAY_MS));
    return listLineReservationRecords();
  }
}

export async function GET() {
  try {
    // One store read in the normal path. Retry only once for transient gateway/timeout failures.
    const records = await readReservationRecordsReliably();
    const activePlates = records.filter((item) => item.active).map((item) => item.plateNormalized);
    return NextResponse.json({ activePlates, records });
  } catch (error) {
    return NextResponse.json(
      { activePlates: [], records: [], error: error instanceof Error ? error.message : "โหลดสถานะจองจาก LINE ไม่สำเร็จ" },
      { status: 200 }
    );
  }
}
