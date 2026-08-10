import { NextResponse } from "next/server";
import { getRddFeatureFlags } from "@/lib/feature-flags";
import { appendRddActivity } from "@/lib/rdd-activity";
import { RequestAuthError, requireWritableUser } from "@/lib/request-user";
import {
  RddWorkspaceWriteError,
  updateRddWorkspaceRecord,
  validateRddWorkspacePatchBody
} from "@/lib/rdd-workspace-write";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    if (!getRddFeatureFlags().workspaceEdit) {
      return NextResponse.json({ error: "Workspace ยังอยู่ในโหมดอ่านอย่างเดียว" }, { status: 403 });
    }
    const actor = requireWritableUser();
    const input = validateRddWorkspacePatchBody(await request.json());
    const result = await updateRddWorkspaceRecord(input);

    try {
      const activity = await appendRddActivity(actor, {
        action: "booking_delivery_updated",
        targetType: "booking_delivery",
        targetId: result.record.id,
        source: "api",
        before: result.before,
        after: result.after,
        metadata: { changedFields: result.changedFields }
      });
      return NextResponse.json({ record: result.record, revision: result.revision, activityEventId: activity.id });
    } catch (activityError) {
      console.error("[rdd-workspace] activity append failed after business update", activityError);
      return NextResponse.json({
        record: result.record,
        revision: result.revision,
        partialSuccess: true,
        warning: "บันทึกข้อมูลแล้ว แต่บันทึก Activity ไม่สำเร็จ"
      }, { status: 207 });
    }
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof RddWorkspaceWriteError) {
      return NextResponse.json({ error: error.message, current: error.current }, { status: error.status });
    }
    console.error("[rdd-workspace] write failed", error);
    return NextResponse.json({ error: "บันทึก Booking Delivery ไม่สำเร็จ" }, { status: 500 });
  }
}
