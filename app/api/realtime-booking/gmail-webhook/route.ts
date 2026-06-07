import { NextResponse } from "next/server";
import { ingestVehiclePrices } from "@/lib/realtime-booking";
import { syncRealtimeBookingFromGmail } from "@/lib/realtime-gmail";

export const dynamic = "force-dynamic";

function validateSecret(request: Request) {
  const expected = process.env.REALTIME_BOOKING_WEBHOOK_SECRET;
  if (!expected) return true;
  return request.headers.get("x-realtime-booking-secret") === expected;
}

function decodePubSubPayload(body: Record<string, unknown>) {
  const message = body.message as { data?: string } | undefined;
  if (!message?.data) return body;

  try {
    const decoded = Buffer.from(message.data, "base64").toString("utf8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return body;
  }
}

export async function POST(request: Request) {
  try {
    if (!validateSecret(request)) {
      return NextResponse.json({ ok: false, error: "Invalid realtime booking webhook secret" }, { status: 401 });
    }

    const raw = (await request.json()) as Record<string, unknown>;
    const body = decodePubSubPayload(raw);
    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (!rows.length && body.historyId) {
      const result = await syncRealtimeBookingFromGmail();
      return NextResponse.json({ ok: true, mode: "gmail-sync", result });
    }

    const log = await ingestVehiclePrices({
      subject: String(body.subject || ""),
      sender: String(body.sender || ""),
      recipient: String(body.recipient || ""),
      receivedAt: body.receivedAt ? String(body.receivedAt) : undefined,
      rows: rows.map((row) => {
        const item = row as { plate?: unknown; rtPrice?: unknown; price?: unknown };
        return {
          plate: String(item.plate || ""),
          rtPrice: Number(item.rtPrice || item.price || 0)
        };
      })
    });

    return NextResponse.json({ ok: true, log });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to process realtime booking Gmail webhook" },
      { status: 400 }
    );
  }
}
