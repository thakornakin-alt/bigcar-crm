import { NextResponse } from "next/server";
import { deleteCalendarEvent } from "@/lib/calendar-events";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await deleteCalendarEvent(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ลบงานไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
