import { NextResponse } from "next/server";
import { createCalendarEvent, listCalendarEvents } from "@/lib/calendar-events";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const events = await listCalendarEvents({
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined
    });
    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "โหลดปฏิทินไม่สำเร็จ" },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const event = await createCalendarEvent(await request.json());
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "เพิ่มงานไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
