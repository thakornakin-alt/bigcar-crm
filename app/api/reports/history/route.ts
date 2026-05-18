import { NextResponse } from "next/server";
import { listReportHistory } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get("q") || "").trim();
    const type = String(searchParams.get("type") || "all").trim();
    const reports = await listReportHistory(query, type);
    return NextResponse.json({ reports });
  } catch (error) {
    return NextResponse.json(
      { reports: [], error: error instanceof Error ? error.message : "Unable to load report history" },
      { status: 200 }
    );
  }
}
