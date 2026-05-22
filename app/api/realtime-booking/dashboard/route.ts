import { NextResponse } from "next/server";
import { getRealtimeDashboard } from "@/lib/realtime-booking";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getRealtimeDashboard());
}
