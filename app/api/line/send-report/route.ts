import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { pushLineReport } from "@/lib/line";
import { requireWritableUser } from "@/lib/request-user";
import type { LineReportAttachment } from "@/lib/line";
import { listLineGroups } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await requireWritableUser();
    const body = await request.json();
    const groupId = String(body.groupId || "").trim();
    const message = String(body.message || "").trim();
    const attachments = Array.isArray(body.attachments) ? body.attachments as LineReportAttachment[] : [];

    if (!groupId || !message) {
      return NextResponse.json({ error: "LINE group and message are required" }, { status: 400 });
    }
    const approved = (await listLineGroups()).some((group) => group.groupId === groupId);
    if (!approved) return NextResponse.json({ error: "ไม่พบกลุ่ม LINE ที่ได้รับอนุมัติ" }, { status: 403 });

    const result = await pushLineReport(groupId, message, attachments);
    await recordActivity(actor, {
      action: "line.sendReport",
      targetType: "lineGroup",
      targetId: groupId,
      detail: `${message} / ${attachments.length} ไฟล์`
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send LINE report" },
      { status: 500 }
    );
  }
}
