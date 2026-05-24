import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { pushLineText } from "@/lib/line";
import { getRequestSalesUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const groupId = String(body.groupId || "").trim();
    const message = String(body.message || "").trim();

    if (!groupId || !message) {
      return NextResponse.json({ error: "LINE group and message are required" }, { status: 400 });
    }

    await pushLineText(groupId, message);
    await recordActivity(getRequestSalesUser(), {
      action: "line.sendText",
      targetType: "lineGroup",
      targetId: groupId,
      detail: message.slice(0, 180)
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send LINE message" },
      { status: 500 }
    );
  }
}
