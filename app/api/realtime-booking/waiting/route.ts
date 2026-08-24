import { NextResponse } from "next/server";
import { addWaitingQueue, listRealtimeQueue } from "@/lib/realtime-booking";
import type { RealtimePaymentType } from "@/lib/realtime-booking";
import { requireWritableUser, RequestAuthError } from "@/lib/request-user";
import { profileActivityName } from "@/lib/user-profile";
import { ownershipFromUser, saveCaseOwnership } from "@/lib/case-ownership";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ queue: listRealtimeQueue() });
}

export async function POST(request: Request) {
  try {
    const actor = await requireWritableUser();
    const body = await request.json();
    const item = addWaitingQueue({
      plate: String(body.plate || ""),
      customerName: String(body.customerName || ""),
      discount: Number(body.discount || 0),
      paymentType: (body.paymentType === "cash" ? "cash" : "finance") as RealtimePaymentType,
      saleName: profileActivityName(actor),
      userId: actor.id
    });
    await saveCaseOwnership(ownershipFromUser(actor, { caseType: "realtime_booking", caseId: item.id }));

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to save waiting queue" },
      { status: 400 }
    );
  }
}
