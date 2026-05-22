import { NextResponse } from "next/server";
import { addWaitingQueue, listRealtimeQueue } from "@/lib/realtime-booking";
import type { RealtimePaymentType } from "@/lib/realtime-booking";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ queue: listRealtimeQueue() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const item = addWaitingQueue({
      plate: String(body.plate || ""),
      customerName: String(body.customerName || ""),
      discount: Number(body.discount || 0),
      paymentType: (body.paymentType === "cash" ? "cash" : "finance") as RealtimePaymentType,
      saleName: String(body.saleName || ""),
      userId: String(body.userId || "local-user")
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to save waiting queue" },
      { status: 400 }
    );
  }
}
