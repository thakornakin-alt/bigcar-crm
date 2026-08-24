import { NextResponse } from "next/server";
import { ensureRealtimeBookingV2Store, getRealtimeBookingV2QueueItem, updateRealtimeBookingV2Item } from "@/lib/realtime-booking-v2";
import { enqueueRealtimeBookingLine, processRealtimeBookingLineEvent } from "@/lib/realtime-booking-outbox";
import { requireWritableUser, RequestAuthError } from "@/lib/request-user";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireWritableUser();
    const body = await request.json();
    await ensureRealtimeBookingV2Store();
    const itemId = String(body.id || "");
    await updateRealtimeBookingV2Item(itemId, {
      paymentType: body.paymentType === "cash" ? "cash" : "finance",
      saleName: String(body.saleName || "บิ๊ก"),
      remark: String(body.remark || ""),
      discount: Number(body.discount || 0)
    });
    const queued = await enqueueRealtimeBookingLine(itemId, String(body.targetId || ""));
    const processed = queued.record ? await processRealtimeBookingLineEvent(queued.record.id) : null;
    const item = await getRealtimeBookingV2QueueItem(itemId);
    const status = processed?.record?.status || queued.record?.status || "sent";
    return NextResponse.json({ ok: status === "sent", item, outbox: { eventId: queued.record?.id || "", status, attempts: processed?.record?.attempts || queued.record?.attempts || 0 }, idempotentReplay: !queued.created });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to send LINE" },
      { status: 400 }
    );
  }
}
