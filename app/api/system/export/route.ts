import { NextResponse } from "next/server";
import { jsonStoreInfo, readJsonStore } from "@/lib/json-store";

export const dynamic = "force-dynamic";

const exportStores = [
  "calendar-events.json",
  "sales-leads.json",
  "booking-delivery.json",
  "vehicle-prep.json",
  "sales-profiles.json"
];

export async function GET() {
  const exportedAt = new Date().toISOString();
  const data: Record<string, unknown> = {};

  for (const key of exportStores) {
    data[key] = await readJsonStore(key, null);
  }

  const payload = {
    ok: true,
    exportedAt,
    source: "BIG CAR RDD CRM",
    storage: jsonStoreInfo(),
    data
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="big-car-crm-backup-${exportedAt.slice(0, 10)}.json"`
    }
  });
}
