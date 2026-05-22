import { NextResponse } from "next/server";
import { ingestVehiclePrices, listVehiclePrices } from "@/lib/realtime-booking";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return NextResponse.json({ vehicles: listVehiclePrices(searchParams.get("query") || "") });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const log = ingestVehiclePrices({
      subject: String(body.subject || "Pricing and Status Update"),
      sender: String(body.sender || "pricing@example.com"),
      recipient: String(body.recipient || "retail-team@example.com"),
      receivedAt: body.receivedAt ? String(body.receivedAt) : undefined,
      rows: Array.isArray(body.rows) ? body.rows : []
    });

    return NextResponse.json({ ok: true, log });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to ingest vehicle prices" },
      { status: 400 }
    );
  }
}
