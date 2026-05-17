import { NextResponse } from "next/server";
import { searchBookingReports } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get("q") || "").trim();
    const reports = await searchBookingReports(query);
    return NextResponse.json({ reports });
  } catch (error) {
    return NextResponse.json(
      { reports: [], error: error instanceof Error ? error.message : "Unable to search booking reports" },
      { status: 200 }
    );
  }
}
